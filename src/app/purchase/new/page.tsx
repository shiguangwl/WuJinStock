'use client'

/**
 * 新建进货单页面
 * 需求: 3.1 - 创建进货单，包含供应商、进货日期、商品清单
 * 需求: 3.3 - 允许选择商品配置的任意单位
 * 需求: 7.2 - 提供明确的成功或失败反馈
 * 需求: 7.5 - 在需要确认的操作前显示确认对话框
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { createPurchaseOrderAction } from '@/server/actions/purchase-actions'
import { searchProductsAction } from '@/server/actions/product-actions'
import type { ProductWithRelations } from '@/server/services/product-service'
import Decimal from 'decimal.js'
import { useToast } from '@/app/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unit: string
  unitPrice: number
  subtotal: number
  availableUnits: string[]
}

export default function NewPurchasePage() {
  const router = useRouter()
  const toast = useToast()
  const [supplier, setSupplier] = useState('')
  const [orderDate, setOrderDate] = useState<Date>(new Date())
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRelations | null>(null)
  const [newItemQuantity, setNewItemQuantity] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false)

  // 搜索商品
  useEffect(() => {
    const searchProducts = async () => {
      const result = await searchProductsAction({ keyword: searchKeyword || undefined })
      if (result.success) {
        setProducts(result.data)
      }
    }
    searchProducts()
  }, [searchKeyword])

  // 选择商品后设置默认单位和价格
  const handleProductSelect = (product: ProductWithRelations | null) => {
    if (!product) {
      setSelectedProduct(null)
      setNewItemUnit('')
      setNewItemPrice('')
      return
    }

    setSelectedProduct(product)
    setNewItemUnit(product.baseUnit)
    setNewItemPrice(product.purchasePrice.toString())
    setIsProductSearchOpen(false)
  }

  // 获取商品可用单位
  const getAvailableUnits = (product: ProductWithRelations): string[] => {
    const units = [product.baseUnit]
    units.push(...product.packageUnits.map(u => u.name))
    return units
  }

  // 添加商品到清单
  const handleAddItem = () => {
    if (!selectedProduct || !newItemQuantity || !newItemUnit || !newItemPrice) {
      toast.warning('请填写完整信息', '请选择商品并填写数量、单位和单价')
      return
    }

    const quantity = parseFloat(newItemQuantity)
    const unitPrice = parseFloat(newItemPrice)

    if (isNaN(quantity) || quantity <= 0) {
      toast.warning('数量无效', '请输入大于零的数量')
      return
    }

    if (isNaN(unitPrice) || unitPrice < 0) {
      toast.warning('单价无效', '请输入有效的单价')
      return
    }

    const subtotal = new Decimal(quantity).mul(unitPrice).toDecimalPlaces(2).toNumber()

    const newItem: OrderItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      unit: newItemUnit,
      unitPrice,
      subtotal,
      availableUnits: getAvailableUnits(selectedProduct),
    }

    setItems([...items, newItem])

    // 重置输入
    setSelectedProduct(null)
    setNewItemQuantity('')
    setNewItemUnit('')
    setNewItemPrice('')
    setSearchKeyword('')
  }

  // 删除商品
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // 更新商品数量
  const handleUpdateQuantity = (index: number, value: string) => {
    const quantity = parseFloat(value)
    if (isNaN(quantity) || quantity <= 0) return

    const newItems = [...items]
    newItems[index].quantity = quantity
    newItems[index].subtotal = new Decimal(quantity)
      .mul(newItems[index].unitPrice)
      .toDecimalPlaces(2)
      .toNumber()
    setItems(newItems)
  }

  // 更新商品单价
  const handleUpdatePrice = (index: number, value: string) => {
    const unitPrice = parseFloat(value)
    if (isNaN(unitPrice) || unitPrice < 0) return

    const newItems = [...items]
    newItems[index].unitPrice = unitPrice
    newItems[index].subtotal = new Decimal(newItems[index].quantity)
      .mul(unitPrice)
      .toDecimalPlaces(2)
      .toNumber()
    setItems(newItems)
  }

  // 计算总金额
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0)

  // 提交进货单
  const handleSubmit = async () => {
    if (!supplier.trim()) {
      toast.warning('请填写供应商', '供应商名称不能为空')
      return
    }

    if (items.length === 0) {
      toast.warning('请添加商品', '商品清单不能为空')
      return
    }

    setIsOpen(true)
  }

  const confirmSubmit = async () => {
    setSubmitting(true)
    try {
      const result = await createPurchaseOrderAction({
        supplier: supplier.trim(),
        orderDate: new Date(orderDate.setHours(0, 0, 0, 0)),
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
      })

      if (result.success) {
        toast.success('创建成功', `进货单 ${result.data.orderNumber} 已创建`)
        router.push('/purchase')
      } else {
        toast.error('创建失败', result.error)
      }
    } finally {
      setSubmitting(false)
      setIsOpen(false)
    }
  }

  const formatPrice = (price: number) => `¥${price.toFixed(2)}`

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            ← 返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">新建进货单</h1>
        <p className="text-slate-600 mt-1">填写供应商信息和商品清单</p>
      </div>

      {/* 基本信息 */}
      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">
                供应商 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="请输入供应商名称"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">进货日期</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !orderDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(orderDate, 'yyyy-MM-dd', { locale: zhCN })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={orderDate}
                    onSelect={(date) => date && setOrderDate(date)}
                    locale={zhCN}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 添加商品 */}
      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">添加商品</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-64">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">选择商品</label>
              <Popover open={isProductSearchOpen} onOpenChange={setIsProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedProduct ? selectedProduct.name : '搜索商品名称'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="搜索商品..."
                      value={searchKeyword}
                      onValueChange={setSearchKeyword}
                    />
                    <CommandList>
                      <CommandEmpty>未找到商品</CommandEmpty>
                      <CommandGroup>
                        {products.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id}
                            onSelect={() => handleProductSelect(product)}
                          >
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">
                                {product.code} | {product.specification || '无规格'}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-24">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">数量</label>
              <Input
                type="number"
                placeholder="0"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(e.target.value)}
                min={0}
                step={0.001}
              />
            </div>

            <div className="w-24">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">单位</label>
              <Select
                value={newItemUnit}
                onValueChange={setNewItemUnit}
                disabled={!selectedProduct}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择单位" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProduct ? (
                    getAvailableUnits(selectedProduct).map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>请先选择商品</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="w-28">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">单价</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">¥</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  min={0}
                  step={0.01}
                  className="pl-7"
                />
              </div>
            </div>

            <Button
              onClick={handleAddItem}
              className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-md"
            >
              添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 商品清单 */}
      <Card className="mb-6 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">商品清单</CardTitle>
          <div className="text-lg font-bold text-primary">
            总金额: {formatPrice(totalAmount)}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">商品名称</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[100px]">数量</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[80px]">单位</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[120px]">单价</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[100px]">小计</TableHead>
                <TableHead className="font-semibold text-slate-700 w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    请添加商品
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={index} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity.toString()}
                        onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                        min={0}
                        step={0.001}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">¥</span>
                        <Input
                          type="number"
                          value={item.unitPrice.toString()}
                          onChange={(e) => handleUpdatePrice(index, e.target.value)}
                          min={0}
                          step={0.01}
                          className="h-8 pl-5"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-primary font-medium">
                      {formatPrice(item.subtotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 border-red-200"
                        onClick={() => handleRemoveItem(index)}
                      >
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={items.length === 0 || !supplier.trim()}
          className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-md"
        >
          创建进货单
        </Button>
      </div>

      {/* 确认对话框 */}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认创建</AlertDialogTitle>
            <AlertDialogDescription>
              <p>确定要创建此进货单吗？</p>
              <div className="mt-2 text-sm text-gray-600 space-y-1">
                <p>供应商: {supplier}</p>
                <p>商品数量: {items.length} 种</p>
                <p>总金额: {formatPrice(totalAmount)}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSubmit}
              disabled={submitting}
              className="bg-primary"
            >
              {submitting ? '创建中...' : '确认创建'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
