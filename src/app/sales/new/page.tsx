'use client'

/**
 * 新建销售单页面（快速开单）
 * 需求: 7.1 - 提供清晰的导航菜单
 * 需求: 7.2 - 在执行操作后提供明确的成功或失败反馈
 * 需求: 7.4 - 支持键盘快捷操作
 * 需求: 7.5 - 在需要确认的操作前显示确认对话框
 */
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { searchProductsAction } from '@/server/actions/product-actions'
import {
  createSalesOrderAction,
  applyDiscountAction,
  applyRoundingAction,
  adjustItemPriceAction,
  confirmSalesOrderAction,
} from '@/server/actions/sales-actions'
import { getInventoryAction } from '@/server/actions/inventory-actions'
import type { Product, PackageUnit } from '@/server/db/schema'
import Decimal from 'decimal.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'

interface ProductWithUnits extends Product {
  packageUnits: PackageUnit[]
}

interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unit: string
  unitPrice: number
  originalPrice: number
  subtotal: number
  availableStock: number
}

export default function NewSalesPage() {
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 商品搜索状态
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<ProductWithUnits[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductWithUnits | null>(null)
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false)

  // 添加商品表单状态
  const [quantity, setQuantity] = useState<number>(1)
  const [selectedUnit, setSelectedUnit] = useState<string>('')
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [availableStock, setAvailableStock] = useState<number>(0)

  // 订单状态
  const [customerName, setCustomerName] = useState('')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderId, setOrderId] = useState<string | null>(null)
  const [subtotal, setSubtotal] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [roundingAmount, setRoundingAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  // 折扣和抹零状态
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [roundingValue, setRoundingValue] = useState<number>(0)

  // 改价状态
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [newPrice, setNewPrice] = useState<number>(0)

  // 对话框状态
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPriceEditOpen, setIsPriceEditOpen] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // 搜索商品
  useEffect(() => {
    const searchProducts = async () => {
      if (searchKeyword.length < 1) {
        setSearchResults([])
        return
      }
      const result = await searchProductsAction({ keyword: searchKeyword })
      if (result.success) {
        setSearchResults(result.data as ProductWithUnits[])
      }
    }
    const timer = setTimeout(searchProducts, 300)
    return () => clearTimeout(timer)
  }, [searchKeyword])

  // 选择商品后获取库存和设置默认值
  useEffect(() => {
    const loadProductInfo = async () => {
      if (!selectedProduct) {
        setSelectedUnit('')
        setUnitPrice(0)
        setAvailableStock(0)
        return
      }

      // 设置默认单位为基本单位
      setSelectedUnit(selectedProduct.baseUnit)
      setUnitPrice(selectedProduct.retailPrice)

      // 获取库存
      const inventoryResult = await getInventoryAction(selectedProduct.id)
      if (inventoryResult.success && inventoryResult.data) {
        setAvailableStock(inventoryResult.data.quantity)
      } else {
        setAvailableStock(0)
      }
    }
    loadProductInfo()
  }, [selectedProduct])

  // 切换单位时更新价格
  useEffect(() => {
    if (!selectedProduct || !selectedUnit) return

    if (selectedUnit === selectedProduct.baseUnit) {
      setUnitPrice(selectedProduct.retailPrice)
    } else {
      const packageUnit = selectedProduct.packageUnits.find(u => u.name === selectedUnit)
      if (packageUnit) {
        if (packageUnit.retailPrice) {
          setUnitPrice(packageUnit.retailPrice)
        } else {
          setUnitPrice(new Decimal(selectedProduct.retailPrice).mul(packageUnit.conversionRate).toDecimalPlaces(4).toNumber())
        }
      }
    }
  }, [selectedUnit, selectedProduct])

  // 计算订单金额
  useEffect(() => {
    const newSubtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
    setSubtotal(newSubtotal)
    setTotalAmount(Math.max(0, newSubtotal - discountAmount - roundingAmount))
  }, [orderItems, discountAmount, roundingAmount])

  // 获取可用单位列表
  const getAvailableUnits = () => {
    if (!selectedProduct) return []
    const units = [{ key: selectedProduct.baseUnit, label: selectedProduct.baseUnit }]
    selectedProduct.packageUnits.forEach(u => {
      units.push({ key: u.name, label: `${u.name} (${u.conversionRate}${selectedProduct.baseUnit})` })
    })
    return units
  }

  // 添加商品到订单
  const handleAddItem = async () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error('添加失败', {
        description: '请选择商品并输入有效数量',
      })
      return
    }

    // 计算需要的基本单位数量
    let requiredBaseQuantity = quantity
    if (selectedUnit !== selectedProduct.baseUnit) {
      const packageUnit = selectedProduct.packageUnits.find(u => u.name === selectedUnit)
      if (packageUnit) {
        requiredBaseQuantity = new Decimal(quantity).mul(packageUnit.conversionRate).toNumber()
      }
    }

    // 检查库存
    if (requiredBaseQuantity > availableStock) {
      toast.error('库存不足', {
        description: `当前库存: ${availableStock} ${selectedProduct.baseUnit}`,
      })
      return
    }

    const itemSubtotal = new Decimal(quantity).mul(unitPrice).toDecimalPlaces(2).toNumber()

    const newItem: OrderItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      unit: selectedUnit,
      unitPrice,
      originalPrice: unitPrice,
      subtotal: itemSubtotal,
      availableStock,
    }

    setOrderItems([...orderItems, newItem])

    // 重置表单
    setSelectedProduct(null)
    setSearchKeyword('')
    setQuantity(1)
    setSelectedUnit('')
    setUnitPrice(0)

    // 聚焦搜索框
    searchInputRef.current?.focus()
  }

  // 删除商品
  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  // 打开改价对话框
  const handleOpenPriceEdit = (index: number) => {
    setEditingItemIndex(index)
    setNewPrice(orderItems[index].unitPrice)
    setIsPriceEditOpen(true)
  }

  // 确认改价
  const handleConfirmPriceEdit = () => {
    if (editingItemIndex === null) return

    const updatedItems = [...orderItems]
    const item = updatedItems[editingItemIndex]
    item.unitPrice = newPrice
    item.subtotal = new Decimal(item.quantity).mul(newPrice).toDecimalPlaces(2).toNumber()
    setOrderItems(updatedItems)

    setIsPriceEditOpen(false)
    setEditingItemIndex(null)
  }

  // 应用折扣
  const handleApplyDiscount = () => {
    if (discountValue <= 0) {
      setDiscountAmount(0)
      return
    }

    let discount: number
    if (discountType === 'percentage') {
      discount = new Decimal(subtotal).mul(discountValue).div(100).toDecimalPlaces(2).toNumber()
    } else {
      discount = Math.min(discountValue, subtotal)
    }
    setDiscountAmount(discount)
  }

  // 应用抹零
  const handleApplyRounding = () => {
    const maxRounding = subtotal - discountAmount
    setRoundingAmount(Math.min(roundingValue, maxRounding))
  }

  // 创建并确认订单
  const handleSubmit = async () => {
    if (orderItems.length === 0) {
      toast.error('提交失败', {
        description: '请至少添加一个商品',
      })
      return
    }

    setSubmitting(true)
    try {
      // 创建销售单
      const createResult = await createSalesOrderAction({
        customerName: customerName || undefined,
        items: orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
      })

      if (!createResult.success) {
        toast.error('创建失败', {
          description: createResult.error,
        })
        return
      }

      const newOrderId = createResult.data.id

      // 应用折扣
      if (discountAmount > 0) {
        await applyDiscountAction({
          orderId: newOrderId,
          discountType,
          discountValue,
        })
      }

      // 应用抹零
      if (roundingAmount > 0) {
        await applyRoundingAction({
          orderId: newOrderId,
          roundingAmount,
        })
      }

      // 确认销售单
      const confirmResult = await confirmSalesOrderAction(newOrderId)
      if (!confirmResult.success) {
        toast.error('确认失败', {
          description: confirmResult.error,
        })
        // 跳转到详情页让用户处理
        router.push(`/sales/${newOrderId}`)
        return
      }

      toast.success('销售成功', {
        description: `销售单 ${createResult.data.orderNumber} 已完成`,
      })

      router.push('/sales')
    } finally {
      setSubmitting(false)
      setIsConfirmOpen(false)
    }
  }

  const formatPrice = (price: number) => `¥${price.toFixed(2)}`

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" onClick={() => router.push('/sales')} size="sm">
            ← 返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">快速开单</h1>
        <p className="text-slate-600 mt-1">添加商品并完成销售</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：商品搜索和添加 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 商品搜索 */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">添加商品</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Combobox 商品搜索 */}
              <Popover open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isProductSelectorOpen}
                    className="w-full justify-between"
                  >
                    {selectedProduct ? selectedProduct.name : '搜索商品...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="输入商品名称或规格"
                      value={searchKeyword}
                      onValueChange={setSearchKeyword}
                    />
                    <CommandEmpty>未找到商品</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {searchResults.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.id}
                          onSelect={() => {
                            setSelectedProduct(product)
                            setIsProductSelectorOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedProduct?.id === product.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex justify-between w-full">
                            <span>{product.name}</span>
                            <span className="text-slate-400">{product.specification}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedProduct && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Input
                      type="number"
                      placeholder="数量"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                      min={0.001}
                      step={1}
                    />
                  </div>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择单位" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableUnits().map(unit => (
                        <SelectItem key={unit.key} value={unit.key}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <Input
                      type="number"
                      placeholder="单价"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleAddItem}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-md"
                    >
                      添加
                    </Button>
                  </div>
                </div>
              )}

              {selectedProduct && (
                <div className="text-sm text-slate-500">
                  库存: {availableStock} {selectedProduct.baseUnit}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 商品列表 */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">商品清单</h2>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品名称</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead>小计</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">
                        请添加商品
                      </TableCell>
                    </TableRow>
                  ) : (
                    orderItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.quantity} {item.unit}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenPriceEdit(index)}
                          >
                            {formatPrice(item.unitPrice)}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{formatPrice(item.subtotal)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
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
        </div>

        {/* 右侧：订单信息和结算 */}
        <div className="space-y-6">
          {/* 客户信息 */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">客户信息</h2>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="客户名称（可选）"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* 折扣和抹零 */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">优惠</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={discountType} onValueChange={(value) => setDiscountType(value as 'percentage' | 'fixed')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">百分比</SelectItem>
                    <SelectItem value="fixed">固定金额</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="折扣值"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  min={0}
                  max={discountType === 'percentage' ? 100 : subtotal}
                />
                <Button variant="outline" onClick={handleApplyDiscount}>
                  应用
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="抹零金额"
                  value={roundingValue}
                  onChange={(e) => setRoundingValue(Number(e.target.value) || 0)}
                  min={0}
                  max={10}
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleApplyRounding}>
                  应用
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 结算信息 */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">结算</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>小计</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>折扣</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              {roundingAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>抹零</span>
                  <span>-{formatPrice(roundingAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>应收</span>
                <span className="text-blue-600">{formatPrice(totalAmount)}</span>
              </div>

              <Button
                size="lg"
                className="w-full mt-4 bg-gradient-to-r from-green-500 to-green-600 shadow-md"
                onClick={() => setIsConfirmOpen(true)}
                disabled={orderItems.length === 0 || submitting}
              >
                确认收款
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 确认收款对话框 */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认收款</AlertDialogTitle>
            <AlertDialogDescription>
              <p>确定要完成此销售单吗？</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                应收金额: {formatPrice(totalAmount)}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting ? '处理中...' : '确认收款'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 改价对话框 */}
      <Dialog open={isPriceEditOpen} onOpenChange={setIsPriceEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改单价</DialogTitle>
            <DialogDescription>
              {editingItemIndex !== null && (
                <span>商品: {orderItems[editingItemIndex]?.productName}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {editingItemIndex !== null && (
            <div className="space-y-4">
              <Input
                type="number"
                placeholder="新单价"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                min={0}
                step={0.01}
              />
              <p className="text-sm text-slate-500">
                原价: {formatPrice(orderItems[editingItemIndex]?.originalPrice ?? 0)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPriceEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmPriceEdit}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
