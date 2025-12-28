'use server'

/**
 * 销售管理 Server Actions
 * 提供销售单的创建、确认、查询、折扣、抹零、改价等操作
 * 需求: 4.1, 4.6, 4.10
 */
import { z } from 'zod'
import { db } from '@/server/db'
import {
  SalesService,
  createSalesService,
  SalesOrderValidationError,
  SalesOrderNotFoundError,
  ProductNotFoundError,
  UnitNotFoundError,
  OrderAlreadyConfirmedError,
  InsufficientStockError,
  ReturnOrderNotFoundError,
  ReturnQuantityExceededError,
  InvalidItemIndexError,
} from '@/server/services/sales-service'

// ==================== Zod 验证 Schema ====================

const salesOrderItemSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  quantity: z.number().positive('数量必须大于零'),
  unit: z.string().min(1, '单位不能为空'),
  unitPrice: z.number().min(0, '单价不能为负数').optional(),
})

const createSalesOrderSchema = z.object({
  customerName: z.string().optional(),
  orderDate: z.coerce.date().optional(),
  items: z.array(salesOrderItemSchema).min(1, '商品清单不能为空'),
})

const addOrderItemSchema = z.object({
  orderId: z.string().min(1, '订单ID不能为空'),
  productId: z.string().min(1, '商品ID不能为空'),
  quantity: z.number().positive('数量必须大于零'),
  unit: z.string().min(1, '单位不能为空'),
  unitPrice: z.number().min(0, '单价不能为负数').optional(),
})

const searchSalesOrdersSchema = z.object({
  customerName: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'CONFIRMED']).optional(),
})

const applyDiscountSchema = z.object({
  orderId: z.string().min(1, '订单ID不能为空'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0, '折扣值不能为负数'),
})

const applyRoundingSchema = z.object({
  orderId: z.string().min(1, '订单ID不能为空'),
  roundingAmount: z.number().min(0, '抹零金额不能为负数'),
})

const adjustItemPriceSchema = z.object({
  orderId: z.string().min(1, '订单ID不能为空'),
  itemIndex: z.number().int().min(0, '商品索引不能为负数'),
  newPrice: z.number().min(0, '新价格不能为负数'),
})

const returnItemSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  quantity: z.number().positive('数量必须大于零'),
  unit: z.string().min(1, '单位不能为空'),
  unitPrice: z.number().min(0, '单价不能为负数'),
})

const createSalesReturnSchema = z.object({
  originalOrderId: z.string().min(1, '原销售单ID不能为空'),
  items: z.array(returnItemSchema).min(1, '退货商品清单不能为空'),
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

function getSalesService(): SalesService {
  return createSalesService(db)
}

// ==================== 销售单 Actions ====================

/**
 * 创建销售单
 * 需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export async function createSalesOrderAction(
  input: z.infer<typeof createSalesOrderSchema>
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const validated = createSalesOrderSchema.parse(input)
    const service = getSalesService()
    const order = service.createSalesOrder(validated)

    return {
      success: true,
      data: { id: order.id, orderNumber: order.orderNumber },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (
      error instanceof SalesOrderValidationError ||
      error instanceof ProductNotFoundError ||
      error instanceof UnitNotFoundError ||
      error instanceof InsufficientStockError
    ) {
      return { success: false, error: error.message }
    }
    console.error('创建销售单失败:', error)
    return { success: false, error: '创建销售单失败' }
  }
}

/**
 * 添加商品到销售单
 * 需求: 4.2, 4.3, 4.4, 4.5
 */
export async function addItemToOrderAction(
  input: z.infer<typeof addOrderItemSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = addOrderItemSchema.parse(input)
    const service = getSalesService()
    const order = service.addItemToOrder(validated.orderId, {
      productId: validated.productId,
      quantity: validated.quantity,
      unit: validated.unit,
      unitPrice: validated.unitPrice,
    })

    return {
      success: true,
      data: { id: order.id },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (
      error instanceof SalesOrderNotFoundError ||
      error instanceof SalesOrderValidationError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof ProductNotFoundError ||
      error instanceof UnitNotFoundError ||
      error instanceof InsufficientStockError
    ) {
      return { success: false, error: error.message }
    }
    console.error('添加商品失败:', error)
    return { success: false, error: '添加商品失败' }
  }
}

/**
 * 确认销售单
 * 需求: 4.10
 */
export async function confirmSalesOrderAction(
  orderId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const service = getSalesService()
    const order = service.confirmSalesOrder(orderId)

    return {
      success: true,
      data: { id: order.id },
    }
  } catch (error) {
    if (
      error instanceof SalesOrderNotFoundError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof SalesOrderValidationError ||
      error instanceof InsufficientStockError ||
      error instanceof ProductNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    console.error('确认销售单失败:', error)
    return { success: false, error: '确认销售单失败' }
  }
}

/**
 * 获取销售单详情
 */
export async function getSalesOrderAction(
  orderId: string
): Promise<ActionResult<ReturnType<SalesService['getSalesOrder']>>> {
  try {
    const service = getSalesService()
    const order = service.getSalesOrder(orderId)

    if (!order) {
      return { success: false, error: '销售单不存在' }
    }

    return { success: true, data: order }
  } catch (error) {
    console.error('获取销售单失败:', error)
    return { success: false, error: '获取销售单失败' }
  }
}

/**
 * 搜索销售记录
 */
export async function searchSalesOrdersAction(
  params: z.infer<typeof searchSalesOrdersSchema> = {}
): Promise<ActionResult<ReturnType<SalesService['searchSalesOrders']>>> {
  try {
    const validated = searchSalesOrdersSchema.parse(params)
    const service = getSalesService()
    const orders = service.searchSalesOrders(validated)

    return { success: true, data: orders }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('搜索销售记录失败:', error)
    return { success: false, error: '搜索销售记录失败' }
  }
}

/**
 * 获取所有销售单
 */
export async function getAllSalesOrdersAction(): Promise<
  ActionResult<ReturnType<SalesService['getAllSalesOrders']>>
> {
  try {
    const service = getSalesService()
    const orders = service.getAllSalesOrders()

    return { success: true, data: orders }
  } catch (error) {
    console.error('获取销售单列表失败:', error)
    return { success: false, error: '获取销售单列表失败' }
  }
}

/**
 * 删除销售单（仅限待确认状态）
 */
export async function deleteSalesOrderAction(
  orderId: string
): Promise<ActionResult<void>> {
  try {
    const service = getSalesService()
    service.deleteSalesOrder(orderId)

    return { success: true, data: undefined }
  } catch (error) {
    if (
      error instanceof SalesOrderNotFoundError ||
      error instanceof SalesOrderValidationError
    ) {
      return { success: false, error: error.message }
    }
    console.error('删除销售单失败:', error)
    return { success: false, error: '删除销售单失败' }
  }
}

// ==================== 折扣和抹零 Actions ====================

/**
 * 应用折扣
 * 需求: 4.7
 */
export async function applyDiscountAction(
  input: z.infer<typeof applyDiscountSchema>
): Promise<ActionResult<{ id: string; totalAmount: number }>> {
  try {
    const validated = applyDiscountSchema.parse(input)
    const service = getSalesService()
    const order = service.applyDiscount(
      validated.orderId,
      validated.discountType,
      validated.discountValue
    )

    return {
      success: true,
      data: { id: order.id, totalAmount: order.totalAmount },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (
      error instanceof SalesOrderNotFoundError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof SalesOrderValidationError
    ) {
      return { success: false, error: error.message }
    }
    console.error('应用折扣失败:', error)
    return { success: false, error: '应用折扣失败' }
  }
}

/**
 * 应用抹零
 * 需求: 4.8
 */
export async function applyRoundingAction(
  input: z.infer<typeof applyRoundingSchema>
): Promise<ActionResult<{ id: string; totalAmount: number }>> {
  try {
    const validated = applyRoundingSchema.parse(input)
    const service = getSalesService()
    const order = service.applyRounding(validated.orderId, validated.roundingAmount)

    return {
      success: true,
      data: { id: order.id, totalAmount: order.totalAmount },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (
      error instanceof SalesOrderNotFoundError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof SalesOrderValidationError
    ) {
      return { success: false, error: error.message }
    }
    console.error('应用抹零失败:', error)
    return { success: false, error: '应用抹零失败' }
  }
}

/**
 * 调整商品单价（改价功能）
 * 需求: 4.9
 */
export async function adjustItemPriceAction(
  input: z.infer<typeof adjustItemPriceSchema>
): Promise<ActionResult<{ id: string; totalAmount: number }>> {
  try {
    const validated = adjustItemPriceSchema.parse(input)
    const service = getSalesService()
    const order = service.adjustItemPrice(
      validated.orderId,
      validated.itemIndex,
      validated.newPrice
    )

    return {
      success: true,
      data: { id: order.id, totalAmount: order.totalAmount },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (
      error instanceof SalesOrderNotFoundError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof SalesOrderValidationError ||
      error instanceof InvalidItemIndexError
    ) {
      return { success: false, error: error.message }
    }
    console.error('调整价格失败:', error)
    return { success: false, error: '调整价格失败' }
  }
}

// ==================== 销售退货 Actions ====================

/**
 * 创建销售退货单
 * 需求: 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.6
 */
export async function createSalesReturnAction(
  input: z.infer<typeof createSalesReturnSchema>
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const validated = createSalesReturnSchema.parse(input)
    const service = getSalesService()
    const returnOrder = service.createSalesReturn(
      validated.originalOrderId,
      validated.items
    )

    return {
      success: true,
      data: { id: returnOrder.id, orderNumber: returnOrder.orderNumber },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (
      error instanceof SalesOrderNotFoundError ||
      error instanceof SalesOrderValidationError ||
      error instanceof ReturnQuantityExceededError ||
      error instanceof ProductNotFoundError ||
      error instanceof UnitNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    console.error('创建销售退货单失败:', error)
    return { success: false, error: '创建销售退货单失败' }
  }
}

/**
 * 确认销售退货（入库）
 * 需求: 4.1.5, 4.1.7
 */
export async function confirmSalesReturnAction(
  returnId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const service = getSalesService()
    const returnOrder = service.confirmSalesReturn(returnId)

    return {
      success: true,
      data: { id: returnOrder.id },
    }
  } catch (error) {
    if (
      error instanceof ReturnOrderNotFoundError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof SalesOrderValidationError ||
      error instanceof ProductNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    console.error('确认销售退货失败:', error)
    return { success: false, error: '确认销售退货失败' }
  }
}

/**
 * 获取退货单详情
 */
export async function getSalesReturnOrderAction(
  returnId: string
): Promise<ActionResult<ReturnType<SalesService['getReturnOrder']>>> {
  try {
    const service = getSalesService()
    const returnOrder = service.getReturnOrder(returnId)

    if (!returnOrder) {
      return { success: false, error: '退货单不存在' }
    }

    return { success: true, data: returnOrder }
  } catch (error) {
    console.error('获取退货单失败:', error)
    return { success: false, error: '获取退货单失败' }
  }
}

/**
 * 获取销售单的所有退货记录
 */
export async function getReturnOrdersBySalesOrderAction(
  salesOrderId: string
): Promise<ActionResult<ReturnType<SalesService['getReturnOrdersBySalesOrder']>>> {
  try {
    const service = getSalesService()
    const returns = service.getReturnOrdersBySalesOrder(salesOrderId)

    return { success: true, data: returns }
  } catch (error) {
    console.error('获取退货记录失败:', error)
    return { success: false, error: '获取退货记录失败' }
  }
}
