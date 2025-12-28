'use server'

/**
 * 盘点管理 Server Actions
 * 提供盘点创建、录入、完成等操作
 * 需求: 2.5, 2.6, 2.7
 */
import { z } from 'zod'
import { db } from '@/server/db'
import {
  StockTakingService,
  createStockTakingService,
  StockTakingNotFoundError,
  StockTakingAlreadyCompletedError,
  ProductNotFoundError,
  InvalidQuantityError,
  StockTakingItemNotFoundError,
} from '@/server/services/stock-taking-service'
import type { StockTakingItem, StockTakingStatus, StockTakingWithItems } from '@/server/db/schema'

// ==================== Zod 验证 Schema ====================

const createStockTakingSchema = z.object({
  takingDate: z.string().datetime().optional(),
})

const recordActualQuantitySchema = z.object({
  takingId: z.string().min(1, '盘点ID不能为空'),
  productId: z.string().min(1, '商品ID不能为空'),
  actualQuantity: z.number().min(0, '实际数量不能为负数'),
})

const recordActualQuantitiesSchema = z.object({
  takingId: z.string().min(1, '盘点ID不能为空'),
  items: z.array(z.object({
    productId: z.string().min(1, '商品ID不能为空'),
    actualQuantity: z.number().min(0, '实际数量不能为负数'),
  })),
})

const completeStockTakingSchema = z.object({
  takingId: z.string().min(1, '盘点ID不能为空'),
})

const getStockTakingSchema = z.object({
  takingId: z.string().min(1, '盘点ID不能为空'),
})

const deleteStockTakingSchema = z.object({
  takingId: z.string().min(1, '盘点ID不能为空'),
})

const getStockTakingsByStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
})

// ==================== 类型定义 ====================

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

interface StockTakingDifferenceSummary {
  totalItems: number
  itemsWithDifference: number
  totalPositiveDifference: number
  totalNegativeDifference: number
}

// ==================== 辅助函数 ====================

function getZodErrorMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0]
  return firstIssue?.message ?? '验证失败'
}

function getStockTakingService(): StockTakingService {
  return createStockTakingService(db)
}

// ==================== 盘点管理 Actions ====================

/**
 * 创建盘点记录
 * 需求: 2.5
 */
export async function createStockTakingAction(
  input?: z.infer<typeof createStockTakingSchema>
): Promise<ActionResult<StockTakingWithItems>> {
  try {
    const validated = input ? createStockTakingSchema.parse(input) : {}
    const service = getStockTakingService()

    const takingDate = validated.takingDate ? new Date(validated.takingDate) : undefined
    const stockTaking = service.createStockTaking(takingDate)

    return { success: true, data: stockTaking }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('创建盘点失败:', error)
    return { success: false, error: '创建盘点失败' }
  }
}

/**
 * 记录实际盘点数量
 * 需求: 2.5, 2.6
 */
export async function recordActualQuantityAction(
  input: z.infer<typeof recordActualQuantitySchema>
): Promise<ActionResult<StockTakingItem>> {
  try {
    const validated = recordActualQuantitySchema.parse(input)
    const service = getStockTakingService()

    const item = service.recordActualQuantity(
      validated.takingId,
      validated.productId,
      validated.actualQuantity
    )

    return { success: true, data: item }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof StockTakingNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof StockTakingAlreadyCompletedError) {
      return { success: false, error: error.message }
    }
    if (error instanceof InvalidQuantityError) {
      return { success: false, error: error.message }
    }
    if (error instanceof StockTakingItemNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('记录盘点数量失败:', error)
    return { success: false, error: '记录盘点数量失败' }
  }
}

/**
 * 批量记录实际盘点数量
 * 需求: 2.5, 2.6
 */
export async function recordActualQuantitiesAction(
  input: z.infer<typeof recordActualQuantitiesSchema>
): Promise<ActionResult<StockTakingItem[]>> {
  try {
    const validated = recordActualQuantitiesSchema.parse(input)
    const service = getStockTakingService()

    const items = service.recordActualQuantities(validated.takingId, validated.items)

    return { success: true, data: items }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof StockTakingNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof StockTakingAlreadyCompletedError) {
      return { success: false, error: error.message }
    }
    if (error instanceof InvalidQuantityError) {
      return { success: false, error: error.message }
    }
    if (error instanceof StockTakingItemNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('批量记录盘点数量失败:', error)
    return { success: false, error: '批量记录盘点数量失败' }
  }
}

/**
 * 完成盘点（更新库存）
 * 需求: 2.7
 */
export async function completeStockTakingAction(
  input: z.infer<typeof completeStockTakingSchema>
): Promise<ActionResult<StockTakingWithItems>> {
  try {
    const validated = completeStockTakingSchema.parse(input)
    const service = getStockTakingService()

    const stockTaking = service.completeStockTaking(validated.takingId)

    return { success: true, data: stockTaking }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof StockTakingNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof StockTakingAlreadyCompletedError) {
      return { success: false, error: error.message }
    }
    console.error('完成盘点失败:', error)
    return { success: false, error: '完成盘点失败' }
  }
}

/**
 * 获取盘点记录详情
 */
export async function getStockTakingAction(
  input: z.infer<typeof getStockTakingSchema>
): Promise<ActionResult<StockTakingWithItems | null>> {
  try {
    const validated = getStockTakingSchema.parse(input)
    const service = getStockTakingService()

    const stockTaking = service.getStockTaking(validated.takingId)

    return { success: true, data: stockTaking }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取盘点记录失败:', error)
    return { success: false, error: '获取盘点记录失败' }
  }
}

/**
 * 获取所有盘点记录
 */
export async function getAllStockTakingsAction(): Promise<ActionResult<StockTakingWithItems[]>> {
  try {
    const service = getStockTakingService()
    const stockTakings = service.getAllStockTakings()

    return { success: true, data: stockTakings }
  } catch (error) {
    console.error('获取盘点列表失败:', error)
    return { success: false, error: '获取盘点列表失败' }
  }
}

/**
 * 获取盘点记录（按状态筛选）
 */
export async function getStockTakingsByStatusAction(
  input: z.infer<typeof getStockTakingsByStatusSchema>
): Promise<ActionResult<StockTakingWithItems[]>> {
  try {
    const validated = getStockTakingsByStatusSchema.parse(input)
    const service = getStockTakingService()

    const stockTakings = service.getStockTakingsByStatus(validated.status as StockTakingStatus)

    return { success: true, data: stockTakings }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取盘点列表失败:', error)
    return { success: false, error: '获取盘点列表失败' }
  }
}

/**
 * 删除盘点记录（仅限进行中状态）
 */
export async function deleteStockTakingAction(
  input: z.infer<typeof deleteStockTakingSchema>
): Promise<ActionResult<void>> {
  try {
    const validated = deleteStockTakingSchema.parse(input)
    const service = getStockTakingService()

    service.deleteStockTaking(validated.takingId)

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof StockTakingNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof StockTakingAlreadyCompletedError) {
      return { success: false, error: error.message }
    }
    console.error('删除盘点失败:', error)
    return { success: false, error: '删除盘点失败' }
  }
}

/**
 * 获取盘点差异汇总
 */
export async function getStockTakingDifferenceSummaryAction(
  input: z.infer<typeof getStockTakingSchema>
): Promise<ActionResult<StockTakingDifferenceSummary>> {
  try {
    const validated = getStockTakingSchema.parse(input)
    const service = getStockTakingService()

    const summary = service.getStockTakingDifferenceSummary(validated.takingId)

    return { success: true, data: summary }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof StockTakingNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('获取盘点差异汇总失败:', error)
    return { success: false, error: '获取盘点差异汇总失败' }
  }
}
