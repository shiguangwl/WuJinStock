'use server'

/**
 * 进货管理 Server Actions
 * 提供进货单的创建、确认、查询等操作
 * 需求: 3.1, 3.6, 3.7
 */
import { z } from 'zod'
import { db } from '@/server/db'
import {
  PurchaseService,
  createPurchaseService,
  PurchaseOrderValidationError,
  PurchaseOrderNotFoundError,
  ProductNotFoundError,
  UnitNotFoundError,
  OrderAlreadyConfirmedError,
  ReturnOrderNotFoundError,
  ReturnQuantityExceededError,
  InsufficientStockError,
} from '@/server/services/purchase-service'

// ==================== Zod 验证 Schema ====================

const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  quantity: z.number().positive('数量必须大于零'),
  unit: z.string().min(1, '单位不能为空'),
  unitPrice: z.number().min(0, '单价不能为负数'),
})

const createPurchaseOrderSchema = z.object({
  supplier: z.string().min(1, '供应商不能为空'),
  orderDate: z.coerce.date().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, '商品清单不能为空'),
})

const searchPurchaseOrdersSchema = z.object({
  supplier: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'CONFIRMED']).optional(),
})

const returnItemSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  quantity: z.number().positive('数量必须大于零'),
  unit: z.string().min(1, '单位不能为空'),
  unitPrice: z.number().min(0, '单价不能为负数'),
})

const createPurchaseReturnSchema = z.object({
  originalOrderId: z.string().min(1, '原进货单ID不能为空'),
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

function getPurchaseService(): PurchaseService {
  return createPurchaseService(db)
}

// ==================== 进货单 Actions ====================

/**
 * 创建进货单
 * 需求: 3.1, 3.2, 3.3, 3.5
 */
export async function createPurchaseOrderAction(
  input: z.infer<typeof createPurchaseOrderSchema>
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const validated = createPurchaseOrderSchema.parse(input)
    const service = getPurchaseService()
    const order = service.createPurchaseOrder(validated)

    return {
      success: true,
      data: { id: order.id, orderNumber: order.orderNumber },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (
      error instanceof PurchaseOrderValidationError ||
      error instanceof ProductNotFoundError ||
      error instanceof UnitNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    console.error('创建进货单失败:', error)
    return { success: false, error: '创建进货单失败' }
  }
}

/**
 * 确认进货单（入库）
 * 需求: 3.4, 3.7
 */
export async function confirmPurchaseOrderAction(
  orderId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const service = getPurchaseService()
    const order = service.confirmPurchaseOrder(orderId)

    return {
      success: true,
      data: { id: order.id },
    }
  } catch (error) {
    if (
      error instanceof PurchaseOrderNotFoundError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof ProductNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    console.error('确认进货单失败:', error)
    return { success: false, error: '确认进货单失败' }
  }
}

/**
 * 获取进货单详情
 * 需求: 3.7
 */
export async function getPurchaseOrderAction(
  orderId: string
): Promise<ActionResult<ReturnType<PurchaseService['getPurchaseOrder']>>> {
  try {
    const service = getPurchaseService()
    const order = service.getPurchaseOrder(orderId)

    if (!order) {
      return { success: false, error: '进货单不存在' }
    }

    return { success: true, data: order }
  } catch (error) {
    console.error('获取进货单失败:', error)
    return { success: false, error: '获取进货单失败' }
  }
}

/**
 * 搜索进货记录
 * 需求: 3.6
 */
export async function searchPurchaseOrdersAction(
  params: z.infer<typeof searchPurchaseOrdersSchema> = {}
): Promise<ActionResult<ReturnType<PurchaseService['searchPurchaseOrders']>>> {
  try {
    const validated = searchPurchaseOrdersSchema.parse(params)
    const service = getPurchaseService()
    const orders = service.searchPurchaseOrders(validated)

    return { success: true, data: orders }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('搜索进货记录失败:', error)
    return { success: false, error: '搜索进货记录失败' }
  }
}

/**
 * 获取所有进货单
 */
export async function getAllPurchaseOrdersAction(): Promise<
  ActionResult<ReturnType<PurchaseService['getAllPurchaseOrders']>>
> {
  try {
    const service = getPurchaseService()
    const orders = service.getAllPurchaseOrders()

    return { success: true, data: orders }
  } catch (error) {
    console.error('获取进货单列表失败:', error)
    return { success: false, error: '获取进货单列表失败' }
  }
}

/**
 * 删除进货单（仅限待确认状态）
 */
export async function deletePurchaseOrderAction(
  orderId: string
): Promise<ActionResult<void>> {
  try {
    const service = getPurchaseService()
    service.deletePurchaseOrder(orderId)

    return { success: true, data: undefined }
  } catch (error) {
    if (
      error instanceof PurchaseOrderNotFoundError ||
      error instanceof PurchaseOrderValidationError
    ) {
      return { success: false, error: error.message }
    }
    console.error('删除进货单失败:', error)
    return { success: false, error: '删除进货单失败' }
  }
}

// ==================== 进货退货 Actions ====================

/**
 * 创建进货退货单
 * 需求: 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.6
 */
export async function createPurchaseReturnAction(
  input: z.infer<typeof createPurchaseReturnSchema>
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const validated = createPurchaseReturnSchema.parse(input)
    const service = getPurchaseService()
    const returnOrder = service.createPurchaseReturn(
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
      error instanceof PurchaseOrderNotFoundError ||
      error instanceof PurchaseOrderValidationError ||
      error instanceof ReturnQuantityExceededError ||
      error instanceof ProductNotFoundError ||
      error instanceof UnitNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    console.error('创建进货退货单失败:', error)
    return { success: false, error: '创建进货退货单失败' }
  }
}

/**
 * 确认进货退货（出库）
 * 需求: 3.1.5, 3.1.7
 */
export async function confirmPurchaseReturnAction(
  returnId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const service = getPurchaseService()
    const returnOrder = service.confirmPurchaseReturn(returnId)

    return {
      success: true,
      data: { id: returnOrder.id },
    }
  } catch (error) {
    if (
      error instanceof ReturnOrderNotFoundError ||
      error instanceof OrderAlreadyConfirmedError ||
      error instanceof PurchaseOrderValidationError ||
      error instanceof InsufficientStockError ||
      error instanceof ProductNotFoundError
    ) {
      return { success: false, error: error.message }
    }
    console.error('确认进货退货失败:', error)
    return { success: false, error: '确认进货退货失败' }
  }
}

/**
 * 获取退货单详情
 */
export async function getReturnOrderAction(
  returnId: string
): Promise<ActionResult<ReturnType<PurchaseService['getReturnOrder']>>> {
  try {
    const service = getPurchaseService()
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
 * 获取进货单的所有退货记录
 */
export async function getReturnOrdersByPurchaseOrderAction(
  purchaseOrderId: string
): Promise<ActionResult<ReturnType<PurchaseService['getReturnOrdersByPurchaseOrder']>>> {
  try {
    const service = getPurchaseService()
    const returns = service.getReturnOrdersByPurchaseOrder(purchaseOrderId)

    return { success: true, data: returns }
  } catch (error) {
    console.error('获取退货记录失败:', error)
    return { success: false, error: '获取退货记录失败' }
  }
}
