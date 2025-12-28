'use client'

/**
 * 进货单详情页面
 * 需求: 3.7 - 显示每次进货的详细信息和状态
 * 需求: 3.1.1 - 允许基于原进货单创建退货单
 * 需求: 7.5 - 在需要确认的操作前显示确认对话框
 */
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  getPurchaseOrderAction,
  confirmPurchaseOrderAction,
  createPurchaseReturnAction,
  confirmPurchaseReturnAction,
  getReturnOrdersByPurchaseOrderAction,
} from '@/server/actions/purchase-actions'
import type { PurchaseOrderWithItems, ReturnOrderWithItems } from '@/server/services/purchase-service'
import Decimal from 'decimal.js'
import { useToast } from '@/app/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'

interface ReturnItem {
  productId: string
  productName: string
  originalQuantity: number
  returnQuantity: number
  unit: string
  unitPrice: number
}

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const toast = useToast()
  const [order, setOrder] = useState<PurchaseOrderWithItems | null>(null)
  const [returns, setReturns] = useState<ReturnOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isReturnOpen, setIsReturnOpen] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    setLoading(true)
    try {
      const [orderResult, returnsResult] = await Promise.all([
        getPurchaseOrderAction(id),
        getReturnOrdersByPurchaseOrderAction(id),
      ])

      if (orderResult.success && orderResult.data) {
        setOrder(orderResult.data)
      }
      if (returnsResult.success) {
        setReturns(returnsResult.data)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!order) return

    setSubmitting(true)
    try {
      const result = await confirmPurchaseOrderAction(order.id)
      if (result.success) {
        toast.success('确认成功', `进货单 ${order.orderNumber} 已入库`)
        loadOrder()
      } else {
        toast.error('确认失败', result.error)
      }
    } finally {
      setSubmitting(false)
      setIsConfirmOpen(false)
    }
  }

  // 计算已退货数量
  const getReturnedQuantity = (productId: string): number => {
    let total = 0
    for (const returnOrder of returns) {
      if (returnOrder.status === 'CONFIRMED') {
        for (const item of returnOrder.items) {
          if (item.productId === productId) {
            total += item.quantity
          }
        }
      }
    }
    return total
  }

  // 打开退货对话框
  const openReturnModal = () => {
    if (!order) return

    const items: ReturnItem[] = order.items.map(item => {
      const returnedQty = getReturnedQuantity(item.productId)
      return {
        productId: item.productId,
        productName: item.productName,
        originalQuantity: item.quantity,
        returnQuantity: 0,
        unit: item.unit,
        unitPrice: item.unitPrice,
      }
    })

    setReturnItems(items)
    setIsReturnOpen(true)
  }

  // 更新退货数量
  const updateReturnQuantity = (index: number, value: string) => {
    const quantity = parseFloat(value)
    if (isNaN(quantity) || quantity < 0) return

    const item = returnItems[index]
    const returnedQty = getReturnedQuantity(item.productId)
    const maxReturn = new Decimal(item.originalQuantity).sub(returnedQty).toNumber()

    if (quantity > maxReturn) {
      toast.warning('数量超出限制', `最大可退数量为 ${maxReturn}`)
      return
    }

    const newItems = [...returnItems]
    newItems[index].returnQuantity = quantity
    setReturnItems(newItems)
  }

  // 提交退货
  const handleReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0)

    if (itemsToReturn.length === 0) {
      toast.warning('请填写退货数量', '至少需要一个商品的退货数量大于零')
      return
    }

    setSubmitting(true)
    try {
      const result = await createPurchaseReturnAction({
        originalOrderId: id,
        items: itemsToReturn.map(item => ({
          productId: item.productId,
          quantity: item.returnQuantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
      })

      if (result.success) {
        toast.success('退货单创建成功', `退货单 ${result.data.orderNumber} 已创建`)

        // 自动确认退货
        const confirmResult = await confirmPurchaseReturnAction(result.data.id)
        if (confirmResult.success) {
          toast.success('退货已确认', '库存已更新')
        }

        loadOrder()
        setIsReturnOpen(false)
      } else {
        toast.error('退货失败', result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (price: number) => `¥${price.toFixed(2)}`
  const formatDate = (date: Date) => format(new Date(date), 'yyyy-MM-dd', { locale: zhCN })

  const getStatusBadge = (status: string) => {
    if (status === 'CONFIRMED') {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已入库</Badge>
    }
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">待确认</Badge>
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-500">进货单不存在</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => router.push('/purchase')}>返回列表</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" onClick={() => router.push('/purchase')} size="sm">
            ← 返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">进货单详情</h1>
        <p className="text-slate-600 mt-1">查看进货单信息和商品明细</p>
      </div>

      {/* 基本信息 */}
      <Card className="mb-6 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">基本信息</CardTitle>
          {getStatusBadge(order.status)}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">单号</p>
              <p className="font-medium">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">供应商</p>
              <p className="font-medium">{order.supplier}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">进货日期</p>
              <p className="font-medium">{formatDate(order.orderDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">总金额</p>
              <p className="font-medium text-primary text-lg">{formatPrice(order.totalAmount)}</p>
            </div>
          </div>

          {order.status === 'PENDING' && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => setIsConfirmOpen(true)}
                className="bg-gradient-to-r from-green-500 to-green-600 shadow-md"
              >
                确认入库
              </Button>
            </div>
          )}

          {order.status === 'CONFIRMED' && (
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={openReturnModal}
                className="shadow-sm bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
              >
                创建退货
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 商品明细 */}
      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">商品明细</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {order.status === 'CONFIRMED' ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">商品名称</TableHead>
                  <TableHead className="font-semibold text-slate-700">数量</TableHead>
                  <TableHead className="font-semibold text-slate-700">单位</TableHead>
                  <TableHead className="font-semibold text-slate-700">单价</TableHead>
                  <TableHead className="font-semibold text-slate-700">小计</TableHead>
                  <TableHead className="font-semibold text-slate-700">已退货</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{formatPrice(item.unitPrice)}</TableCell>
                    <TableCell className="text-primary">{formatPrice(item.subtotal)}</TableCell>
                    <TableCell>
                      {getReturnedQuantity(item.productId) > 0 ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          {getReturnedQuantity(item.productId)} {item.unit}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">商品名称</TableHead>
                  <TableHead className="font-semibold text-slate-700">数量</TableHead>
                  <TableHead className="font-semibold text-slate-700">单位</TableHead>
                  <TableHead className="font-semibold text-slate-700">单价</TableHead>
                  <TableHead className="font-semibold text-slate-700">小计</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{formatPrice(item.unitPrice)}</TableCell>
                    <TableCell className="text-primary">{formatPrice(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 退货记录 */}
      {returns.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">退货记录</CardTitle>
          </CardHeader>
          <CardContent>
            {returns.map((returnOrder) => (
              <div key={returnOrder.id} className="mb-4 last:mb-0">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{returnOrder.orderNumber}</Badge>
                    {returnOrder.status === 'CONFIRMED' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已确认</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">待确认</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(returnOrder.returnDate)}
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">商品</TableHead>
                      <TableHead className="font-semibold text-slate-700">数量</TableHead>
                      <TableHead className="font-semibold text-slate-700">金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnOrder.items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50">
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.quantity} {item.unit}</TableCell>
                        <TableCell>{formatPrice(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-right mt-2 text-primary font-medium">
                  退货金额: {formatPrice(returnOrder.totalAmount)}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 确认入库对话框 */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认入库</AlertDialogTitle>
            <AlertDialogDescription>
              <p>确定要确认进货单 <strong>{order.orderNumber}</strong> 入库吗？</p>
              <p className="text-sm text-gray-500 mt-2">确认后将增加相应商品的库存数量。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? '确认中...' : '确认入库'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 退货对话框 */}
      <AlertDialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>创建退货单</AlertDialogTitle>
            <AlertDialogDescription>
              请输入各商品的退货数量
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">商品名称</TableHead>
                  <TableHead className="font-semibold text-slate-700">原数量</TableHead>
                  <TableHead className="font-semibold text-slate-700">已退货</TableHead>
                  <TableHead className="font-semibold text-slate-700">可退数量</TableHead>
                  <TableHead className="font-semibold text-slate-700">退货数量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnItems.map((item, index) => {
                  const returnedQty = getReturnedQuantity(item.productId)
                  const maxReturn = new Decimal(item.originalQuantity).sub(returnedQty).toNumber()
                  return (
                    <TableRow key={item.productId} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.originalQuantity} {item.unit}</TableCell>
                      <TableCell>{returnedQty} {item.unit}</TableCell>
                      <TableCell>{maxReturn} {item.unit}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.returnQuantity.toString()}
                          onChange={(e) => updateReturnQuantity(index, e.target.value)}
                          min={0}
                          max={maxReturn}
                          step={0.001}
                          className="w-24"
                          disabled={maxReturn <= 0}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturn}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {submitting ? '处理中...' : '确认退货'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
