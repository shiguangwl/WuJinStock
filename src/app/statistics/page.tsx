'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  getSalesSummaryAction,
  getDailySalesAction,
  getTopSellingProductsAction,
  calculateGrossProfitAction,
} from '@/server/actions/statistics-actions'
import type {
  SalesSummary,
  DailySales,
  TopSellingProduct,
  GrossProfitResult,
} from '@/server/services/statistics-service'
import { LoadingState, PageHeader } from '@/app/components'
import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

function getDefaultDateRange() {
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { startDate, endDate }
}

function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

function formatQuantity(quantity: number): string {
  return quantity.toFixed(2)
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  
  const defaultRange = getDefaultDateRange()
  const [startDate, setStartDate] = useState<Date | undefined>(defaultRange.startDate)
  const [endDate, setEndDate] = useState<Date | undefined>(defaultRange.endDate)
  
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [profit, setProfit] = useState<GrossProfitResult | null>(null)
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([])

  const loadStatistics = useCallback(async () => {
    if (!startDate || !endDate) return
    
    setLoading(true)
    try {
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      const [summaryResult, profitResult, dailyResult, topResult] = await Promise.all([
        getSalesSummaryAction({ startDate: start, endDate: end }),
        calculateGrossProfitAction({ startDate: start, endDate: end }),
        getDailySalesAction({ startDate: start, endDate: end }),
        getTopSellingProductsAction({ startDate: start, endDate: end, limit: 10 }),
      ])

      if (summaryResult.success) setSummary(summaryResult.data)
      if (profitResult.success) setProfit(profitResult.data)
      if (dailyResult.success) setDailySales(dailyResult.data)
      if (topResult.success) setTopProducts(topResult.data)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    loadStatistics()
  }, [loadStatistics])

  const handleSearch = () => {
    loadStatistics()
  }

  const setQuickDateRange = (type: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date()
    let start: Date
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    switch (type) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        const dayOfWeek = now.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        break
      case 'year':
        start = new Date(now.getFullYear(), 0, 1)
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
        break
    }

    setStartDate(start)
    setEndDate(end)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="统计报表"
        description="查看销售数据和业绩分析"
      />

      {/* 日期筛选 */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-40">
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

            <div className="w-40">
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

            <Button onClick={handleSearch} className="h-9">
              查询
            </Button>

            <Separator orientation="vertical" className="h-9" />

            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setQuickDateRange('today')}>
                今日
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setQuickDateRange('week')}>
                本周
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setQuickDateRange('month')}>
                本月
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setQuickDateRange('year')}>
                本年
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-b border-slate-200 bg-transparent p-0 h-auto">
          <TabsTrigger
            value="overview"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            概览
          </TabsTrigger>
          <TabsTrigger
            value="daily"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            日销售统计
          </TabsTrigger>
          <TabsTrigger
            value="ranking"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            商品排行
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingState text="加载中..." />
          </div>
        ) : (
          <>
            {/* 概览 */}
            <TabsContent value="overview" className="mt-6">
              <div className="space-y-6">
                {/* 销售汇总卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="shadow-sm border border-slate-200">
                    <CardContent className="text-center p-6">
                      <p className="text-sm text-slate-500 mb-2">总销售额</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {formatCurrency(summary?.totalSales ?? 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border border-slate-200">
                    <CardContent className="text-center p-6">
                      <p className="text-sm text-slate-500 mb-2">订单数量</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {summary?.totalOrders ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border border-slate-200">
                    <CardContent className="text-center p-6">
                      <p className="text-sm text-slate-500 mb-2">销售数量</p>
                      <p className="text-3xl font-bold text-amber-600">
                        {formatQuantity(summary?.totalQuantity ?? 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border border-slate-200">
                    <CardContent className="text-center p-6">
                      <p className="text-sm text-slate-500 mb-2">平均客单价</p>
                      <p className="text-3xl font-bold text-violet-600">
                        {formatCurrency(
                          summary?.totalOrders
                            ? (summary.totalSales / summary.totalOrders)
                            : 0
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* 毛利润卡片 */}
                <Card className="shadow-sm border border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl text-slate-800">利润分析</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <p className="text-sm text-slate-500 mb-2">销售额</p>
                        <p className="text-2xl font-bold text-slate-800">
                          {formatCurrency(profit?.totalSales ?? 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-500 mb-2">成本</p>
                        <p className="text-2xl font-bold text-rose-600">
                          {formatCurrency(profit?.totalCost ?? 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-500 mb-2">毛利润</p>
                        <p className={`text-2xl font-bold ${(profit?.grossProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(profit?.grossProfit ?? 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-500 mb-2">毛利率</p>
                        <p className={`text-2xl font-bold ${(profit?.profitMargin ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatPercent(profit?.profitMargin ?? 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 热销商品 */}
                <Card className="shadow-sm border border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl text-slate-800">热销商品 TOP 5</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {topProducts.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <div className="text-4xl mb-2">📊</div>
                        <p>暂无销售数据</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="font-semibold text-slate-600">排名</TableHead>
                            <TableHead className="font-semibold text-slate-600">商品名称</TableHead>
                            <TableHead className="font-semibold text-slate-600">规格</TableHead>
                            <TableHead className="font-semibold text-slate-600">销售数量</TableHead>
                            <TableHead className="font-semibold text-slate-600">销售额</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topProducts.slice(0, 5).map((item, index) => (
                            <TableRow key={item.product.id} className="hover:bg-slate-50">
                              <TableCell>
                                <Badge
                                  className={index < 3 ? 'bg-amber-500 text-white hover:bg-amber-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}
                                >
                                  {index + 1}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-slate-800">
                                {item.product.name}
                              </TableCell>
                              <TableCell className="text-slate-600">
                                {item.product.specification || '-'}
                              </TableCell>
                              <TableCell className="text-slate-600">
                                {formatQuantity(item.quantity)} {item.product.baseUnit}
                              </TableCell>
                              <TableCell className="font-medium text-emerald-600">
                                {formatCurrency(item.sales)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 日销售统计 */}
            <TabsContent value="daily" className="mt-6">
              <Card className="shadow-sm border border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl text-slate-800">日销售汇总</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {dailySales.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <div className="text-4xl mb-2">📅</div>
                      <p>暂无销售数据</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold text-slate-600">日期</TableHead>
                          <TableHead className="font-semibold text-slate-600">销售额</TableHead>
                          <TableHead className="font-semibold text-slate-600">订单数</TableHead>
                          <TableHead className="font-semibold text-slate-600">平均客单价</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailySales.map((day) => (
                          <TableRow key={day.date} className="hover:bg-slate-50">
                            <TableCell>
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                {day.date}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-emerald-600">
                              {formatCurrency(day.sales)}
                            </TableCell>
                            <TableCell className="text-slate-600">{day.orders}</TableCell>
                            <TableCell className="text-slate-600">
                              {formatCurrency(day.orders > 0 ? day.sales / day.orders : 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 商品排行 */}
            <TabsContent value="ranking" className="mt-6">
              <Card className="shadow-sm border border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl text-slate-800">商品销售排行 TOP 10</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topProducts.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <div className="text-4xl mb-2">🏆</div>
                      <p>暂无销售数据</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold text-slate-600">排名</TableHead>
                          <TableHead className="font-semibold text-slate-600">商品编码</TableHead>
                          <TableHead className="font-semibold text-slate-600">商品名称</TableHead>
                          <TableHead className="font-semibold text-slate-600">规格</TableHead>
                          <TableHead className="font-semibold text-slate-600">销售数量</TableHead>
                          <TableHead className="font-semibold text-slate-600">单位</TableHead>
                          <TableHead className="font-semibold text-slate-600">销售额</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProducts.map((item, index) => (
                          <TableRow key={item.product.id} className="hover:bg-slate-50">
                            <TableCell>
                              <Badge
                                className={index < 3 ? 'bg-amber-500 text-white hover:bg-amber-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}
                              >
                                {index + 1}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                {item.product.code}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-slate-800">
                              {item.product.name}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {item.product.specification || '-'}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {formatQuantity(item.quantity)}
                            </TableCell>
                            <TableCell className="text-slate-600">{item.product.baseUnit}</TableCell>
                            <TableCell className="font-medium text-emerald-600">
                              {formatCurrency(item.sales)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
