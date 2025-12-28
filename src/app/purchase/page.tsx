'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Search, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  searchPurchaseOrdersAction,
  deletePurchaseOrderAction,
  confirmPurchaseOrderAction,
} from '@/server/actions/purchase-actions'
import type { PurchaseOrderWithItems } from '@/server/services/purchase-service'
import { PageHeader, EmptyState, LoadingState } from '@/app/components'
import { useToast } from '@/app/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

export default function PurchasePage() {
  const router = useRouter()
  const toast = useToast()
  const [orders, setOrders] = useState<PurchaseOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderWithItems | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<PurchaseOrderWithItems | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const result = await searchPurchaseOrdersAction({
        supplier: supplier || undefined,
        startDate: startDate ? new Date(startDate.setHours(0, 0, 0, 0)) : undefined,
        endDate: endDate ? new Date(endDate.setHours(23, 59, 59, 999)) : undefined,
      })
      if (result.success) {
        setOrders(result.data)
      }
    } finally {
      setLoading(false)
    }
  }, [supplier, startDate, endDate])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleSearch = () => {
    loadOrders()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const result = await deletePurchaseOrderAction(deleteTarget.id)
    if (result.success) {
      toast.success('删除成功', `进货单 ${deleteTarget.orderNumber} 已删除`)
      loadOrders()
    } else {
      toast.error('删除失败', result.error)
    }
    setIsDeleteOpen(false)
    setDeleteTarget(null)
  }

  const handleConfirm = async () => {
    if (!confirmTarget) return

    const result = await confirmPurchaseOrderAction(confirmTarget.id)
    if (result.success) {
      toast.success('确认成功', `进货单 ${confirmTarget.orderNumber} 已入库`)
      loadOrders()
    } else {
      toast.error('确认失败', result.error)
    }
    setIsConfirmOpen(false)
    setConfirmTarget(null)
  }

  const openDeleteModal = (order: PurchaseOrderWithItems) => {
    setDeleteTarget(order)
    setIsDeleteOpen(true)
  }

  const openConfirmModal = (order: PurchaseOrderWithItems) => {
    setConfirmTarget(order)
    setIsConfirmOpen(true)
  }

  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`
  }

  const formatDate = (date: Date) => {
    return format(new Date(date), 'yyyy-MM-dd', { locale: zhCN })
  }

  const getStatusBadge = (status: string) => {
    if (status === 'CONFIRMED') {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已入库</Badge>
    }
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">待确认</Badge>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <PageHeader
        title="进货管理"
        description="管理店铺进货订单"
        icon={<Package size={24} />}
        actions={
          <Button
            onClick={() => router.push('/purchase/new')}
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/30"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建进货单
          </Button>
        }
      />

      {/* 搜索栏 */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-48">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">供应商</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="供应商名称"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-48">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">开始日期</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'yyyy-MM-dd', { locale: zhCN }) : '选择日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={zhCN}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-48">
              <label className="text-sm font-medium mb-1.5 block text-slate-700">结束日期</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'yyyy-MM-dd', { locale: zhCN }) : '选择日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={zhCN}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleSearch} className="h-10">
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSupplier('')
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

      {/* 进货单列表 */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">单号</TableHead>
                <TableHead className="font-semibold text-slate-700">供应商</TableHead>
                <TableHead className="font-semibold text-slate-700">进货日期</TableHead>
                <TableHead className="font-semibold text-slate-700">商品数量</TableHead>
                <TableHead className="font-semibold text-slate-700">总金额</TableHead>
                <TableHead className="font-semibold text-slate-700">状态</TableHead>
                <TableHead className="font-semibold text-slate-700">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <LoadingState text="加载进货订单..." />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <EmptyState
                      icon={<Package size={40} strokeWidth={1.5} />}
                      title="暂无进货记录"
                      description="还没有创建进货订单"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50">
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {order.orderNumber}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">{order.supplier}</TableCell>
                    <TableCell className="text-slate-600">{formatDate(order.orderDate)}</TableCell>
                    <TableCell className="text-slate-600">{order.items.length} 种</TableCell>
                    <TableCell className="text-indigo-600 font-semibold">
                      {formatPrice(order.totalAmount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-slate-100 hover:bg-slate-200"
                          onClick={() => router.push(`/purchase/${order.id}`)}
                        >
                          详情
                        </Button>
                        {order.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200"
                              onClick={() => openConfirmModal(order)}
                            >
                              确认入库
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 border-red-200"
                              onClick={() => openDeleteModal(order)}
                            >
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除进货单 <strong className="text-slate-800">{deleteTarget?.orderNumber}</strong> 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 确认入库对话框 */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认入库</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                确定要确认进货单 <strong className="text-slate-800">{confirmTarget?.orderNumber}</strong> 入库吗？
              </p>
              <p className="text-slate-500 text-sm">
                确认后将增加相应商品的库存数量。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              确认入库
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
