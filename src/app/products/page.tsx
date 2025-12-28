'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { toast } from 'sonner'
import { searchProductsAction, deleteProductAction } from '@/server/actions/product-actions'
import type { ProductWithRelations } from '@/server/services/product-service'
import { PageHeader, EmptyState, LoadingState } from '@/app/components'

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProductWithRelations | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const result = await searchProductsAction({
        keyword: keyword || undefined,
        location: location || undefined,
      })
      if (result.success) {
        setProducts(result.data)
      }
    } finally {
      setLoading(false)
    }
  }, [keyword, location])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleSearch = () => {
    loadProducts()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const result = await deleteProductAction(deleteTarget.id)
    if (result.success) {
      toast.success('删除成功', {
        description: `商品 ${deleteTarget.name} 已删除`,
      })
      loadProducts()
    } else {
      toast.error('删除失败', {
        description: result.error,
      })
    }
    setIsDeleteDialogOpen(false)
    setDeleteTarget(null)
  }

  const confirmDelete = (product: ProductWithRelations) => {
    setDeleteTarget(product)
    setIsDeleteDialogOpen(true)
  }

  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <PageHeader
        title="商品管理"
        description="管理店铺所有商品信息"
        icon={<Package size={24} />}
        actions={
          <Button
            onClick={() => router.push('/products/new')}
            className="font-medium shadow-md"
          >
            <Plus size={18} className="mr-2" />
            新增商品
          </Button>
        }
      />

      {/* 搜索栏 */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="keyword">关键词搜索</Label>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="keyword"
                  placeholder="商品名称、规格"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="location">存放位置</Label>
              <Input
                id="location"
                placeholder="货架号、区域"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              className="h-10 font-medium"
            >
              <Search size={18} className="mr-2" />
              搜索
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setKeyword('')
                setLocation('')
              }}
              className="h-10"
            >
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 商品列表 */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8">
              <LoadingState text="加载商品数据..." />
            </div>
          ) : products.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Package size={40} strokeWidth={1.5} />}
                title="暂无商品数据"
                description="点击右上角新增商品按钮添加第一个商品"
                action={{
                  label: '新增商品',
                  onClick: () => router.push('/products/new'),
                }}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-slate-700 font-semibold">商品编码</TableHead>
                  <TableHead className="text-slate-700 font-semibold">商品名称</TableHead>
                  <TableHead className="text-slate-700 font-semibold">规格</TableHead>
                  <TableHead className="text-slate-700 font-semibold">基本单位</TableHead>
                  <TableHead className="text-slate-700 font-semibold">零售价</TableHead>
                  <TableHead className="text-slate-700 font-semibold">进货价</TableHead>
                  <TableHead className="text-slate-700 font-semibold">存放位置</TableHead>
                  <TableHead className="text-slate-700 font-semibold">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">
                        {product.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{product.name}</TableCell>
                    <TableCell className="text-slate-600">{product.specification || '-'}</TableCell>
                    <TableCell className="text-slate-600">{product.baseUnit}</TableCell>
                    <TableCell className="text-emerald-600 font-semibold">
                      {formatPrice(product.retailPrice)}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">{formatPrice(product.purchasePrice)}</TableCell>
                    <TableCell>
                      {product.storageLocations.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {product.storageLocations.map((sl) => (
                            <Badge
                              key={sl.id}
                              variant="secondary"
                              className={sl.isPrimary ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-slate-100 text-slate-700'}
                            >
                              {sl.location?.name ?? '未知位置'}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                          onClick={() => router.push(`/products/${product.id}`)}
                        >
                          <Edit size={14} className="mr-1" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
                          onClick={() => confirmDelete(product)}
                        >
                          <Trash2 size={14} className="mr-1" />
                          删除
                        </Button>
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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除商品 <strong className="text-slate-900">{deleteTarget?.name}</strong> 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-medium">取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 font-medium">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
