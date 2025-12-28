'use client'

/**
 * 新建盘点页面
 * 需求: 7.1 - 提供清晰的导航菜单
 * 需求: 7.2 - 在执行操作后提供明确的成功或失败反馈
 * 需求: 2.5 - 支持库存盘点功能
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createStockTakingAction } from '@/server/actions/stock-taking-actions'

export default function NewStockTakingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const result = await createStockTakingAction()
      if (result.success) {
        toast.success('盘点创建成功')
        router.push(`/stock-taking/${result.data.id}`)
      } else {
        toast.error('创建失败', { description: result.error })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/stock-taking')}
            size="sm"
          >
            ← 返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">新建盘点</h1>
        <p className="text-slate-600 mt-1">创建新的库存盘点记录</p>
      </div>

      <Card className="shadow-sm border-0">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">创建新的盘点记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-gray-600">
            <p className="mb-4">
              创建盘点后，系统将自动记录所有商品的当前库存数量作为系统数量。
            </p>
            <p className="mb-4">
              您可以在盘点详情页面录入每个商品的实际数量，系统会自动计算差异。
            </p>
            <p>
              完成盘点后，系统将根据实际数量更新库存。
            </p>
          </div>

          <div className="flex justify-end gap-4 mt-4">
            <Button
              variant="secondary"
              onClick={() => router.push('/stock-taking')}
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="bg-gradient-to-r from-green-500 to-green-600 shadow-md"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              开始盘点
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
