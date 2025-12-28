'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ShoppingCart, Plus, Search, Calendar as CalendarIcon } from 'lucide-react'
import {
  searchSalesOrdersAction,
  deleteSalesOrderAction,
  confirmSalesOrderAction,
} from '@/server/actions/sales-actions'
import type { SalesOrderWithItems } from '@/server/services/sales-service'
import { PageHeader, EmptyState, LoadingState } from '@/app/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function SalesPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<SalesOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [customerName, setCustomerName] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<SalesOrderWithItems | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<SalesOrderWithItems | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const result = await searchSalesOrdersAction({
        customerName: customerName || undefined,
        startDate: startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : undefined,
        endDate: endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59) : undefined,
      })
      if (result.success) {
        setOrders(result.data)
      }
    } finally {
      setLoading(false)
    }
  }, [customerName, startDate, endDate])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleSearch = () => {
    loadOrders()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const result = await deleteSalesOrderAction(deleteTarget.id)
    if (result.success) {
      toast.success('删除成功', {
        description: `销售单 ${deleteTarget.orderNumber} 已删除`,
      })
      loadOrders()
    } else {
      toast.error('删除失败', {
        description: result.error,
      })
    }
    setIsDeleteOpen(false)
    setDeleteTarget(null)
  }

  const handleConfirm = async () => {
    if (!confirmTarget) return

    const result = await confirmSalesOrderAction(confirmTarget.id)
    if (result.success) {
      toast.success('确认成功', {
        description: `销售单 ${confirmTarget.orderNumber} 已完成`,
      })
      loadOrders()
    } else {
      toast.error('确认失败', {
        description: result.error,
      })
    }
    setIsConfirmOpen(false)
    setConfirmTarget(null)
  }

  const openDeleteModal = (order: SalesOrderWithItems) => {
    setDeleteTarget(order)
    setIsDeleteOpen(true)
  }

  const openConfirmModal = (order: SalesOrderWithItems) => {
    setConfirmTarget(order)
    setIsConfirmOpen(true)
  }

  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`
  }

  const formatDate = (date: Date) => {
    return format(new Date(date), 'yyyy-MM-dd')
  }

  const getStatusBadge = (status: string) => {
    if (status === 'CONFIRMED') {
      return <Badge className="bg-emerald-100 text-emerald-700">已完成</Badge>
    }
    return <Badge className="bg-amber-100 text-amber-700">待确认</Badge>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <PageHeader
        title="销售管理"
        description="管理店铺销售订单"
        icon={<ShoppingCart size={24} />}
        actions={
          <Button
            onClick={() => router.push('/sales/new')}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/30 font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            快速开单
          </Button>
        }
      />

      {/* 搜索栏 */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-48">
              <Input
                placeholder="客户名称"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-48 justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'yyyy-MM-dd') : '开始日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-48 justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'yyyy-MM-dd') : '结束日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Button onClick={handleSearch} className="h-10 font-medium">
              <Search className="w-4 h-4 mr-2" />
              搜索
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCustomerName('')
                setStartDate(undefined)
                setEndDate(undefined)
              }}
              className="h-10"
            >
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 销售单列表 */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8">
              <LoadingState text="加载销售订单..." />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ShoppingCart size={40} strokeWidth={1.5} />}
                title="暂无销售记录"
                description="还没有创建销售订单"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>单号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>销售日期</TableHead>
                  <TableHead>商品数量</TableHead>
                  <TableHead>小计</TableHead>
                  <TableHead>折扣</TableHead>
                  <TableHead>应收金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50">
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100">
                        {order.orderNumber}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {order.customerName || '-'}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(order.orderDate)}</TableCell>
                    <TableCell className="text-slate-600">{order.items.length} 种</TableCell>
                    <TableCell className="text-slate-600">{formatPrice(order.subtotal)}</TableCell>
                    <TableCell className="text-rose-500">
                      {order.discountAmount > 0 || order.roundingAmount > 0
                        ? `-${formatPrice(order.discountAmount + order.roundingAmount)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-emerald-600 font-semibold">
                      {formatPrice(order.totalAmount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-slate-100 hover:bg-slate-200"
                          onClick={() => router.push(`/sales/${order.id}`)}
                        >
                          详情
                        </Button>
                        {order.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              onClick={() => openConfirmModal(order)}
                            >
                              确认
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => openDeleteModal(order)}
                            >
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除销售单 <strong>{deleteTarget?.orderNumber}</strong> 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 确认销售对话框 */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认销售</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>确定要确认销售单 <strong>{confirmTarget?.orderNumber}</strong> 吗？</p>
              <p className="text-slate-500 text-sm">确认后将减少相应商品的库存数量。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">
              确认销售
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
