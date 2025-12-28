'use server'

/**
 * 统计报表 Server Actions
 * 提供销售统计、报表查询等操作
 * 需求: 5.3, 5.4, 5.5, 5.6
 */
import { z } from 'zod'
import { db } from '@/server/db'
import {
  StatisticsService,
  createStatisticsService,
} from '@/server/services/statistics-service'

// 重新导出类型供客户端使用
export type {
  SalesSummary,
  DailySales,
  TopSellingProduct,
  GrossProfitResult,
} from '@/server/services/statistics-service'

import type {
  SalesSummary,
  DailySales,
  TopSellingProduct,
  GrossProfitResult,
} from '@/server/services/statistics-service'

// ==================== Zod 验证 Schema ====================

const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
})

const topSellingSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  limit: z.number().int().min(1).max(100).optional().default(10),
})

const productSalesDetailSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
})

const searchHistorySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  productId: z.string().optional(),
})

// ==================== 类型定义 ====================

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ==================== 辅助函数 ====================

function getZodErrorMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0]
  return firstIssue?.message ?? '验证失败'
}

function getStatisticsService(): StatisticsService {
  return createStatisticsService(db)
}

// ==================== 统计报表 Actions ====================

/**
 * 获取销售汇总
 * 需求: 5.3 - 提供销售统计报表，显示指定时间段内的总销售额、总销售数量
 */
export async function getSalesSummaryAction(
  input: z.infer<typeof dateRangeSchema>
): Promise<ActionResult<SalesSummary>> {
  try {
    const validated = dateRangeSchema.parse(input)
    const service = getStatisticsService()
    const summary = service.getSalesSummary(validated.startDate, validated.endDate)

    return { success: true, data: summary }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取销售汇总失败:', error)
    return { success: false, error: '获取销售汇总失败' }
  }
}

/**
 * 获取每日销售统计
 * 需求: 5.5 - 提供日销售汇总，显示每日的销售额和订单数量
 */
export async function getDailySalesAction(
  input: z.infer<typeof dateRangeSchema>
): Promise<ActionResult<DailySales[]>> {
  try {
    const validated = dateRangeSchema.parse(input)
    const service = getStatisticsService()
    const dailySales = service.getDailySales(validated.startDate, validated.endDate)

    return { success: true, data: dailySales }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取每日销售统计失败:', error)
    return { success: false, error: '获取每日销售统计失败' }
  }
}

/**
 * 获取商品销售排行
 * 需求: 5.4 - 提供商品销售排行，显示销售数量最多的商品
 */
export async function getTopSellingProductsAction(
  input: z.infer<typeof topSellingSchema>
): Promise<ActionResult<TopSellingProduct[]>> {
  try {
    const validated = topSellingSchema.parse(input)
    const service = getStatisticsService()
    const topProducts = service.getTopSellingProducts(
      validated.startDate,
      validated.endDate,
      validated.limit
    )

    return { success: true, data: topProducts }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取商品销售排行失败:', error)
    return { success: false, error: '获取商品销售排行失败' }
  }
}

/**
 * 计算毛利润
 * 需求: 5.6 - 计算并显示毛利润（销售额减去进货成本）
 */
export async function calculateGrossProfitAction(
  input: z.infer<typeof dateRangeSchema>
): Promise<ActionResult<GrossProfitResult>> {
  try {
    const validated = dateRangeSchema.parse(input)
    const service = getStatisticsService()
    const profit = service.calculateGrossProfit(validated.startDate, validated.endDate)

    return { success: true, data: profit }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('计算毛利润失败:', error)
    return { success: false, error: '计算毛利润失败' }
  }
}

/**
 * 查询历史销售记录
 * 需求: 5.1, 5.2 - 记录所有已确认的销售单信息，允许查询历史销售记录
 */
export async function searchSalesHistoryAction(
  input: z.infer<typeof searchHistorySchema> = {}
): Promise<ActionResult<ReturnType<StatisticsService['searchSalesHistory']>>> {
  try {
    const validated = searchHistorySchema.parse(input)
    const service = getStatisticsService()
    const history = service.searchSalesHistory(validated)

    return { success: true, data: history }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('查询销售历史失败:', error)
    return { success: false, error: '查询销售历史失败' }
  }
}

/**
 * 获取商品销售明细
 */
export async function getProductSalesDetailAction(
  input: z.infer<typeof productSalesDetailSchema>
): Promise<ActionResult<ReturnType<StatisticsService['getProductSalesDetail']>>> {
  try {
    const validated = productSalesDetailSchema.parse(input)
    const service = getStatisticsService()
    const detail = service.getProductSalesDetail(
      validated.productId,
      validated.startDate,
      validated.endDate
    )

    return { success: true, data: detail }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取商品销售明细失败:', error)
    return { success: false, error: '获取商品销售明细失败' }
  }
}

/**
 * 获取统计概览（组合多个统计数据）
 * 便于首页或统计页面一次性获取多个统计指标
 */
export async function getStatisticsOverviewAction(
  input: z.infer<typeof dateRangeSchema>
): Promise<ActionResult<{
  summary: SalesSummary
  profit: GrossProfitResult
  topProducts: TopSellingProduct[]
}>> {
  try {
    const validated = dateRangeSchema.parse(input)
    const service = getStatisticsService()

    const summary = service.getSalesSummary(validated.startDate, validated.endDate)
    const profit = service.calculateGrossProfit(validated.startDate, validated.endDate)
    const topProducts = service.getTopSellingProducts(
      validated.startDate,
      validated.endDate,
      5
    )

    return {
      success: true,
      data: { summary, profit, topProducts },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取统计概览失败:', error)
    return { success: false, error: '获取统计概览失败' }
  }
}
