'use server'

/**
 * 库存管理 Server Actions
 * 提供库存查询、预警、变动历史等操作
 * 需求: 2.1, 2.3, 2.4, 2.8
 */
import { z } from 'zod'
import { db } from '@/server/db'
import { 
  InventoryService, 
  createInventoryService, 
  ProductNotFoundError,
  UnitNotFoundError,
  InsufficientStockError,
  InvalidQuantityError,
} from '@/server/services/inventory-service'
import type { 
  InventoryWithProduct,
  LowStockProduct,
  InventoryTransactionWithProduct,
} from '@/server/services/inventory-service'
import type { InventoryRecord, TransactionType } from '@/server/db/schema'

// ==================== Zod 验证 Schema ====================

const adjustInventorySchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  quantityChange: z.number(),
  transactionType: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN']),
  unit: z.string().min(1, '单位不能为空'),
  referenceId: z.string().optional(),
  note: z.string().optional(),
})

const setInventorySchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  quantity: z.number().min(0, '库存数量不能为负数'),
  note: z.string().optional(),
})

const getTransactionsSchema = z.object({
  productId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  transactionType: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN']).optional(),
})

const checkStockSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  quantity: z.number().positive('数量必须大于零'),
  unit: z.string().min(1, '单位不能为空'),
})

const batchCheckStockSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
  })),
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

function getInventoryService(): InventoryService {
  return createInventoryService(db)
}

// ==================== 库存查询 Actions ====================

/**
 * 获取商品库存
 * 需求: 2.1
 */
export async function getInventoryAction(
  productId: string
): Promise<ActionResult<InventoryRecord | null>> {
  try {
    const service = getInventoryService()
    const inventory = service.getInventory(productId)
    return { success: true, data: inventory }
  } catch (error) {
    console.error('获取库存失败:', error)
    return { success: false, error: '获取库存失败' }
  }
}

/**
 * 获取商品库存（带商品信息）
 * 需求: 2.1
 */
export async function getInventoryWithProductAction(
  productId: string
): Promise<ActionResult<InventoryWithProduct | null>> {
  try {
    const service = getInventoryService()
    const inventory = service.getInventoryWithProduct(productId)
    return { success: true, data: inventory }
  } catch (error) {
    console.error('获取库存失败:', error)
    return { success: false, error: '获取库存失败' }
  }
}

/**
 * 获取所有库存记录
 * 需求: 2.1
 */
export async function getAllInventoryAction(): Promise<ActionResult<InventoryWithProduct[]>> {
  try {
    const service = getInventoryService()
    const inventory = service.getAllInventory()
    return { success: true, data: inventory }
  } catch (error) {
    console.error('获取库存列表失败:', error)
    return { success: false, error: '获取库存列表失败' }
  }
}

/**
 * 获取低库存商品列表
 * 需求: 2.3, 2.4
 */
export async function getLowStockProductsAction(): Promise<ActionResult<LowStockProduct[]>> {
  try {
    const service = getInventoryService()
    const lowStockProducts = service.getLowStockProducts()
    return { success: true, data: lowStockProducts }
  } catch (error) {
    console.error('获取低库存商品失败:', error)
    return { success: false, error: '获取低库存商品失败' }
  }
}

/**
 * 检查商品是否为低库存
 * 需求: 2.3
 */
export async function isLowStockAction(
  productId: string
): Promise<ActionResult<boolean>> {
  try {
    const service = getInventoryService()
    const isLow = service.isLowStock(productId)
    return { success: true, data: isLow }
  } catch (error) {
    console.error('检查低库存失败:', error)
    return { success: false, error: '检查低库存失败' }
  }
}

// ==================== 库存调整 Actions ====================

/**
 * 调整库存
 * 需求: 2.8
 */
export async function adjustInventoryAction(
  input: z.infer<typeof adjustInventorySchema>
): Promise<ActionResult<InventoryRecord>> {
  try {
    const validated = adjustInventorySchema.parse(input)
    const service = getInventoryService()
    
    const inventory = service.adjustInventory({
      productId: validated.productId,
      quantityChange: validated.quantityChange,
      transactionType: validated.transactionType as TransactionType,
      unit: validated.unit,
      referenceId: validated.referenceId,
      note: validated.note,
    })
    
    return { success: true, data: inventory }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof UnitNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof InsufficientStockError) {
      return { success: false, error: error.message }
    }
    console.error('调整库存失败:', error)
    return { success: false, error: '调整库存失败' }
  }
}

/**
 * 设置库存数量（用于盘点）
 */
export async function setInventoryQuantityAction(
  input: z.infer<typeof setInventorySchema>
): Promise<ActionResult<InventoryRecord>> {
  try {
    const validated = setInventorySchema.parse(input)
    const service = getInventoryService()
    
    const inventory = service.setInventoryQuantity(
      validated.productId,
      validated.quantity,
      validated.note
    )
    
    return { success: true, data: inventory }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof InvalidQuantityError) {
      return { success: false, error: error.message }
    }
    console.error('设置库存失败:', error)
    return { success: false, error: '设置库存失败' }
  }
}

// ==================== 库存变动历史 Actions ====================

/**
 * 获取库存变动历史
 * 需求: 2.8
 */
export async function getInventoryTransactionsAction(
  params: z.infer<typeof getTransactionsSchema> = {}
): Promise<ActionResult<InventoryTransactionWithProduct[]>> {
  try {
    const validated = getTransactionsSchema.parse(params)
    const service = getInventoryService()
    
    const transactions = service.getInventoryTransactions({
      productId: validated.productId,
      startDate: validated.startDate ? new Date(validated.startDate) : undefined,
      endDate: validated.endDate ? new Date(validated.endDate) : undefined,
      transactionType: validated.transactionType as TransactionType | undefined,
    })
    
    return { success: true, data: transactions }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('获取库存变动历史失败:', error)
    return { success: false, error: '获取库存变动历史失败' }
  }
}

// ==================== 库存充足性检查 Actions ====================

/**
 * 检查库存是否充足
 * 需求: 4.4, 4.5
 */
export async function checkStockAvailabilityAction(
  input: z.infer<typeof checkStockSchema>
): Promise<ActionResult<boolean>> {
  try {
    const validated = checkStockSchema.parse(input)
    const service = getInventoryService()
    
    const available = service.checkStockAvailability(
      validated.productId,
      new (await import('decimal.js')).default(validated.quantity),
      validated.unit
    )
    
    return { success: true, data: available }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof UnitNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('检查库存充足性失败:', error)
    return { success: false, error: '检查库存充足性失败' }
  }
}

/**
 * 批量检查库存充足性
 */
export async function batchCheckStockAvailabilityAction(
  input: z.infer<typeof batchCheckStockSchema>
): Promise<ActionResult<Array<{ productId: string; available: boolean; shortage?: number }>>> {
  try {
    const validated = batchCheckStockSchema.parse(input)
    const service = getInventoryService()
    
    const results = service.checkBatchStockAvailability(validated.items)
    
    return { success: true, data: results }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('批量检查库存失败:', error)
    return { success: false, error: '批量检查库存失败' }
  }
}

// ==================== 单位换算 Actions ====================

/**
 * 获取商品的可用单位列表
 */
export async function getAvailableUnitsAction(
  productId: string
): Promise<ActionResult<string[]>> {
  try {
    const service = getInventoryService()
    const units = service.getAvailableUnits(productId)
    return { success: true, data: units }
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('获取可用单位失败:', error)
    return { success: false, error: '获取可用单位失败' }
  }
}

/**
 * 获取可用库存数量（指定单位）
 */
export async function getAvailableQuantityAction(
  productId: string,
  unit: string
): Promise<ActionResult<number>> {
  try {
    const service = getInventoryService()
    const quantity = service.getAvailableQuantity(productId, unit)
    return { success: true, data: quantity.toNumber() }
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    if (error instanceof UnitNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('获取可用库存失败:', error)
    return { success: false, error: '获取可用库存失败' }
  }
}
