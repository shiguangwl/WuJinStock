'use client'

/**
 * 销售单详情页面
 * 需求: 7.1 - 提供清晰的导航菜单
 * 需求: 7.2 - 在执行操作后提供明确的成功或失败反馈
 * 需求: 7.5 - 在需要确认的操作前显示确认对话框
 * 需求: 4.11 - 支持销售单打印
 * 需求: 4.1.1 - 允许基于原销售单创建退货单
 */
import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  getSalesOrderAction,
  confirmSalesOrderAction,
  createSalesReturnAction,
  confirmSalesReturnAction,
  getReturnOrdersBySalesOrderAction,
} from '@/server/actions/sales-actions'
import type { SalesOrderWithItems, ReturnOrderWithItems } from '@/server/services/sales-service'
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
import { Badge } from '@/components/ui/badge'
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
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

interface ReturnItem {
  productId: string
  productName: string
  originalQuantity: number
  returnQuantity: number
  unit: string
  unitPrice: number
}

export default function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<SalesOrderWithItems | null>(null)
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
        getSalesOrderAction(id),
        getReturnOrdersBySalesOrderAction(id),
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
      const result = await confirmSalesOrderAction(order.id)
      if (result.success) {
        toast.success('确认成功', {
          description: `销售单 ${order.orderNumber} 已完成`,
        })
        loadOrder()
      } else {
        toast.error('确认失败', {
          description: result.error,
        })
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

    const items: ReturnItem[] = order.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      originalQuantity: item.quantity,
      returnQuantity: 0,
      unit: item.unit,
      unitPrice: item.unitPrice,
    }))

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
      toast.warning('数量超出限制', {
        description: `最大可退数量为 ${maxReturn}`,
      })
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
      toast.warning('请填写退货数量', {
        description: '至少需要一个商品的退货数量大于零',
      })
      return
    }

    setSubmitting(true)
    try {
      const result = await createSalesReturnAction({
        originalOrderId: id,
        items: itemsToReturn.map(item => ({
          productId: item.productId,
          quantity: item.returnQuantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
      })

      if (result.success) {
        toast.success('退货单创建成功', {
          description: `退货单 ${result.data.orderNumber} 已创建`,
        })

        // 自动确认退货
        const confirmResult = await confirmSalesReturnAction(result.data.id)
        if (confirmResult.success) {
          toast.success('退货已确认', {
            description: '库存已更新',
          })
        }

        loadOrder()
        setIsReturnOpen(false)
      } else {
        toast.error('退货失败', {
          description: result.error,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 打印销售单
  const handlePrint = () => {
    if (!order) return
    window.print()
  }

  const formatPrice = (price: number) => `¥${price.toFixed(2)}`
  const formatDate = (date: Date) => format(new Date(date), 'yyyy-MM-dd')
  const formatDateTime = (date: Date) => format(new Date(date), 'yyyy-MM-dd HH:mm:ss')

  const getStatusBadge = (status: string) => {
    if (status === 'CONFIRMED') {
      return <Badge className="bg-emerald-100 text-emerald-700">已完成</Badge>
    }
    return <Badge className="bg-amber-100 text-amber-700">待确认</Badge>
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
          <CardContent className="p-8">
            <p className="text-center text-gray-500">销售单不存在</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => router.push('/sales')}>返回列表</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* 打印样式 */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6 no-print">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => router.push('/sales')} size="sm">
                ← 返回
              </Button>
              <Button variant="outline" onClick={handlePrint} size="sm">
                🖨️ 打印
              </Button>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">销售单详情</h1>
          <p className="text-slate-600 mt-1">查看销售单信息和商品明细</p>
        </div>

        {/* 可打印区域 */}
        <div className="print-area" ref={printRef}>
          {/* 打印标题 - 仅打印时显示 */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-bold">销售单</h1>
            <p className="text-gray-500">{order.orderNumber}</p>
          </div>

          {/* 基本信息 */}
          <Card className="mb-6 shadow-sm border-0">
            <CardHeader className="flex flex-row justify-between">
              <h2 className="text-lg font-semibold text-slate-800">基本信息</h2>
              <span className="no-print">{getStatusBadge(order.status)}</span>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">单号</p>
                  <p className="font-medium">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">客户</p>
                  <p className="font-medium">{order.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">销售日期</p>
                  <p className="font-medium">{formatDate(order.orderDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">状态</p>
                  <p className="font-medium">{order.status === 'CONFIRMED' ? '已完成' : '待确认'}</p>
                </div>
              </div>

              <div className="no-print">
                {order.status === 'PENDING' && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => setIsConfirmOpen(true)}
                      className="bg-gradient-to-r from-green-500 to-green-600 shadow-md"
                    >
                      确认销售
                    </Button>
                  </div>
                )}

                {order.status === 'CONFIRMED' && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={openReturnModal}
                      className="shadow-sm"
                    >
                      创建退货
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 商品明细 */}
          <Card className="mb-6 shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">商品明细</h2>
            </CardHeader>
            <CardContent>
              {order.status === 'CONFIRMED' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品名称</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>小计</TableHead>
                      <TableHead className="no-print">已退货</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{formatPrice(item.unitPrice)}</TableCell>
                        <TableCell className="text-blue-600">{formatPrice(item.subtotal)}</TableCell>
                        <TableCell className="no-print">
                          {getReturnedQuantity(item.productId) > 0 ? (
                            <Badge className="bg-amber-100 text-amber-700">
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
                    <TableRow>
                      <TableHead>商品名称</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>小计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{formatPrice(item.unitPrice)}</TableCell>
                        <TableCell className="text-blue-600">{formatPrice(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 金额汇总 */}
          <Card className="mb-6 shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">金额汇总</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>小计</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>折扣</span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                {order.roundingAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>抹零</span>
                    <span>-{formatPrice(order.roundingAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-xl font-bold">
                  <span>应收金额</span>
                  <span className="text-blue-600">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 退货记录 - 不打印 */}
        {returns.length > 0 && (
          <Card className="no-print shadow-sm border-0">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-800">退货记录</h2>
            </CardHeader>
            <CardContent>
              {returns.map((returnOrder) => (
                <div key={returnOrder.id} className="mb-4 last:mb-0">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{returnOrder.orderNumber}</Badge>
                      {returnOrder.status === 'CONFIRMED' ? (
                        <Badge className="bg-emerald-100 text-emerald-700">已确认</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">待确认</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(returnOrder.returnDate)}
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>商品</TableHead>
                        <TableHead>数量</TableHead>
                        <TableHead>金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>{formatPrice(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="text-right mt-2 text-blue-600 font-medium">
                    退货金额: {formatPrice(returnOrder.totalAmount)}
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 确认销售对话框 */}
        <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认销售</AlertDialogTitle>
              <AlertDialogDescription>
                <p>确定要确认销售单 <strong>{order.orderNumber}</strong> 吗？</p>
                <p className="text-sm text-gray-500 mt-2">确认后将减少相应商品的库存数量。</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? '处理中...' : '确认销售'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 退货对话框 */}
        <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>创建退货单</DialogTitle>
              <DialogDescription>
                请输入各商品的退货数量
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品名称</TableHead>
                    <TableHead>原数量</TableHead>
                    <TableHead>已退货</TableHead>
                    <TableHead>可退数量</TableHead>
                    <TableHead>退货数量</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnItems.map((item, index) => {
                    const returnedQty = getReturnedQuantity(item.productId)
                    const maxReturn = new Decimal(item.originalQuantity).sub(returnedQty).toNumber()
                    return (
                      <TableRow key={item.productId}>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReturnOpen(false)} disabled={submitting}>
                取消
              </Button>
              <Button onClick={handleReturn} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
                {submitting ? '处理中...' : '确认退货'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
