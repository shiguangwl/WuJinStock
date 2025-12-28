'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BarChart3, Search, Eye, AlertTriangle } from 'lucide-react'
import {
  getAllInventoryAction,
  getLowStockProductsAction,
  getInventoryTransactionsAction,
} from '@/server/actions/inventory-actions'
import type {
  InventoryWithProduct,
  LowStockProduct,
  InventoryTransactionWithProduct,
} from '@/server/services/inventory-service'
import { PageHeader, EmptyState, LoadingState } from '@/app/components'

const transactionTypeMap: Record<string, { label: string; color: string }> = {
  PURCHASE: { label: '进货', color: 'bg-emerald-100 text-emerald-700' },
  SALE: { label: '销售', color: 'bg-rose-100 text-rose-700' },
  ADJUSTMENT: { label: '盘点调整', color: 'bg-amber-100 text-amber-700' },
  RETURN: { label: '退货', color: 'bg-blue-100 text-blue-700' },
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [inventory, setInventory] = useState<InventoryWithProduct[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([])
  const [transactions, setTransactions] = useState<InventoryTransactionWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [productTransactions, setProductTransactions] = useState<InventoryTransactionWithProduct[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)

  const loadInventory = useCallback(async () => {
    setLoading(true)
    try {
      const [inventoryResult, lowStockResult] = await Promise.all([
        getAllInventoryAction(),
        getLowStockProductsAction(),
      ])
      
      if (inventoryResult.success) {
        setInventory(inventoryResult.data)
      }
      if (lowStockResult.success) {
        setLowStockProducts(lowStockResult.data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getInventoryTransactionsAction({})
      if (result.success) {
        setTransactions(result.data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'all' || activeTab === 'lowStock') {
      loadInventory()
    } else if (activeTab === 'history') {
      loadTransactions()
    }
  }, [activeTab, loadInventory, loadTransactions])

  const handleViewHistory = async (productId: string) => {
    setTransactionsLoading(true)
    setIsDialogOpen(true)

    try {
      const result = await getInventoryTransactionsAction({ productId })
      if (result.success) {
        setProductTransactions(result.data)
      }
    } finally {
      setTransactionsLoading(false)
    }
  }

  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(2)
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredInventory = inventory.filter((item) => {
    if (!keyword) return true
    const searchTerm = keyword.toLowerCase()
    return (
      item.product.name.toLowerCase().includes(searchTerm) ||
      item.product.code.toLowerCase().includes(searchTerm) ||
      (item.product.specification?.toLowerCase().includes(searchTerm) ?? false)
    )
  })

  const isLowStock = (productId: string) => {
    return lowStockProducts.some((item) => item.product.id === productId)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <PageHeader
        title="库存管理"
        description="实时查看库存状态"
        icon={<BarChart3 size={24} />}
        actions={
          lowStockProducts.length > 0 && (
            <Badge className="bg-rose-100 text-rose-700 font-medium px-3 py-1.5 text-sm">
              <AlertTriangle size={18} className="mr-1.5" />
              {lowStockProducts.length} 个商品库存不足
            </Badge>
          )
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-6 bg-transparent border-b border-slate-200 rounded-none h-auto p-0">
          <TabsTrigger
            value="all"
            className="px-0 py-3 font-medium data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none bg-transparent"
          >
            全部库存
          </TabsTrigger>
          <TabsTrigger
            value="lowStock"
            className="px-0 py-3 font-medium data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none bg-transparent"
          >
            <div className="flex items-center gap-2">
              库存预警
              {lowStockProducts.length > 0 && (
                <Badge className="bg-rose-500 text-white font-semibold px-2 py-0.5 text-xs">
                  {lowStockProducts.length}
                </Badge>
              )}
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="px-0 py-3 font-medium data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none bg-transparent"
          >
            变动历史
          </TabsTrigger>
        </TabsList>

        {/* 全部库存 */}
        <TabsContent value="all" className="space-y-4 mt-6">
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="search">搜索商品</Label>
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="search"
                      placeholder="商品名称、编码、规格"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button variant="outline" onClick={() => setKeyword('')} className="h-10">
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8">
                  <LoadingState text="加载库存数据..." />
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={<BarChart3 size={40} strokeWidth={1.5} />}
                    title="暂无库存数据"
                    description="暂时没有商品库存信息"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-slate-700 font-semibold">商品编码</TableHead>
                      <TableHead className="text-slate-700 font-semibold">商品名称</TableHead>
                      <TableHead className="text-slate-700 font-semibold">规格</TableHead>
                      <TableHead className="text-slate-700 font-semibold">当前库存</TableHead>
                      <TableHead className="text-slate-700 font-semibold">单位</TableHead>
                      <TableHead className="text-slate-700 font-semibold">最低库存</TableHead>
                      <TableHead className="text-slate-700 font-semibold">状态</TableHead>
                      <TableHead className="text-slate-700 font-semibold">最后更新</TableHead>
                      <TableHead className="text-slate-700 font-semibold">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => {
                      const lowStock = isLowStock(item.product.id)
                      return (
                        <TableRow
                          key={item.inventory.id}
                          className={lowStock ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50'}
                        >
                          <TableCell>
                            <Badge variant="secondary" className="bg-slate-100">
                              {item.product.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">{item.product.name}</TableCell>
                          <TableCell className="text-slate-600">{item.product.specification || '-'}</TableCell>
                          <TableCell>
                            <span className={lowStock ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                              {formatQuantity(item.inventory.quantity)}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600">{item.product.baseUnit}</TableCell>
                          <TableCell className="text-slate-600">{formatQuantity(item.product.minStockThreshold ?? 0)}</TableCell>
                          <TableCell>
                            {lowStock ? (
                              <Badge className="bg-rose-100 text-rose-700">
                                库存不足
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                正常
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">
                            {formatDate(item.inventory.lastUpdated)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                              onClick={() => handleViewHistory(item.product.id)}
                            >
                              <Eye size={14} className="mr-1" />
                              变动历史
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 库存预警 */}
        <TabsContent value="lowStock" className="space-y-4 mt-6">
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8">
                  <LoadingState text="加载预警数据..." />
                </div>
              ) : lowStockProducts.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={<AlertTriangle size={40} strokeWidth={1.5} />}
                    title="暂无库存预警"
                    description="所有商品库存充足"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-slate-700 font-semibold">商品编码</TableHead>
                      <TableHead className="text-slate-700 font-semibold">商品名称</TableHead>
                      <TableHead className="text-slate-700 font-semibold">规格</TableHead>
                      <TableHead className="text-slate-700 font-semibold">当前库存</TableHead>
                      <TableHead className="text-slate-700 font-semibold">最低库存</TableHead>
                      <TableHead className="text-slate-700 font-semibold">缺口数量</TableHead>
                      <TableHead className="text-slate-700 font-semibold">单位</TableHead>
                      <TableHead className="text-slate-700 font-semibold">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((item) => (
                      <TableRow key={item.product.id} className="bg-rose-50 hover:bg-rose-100">
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100">
                            {item.product.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{item.product.name}</TableCell>
                        <TableCell className="text-slate-600">{item.product.specification || '-'}</TableCell>
                        <TableCell>
                          <span className="text-rose-600 font-bold">
                            {formatQuantity(item.inventory.quantity)}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600">{formatQuantity(item.product.minStockThreshold ?? 0)}</TableCell>
                        <TableCell>
                          <Badge className="bg-rose-500 text-white">
                            -{formatQuantity(item.deficit)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">{item.product.baseUnit}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-slate-100 hover:bg-slate-200"
                            onClick={() => handleViewHistory(item.product.id)}
                          >
                            变动历史
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 变动历史 */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8">
                  <LoadingState text="加载变动记录..." />
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={<BarChart3 size={40} strokeWidth={1.5} />}
                    title="暂无变动记录"
                    description="还没有库存变动历史"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-slate-700 font-semibold">时间</TableHead>
                      <TableHead className="text-slate-700 font-semibold">商品</TableHead>
                      <TableHead className="text-slate-700 font-semibold">类型</TableHead>
                      <TableHead className="text-slate-700 font-semibold">数量变化</TableHead>
                      <TableHead className="text-slate-700 font-semibold">单位</TableHead>
                      <TableHead className="text-slate-700 font-semibold">关联单据</TableHead>
                      <TableHead className="text-slate-700 font-semibold">备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const typeInfo = transactionTypeMap[tx.transactionType] ?? {
                        label: tx.transactionType,
                        color: 'bg-slate-100 text-slate-700',
                      }
                      return (
                        <TableRow key={tx.id} className="hover:bg-slate-50">
                          <TableCell className="text-slate-500 text-sm">{formatDate(tx.timestamp)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-slate-800">{tx.product?.name ?? '未知商品'}</div>
                              <div className="text-xs text-slate-400">{tx.product?.code}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={tx.quantityChange > 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                              {tx.quantityChange > 0 ? '+' : ''}{formatQuantity(tx.quantityChange)}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600">{tx.unit}</TableCell>
                          <TableCell>
                            {tx.referenceId ? (
                              <Badge variant="secondary" className="bg-slate-100">
                                {tx.referenceId}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">{tx.note || '-'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 商品变动历史弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-800">库存变动历史</DialogTitle>
            <DialogDescription>查看该商品的库存变动记录</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {transactionsLoading ? (
              <LoadingState text="加载变动记录..." className="py-8" />
            ) : productTransactions.length === 0 ? (
              <EmptyState
                icon={<BarChart3 size={32} strokeWidth={1.5} />}
                title="暂无变动记录"
                description="该商品暂无库存变动历史"
              />
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-slate-600 font-semibold">时间</TableHead>
                      <TableHead className="text-slate-600 font-semibold">类型</TableHead>
                      <TableHead className="text-slate-600 font-semibold">数量变化</TableHead>
                      <TableHead className="text-slate-600 font-semibold">单位</TableHead>
                      <TableHead className="text-slate-600 font-semibold">关联单据</TableHead>
                      <TableHead className="text-slate-600 font-semibold">备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productTransactions.map((tx) => {
                      const typeInfo = transactionTypeMap[tx.transactionType] ?? {
                        label: tx.transactionType,
                        color: 'bg-slate-100 text-slate-700',
                      }
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-slate-500 text-sm">{formatDate(tx.timestamp)}</TableCell>
                          <TableCell>
                            <Badge className={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={tx.quantityChange > 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                              {tx.quantityChange > 0 ? '+' : ''}{formatQuantity(tx.quantityChange)}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600">{tx.unit}</TableCell>
                          <TableCell>
                            {tx.referenceId ? (
                              <Badge variant="secondary" className="bg-slate-100">
                                {tx.referenceId}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">{tx.note || '-'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
