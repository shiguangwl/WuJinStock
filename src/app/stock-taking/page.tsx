'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  getAllStockTakingsAction,
  deleteStockTakingAction,
} from '@/server/actions/stock-taking-actions'
import type { StockTakingWithItems } from '@/server/db/schema'
import { PageHeader } from '@/app/components'
import { ClipboardList } from 'lucide-react'

const statusMap: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: '进行中', className: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
}

export default function StockTakingPage() {
  const router = useRouter()
  const [stockTakings, setStockTakings] = useState<StockTakingWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaking, setSelectedTaking] = useState<StockTakingWithItems | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const loadStockTakings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAllStockTakingsAction()
      if (result.success) {
        setStockTakings(result.data)
      } else {
        toast.error('加载失败', { description: result.error })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStockTakings()
  }, [loadStockTakings])

  const handleDelete = async () => {
    if (!selectedTaking) return

    const result = await deleteStockTakingAction({ takingId: selectedTaking.id })
    if (result.success) {
      toast.success('删除成功')
      setDeleteDialogOpen(false)
      loadStockTakings()
    } else {
      toast.error('删除失败', { description: result.error })
    }
  }

  const confirmDelete = (taking: StockTakingWithItems) => {
    setSelectedTaking(taking)
    setDeleteDialogOpen(true)
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDifferenceSummary = (taking: StockTakingWithItems) => {
    const itemsWithDiff = taking.items.filter(i => i.difference !== 0)
    return {
      total: taking.items.length,
      withDiff: itemsWithDiff.length,
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="盘点管理"
        description="管理库存盘点记录"
        actions={
          <Button
            onClick={() => router.push('/stock-taking/new')}
            className="bg-gradient-to-r from-amber-600 to-amber-500 shadow-lg shadow-amber-500/30"
          >
            + 新建盘点
          </Button>
        }
      />

      {/* 盘点列表 */}
      <Card className="shadow-sm border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-slate-600 font-semibold">盘点日期</TableHead>
                <TableHead className="text-slate-600 font-semibold">状态</TableHead>
                <TableHead className="text-slate-600 font-semibold">商品数量</TableHead>
                <TableHead className="text-slate-600 font-semibold">差异商品</TableHead>
                <TableHead className="text-slate-600 font-semibold">创建时间</TableHead>
                <TableHead className="text-slate-600 font-semibold">完成时间</TableHead>
                <TableHead className="text-slate-600 font-semibold">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Spinner />
                      <span className="text-slate-500">加载中...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : stockTakings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="text-slate-400">
                      <div className="text-4xl mb-2">📋</div>
                      <p>暂无盘点记录</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                stockTakings.map((taking) => {
                  const statusInfo = statusMap[taking.status] ?? { label: taking.status, className: 'bg-slate-100 text-slate-700' }
                  const summary = getDifferenceSummary(taking)
                  return (
                    <TableRow key={taking.id} className="hover:bg-slate-50">
                      <TableCell className="text-slate-800 font-medium">{formatDate(taking.takingDate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusInfo.className}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{summary.total} 种</TableCell>
                      <TableCell>
                        {summary.withDiff > 0 ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                            {summary.withDiff} 个差异
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                            无差异
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{formatDate(taking.createdAt)}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{formatDate(taking.completedAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-slate-100 hover:bg-slate-200"
                            onClick={() => router.push(`/stock-taking/${taking.id}`)}
                          >
                            {taking.status === 'IN_PROGRESS' ? '继续盘点' : '查看详情'}
                          </Button>
                          {taking.status === 'IN_PROGRESS' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => confirmDelete(taking)}
                            >
                              删除
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-800">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              确定要删除这个盘点记录吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
