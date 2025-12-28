'use client'

/**
 * 盘点详情/录入页面
 * 需求: 7.1 - 提供清晰的导航菜单
 * 需求: 7.2 - 在执行操作后提供明确的成功或失败反馈
 * 需求: 2.5 - 支持库存盘点功能，允许录入实际盘点数量
 * 需求: 2.6 - 计算盘点差异（实际数量与系统数量的差值）
 * 需求: 2.7 - 确认盘点结果时更新库存数量
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  getStockTakingAction,
  recordActualQuantityAction,
  completeStockTakingAction,
  getStockTakingDifferenceSummaryAction,
} from '@/server/actions/stock-taking-actions'
import type { StockTakingItem, StockTakingWithItems } from '@/server/db/schema'

// 状态映射
const statusMap: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: '进行中', className: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
}

export default function StockTakingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const takingId = params.id as string

  const [stockTaking, setStockTaking] = useState<StockTakingWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [keyword, setKeyword] = useState('')
  const [summary, setSummary] = useState<{
    totalItems: number
    itemsWithDifference: number
    totalPositiveDifference: number
    totalNegativeDifference: number
  } | null>(null)

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)

  const loadStockTaking = useCallback(async () => {
    setLoading(true)
    try {
      const [takingResult, summaryResult] = await Promise.all([
        getStockTakingAction({ takingId }),
        getStockTakingDifferenceSummaryAction({ takingId }),
      ])

      if (takingResult.success && takingResult.data) {
        setStockTaking(takingResult.data)
      } else if (!takingResult.success) {
        toast.error('加载失败', { description: takingResult.error })
        router.push('/stock-taking')
      } else {
        toast.error('加载失败', { description: '盘点记录不存在' })
        router.push('/stock-taking')
      }

      if (summaryResult.success) {
        setSummary(summaryResult.data)
      }
    } finally {
      setLoading(false)
    }
  }, [takingId, router])

  useEffect(() => {
    loadStockTaking()
  }, [loadStockTaking])

  const handleStartEdit = (item: StockTakingItem) => {
    if (stockTaking?.status === 'COMPLETED') return
    setEditingItem(item.id)
    setEditValue(item.actualQuantity.toString())
  }

  const handleSaveEdit = async (item: StockTakingItem) => {
    const actualQuantity = parseFloat(editValue)
    if (isNaN(actualQuantity) || actualQuantity < 0) {
      toast.error('输入无效', { description: '请输入有效的非负数量' })
      return
    }

    setSaving(true)
    try {
      const result = await recordActualQuantityAction({
        takingId,
        productId: item.productId,
        actualQuantity,
      })

      if (result.success) {
        // 更新本地状态
        setStockTaking(prev => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.map(i =>
              i.id === item.id
                ? { ...i, actualQuantity: result.data.actualQuantity, difference: result.data.difference }
                : i
            ),
          }
        })
        setEditingItem(null)
        
        // 刷新汇总
        const summaryResult = await getStockTakingDifferenceSummaryAction({ takingId })
        if (summaryResult.success) {
          setSummary(summaryResult.data)
        }
      } else {
        toast.error('保存失败', { description: result.error })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingItem(null)
    setEditValue('')
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const result = await completeStockTakingAction({ takingId })
      if (result.success) {
        toast.success('盘点完成', { description: '库存已更新' })
        setCompleteDialogOpen(false)
        loadStockTaking()
      } else {
        toast.error('完成失败', { description: result.error })
      }
    } finally {
      setCompleting(false)
    }
  }

  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(3)
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

  // 过滤商品列表
  const filteredItems = stockTaking?.items.filter((item) => {
    if (!keyword) return true
    const searchTerm = keyword.toLowerCase()
    return item.productName.toLowerCase().includes(searchTerm)
  }) ?? []

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner />
          <span className="text-slate-500">加载中...</span>
        </div>
      </div>
    )
  }

  if (!stockTaking) {
    return null
  }

  const statusInfo = statusMap[stockTaking.status] ?? { label: stockTaking.status, className: 'bg-amber-100 text-amber-700' }
  const isCompleted = stockTaking.status === 'COMPLETED'

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/stock-taking')}
            size="sm"
          >
            ← 返回
          </Button>
          <Badge variant="secondary" className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">盘点详情</h1>
        <p className="text-slate-600 mt-1">录入实际数量并完成盘点</p>
      </div>

      {/* 盘点信息卡片 */}
      <Card className="mb-6 shadow-sm border-0">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">盘点日期</div>
              <div className="font-medium">{formatDate(stockTaking.takingDate)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">创建时间</div>
              <div className="font-medium">{formatDate(stockTaking.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">完成时间</div>
              <div className="font-medium">{formatDate(stockTaking.completedAt)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">商品数量</div>
              <div className="font-medium">{stockTaking.items.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 差异汇总卡片 */}
      {summary && (
        <Card className="mb-6 shadow-sm border-0">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800">差异汇总</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">总商品数</div>
                <div className="text-xl font-bold">{summary.totalItems}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">有差异商品</div>
                <div className="text-xl font-bold text-amber-600">{summary.itemsWithDifference}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">盘盈总量</div>
                <div className="text-xl font-bold text-emerald-600">+{formatQuantity(summary.totalPositiveDifference)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">盘亏总量</div>
                <div className="text-xl font-bold text-red-600">-{formatQuantity(summary.totalNegativeDifference)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索和操作 */}
      <Card className="mb-6 shadow-sm border-0">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">搜索商品</label>
              <Input
                placeholder="商品名称"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => setKeyword('')}
            >
              重置
            </Button>
            {!isCompleted && (
              <Button
                onClick={() => setCompleteDialogOpen(true)}
                className="bg-gradient-to-r from-green-500 to-green-600 shadow-md"
              >
                完成盘点
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 盘点明细表格 */}
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="text-slate-700">商品名称</TableHead>
            <TableHead className="text-slate-700">单位</TableHead>
            <TableHead className="text-slate-700">系统数量</TableHead>
            <TableHead className="text-slate-700">实际数量</TableHead>
            <TableHead className="text-slate-700">差异</TableHead>
            <TableHead className="text-slate-700">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                暂无商品
              </TableCell>
            </TableRow>
          ) : (
            filteredItems.map((item) => {
              const hasDifference = item.difference !== 0
              const isEditing = editingItem === item.id
              const rowClassName = hasDifference 
                ? (item.difference > 0 ? 'bg-emerald-50' : 'bg-red-50') 
                : 'hover:bg-slate-50'

              return (
                <TableRow key={item.id} className={rowClassName}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{formatQuantity(item.systemQuantity)}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-32"
                        min={0}
                        step={0.001}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(item)
                          if (e.key === 'Escape') handleCancelEdit()
                        }}
                      />
                    ) : (
                      <span
                        className={!isCompleted ? 'cursor-pointer hover:underline' : ''}
                        onClick={() => handleStartEdit(item)}
                      >
                        {formatQuantity(item.actualQuantity)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasDifference ? (
                      <Badge
                        variant="secondary"
                        className={item.difference > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                      >
                        {item.difference > 0 ? '+' : ''}{formatQuantity(item.difference)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                        0
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(item)}
                          disabled={saving}
                        >
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCancelEdit}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      !isCompleted && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStartEdit(item)}
                        >
                          编辑
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {/* 完成盘点确认弹窗 */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认完成盘点</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>完成盘点后，系统将根据实际数量更新库存。</p>
                {summary && summary.itemsWithDifference > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                    <p className="text-amber-700">
                      共有 {summary.itemsWithDifference} 个商品存在差异：
                    </p>
                    <ul className="mt-2 text-sm text-amber-600">
                      <li>盘盈: +{formatQuantity(summary.totalPositiveDifference)}</li>
                      <li>盘亏: -{formatQuantity(summary.totalNegativeDifference)}</li>
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-gray-500">此操作不可撤销，确定要完成盘点吗？</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={completing}>
              {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认完成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
