/**
 * 进货服务层
 * 实现进货单的创建、确认、查询等核心业务逻辑
 * 需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'
import {
  products,
  packageUnits,
  purchaseOrders,
  purchaseOrderItems,
  inventoryRecords,
  inventoryTransactions,
  returnOrders,
  returnOrderItems,
  type Product,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type ReturnOrder,
  type ReturnOrderItem,
  type OrderStatus,
} from '@/server/db/schema'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { eq, and, gte, lte, like, inArray, desc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import Decimal from 'decimal.js'

// ==================== 类型定义 ====================

type DbSchema = typeof schema & typeof relations
type DbType = BetterSQLite3Database<DbSchema>

export interface CreatePurchaseOrderInput {
  supplier: string
  orderDate?: Date
  items: PurchaseOrderItemInput[]
}

export interface PurchaseOrderItemInput {
  productId: string
  quantity: number
  unit: string
  unitPrice: number
}

export interface SearchPurchaseOrdersParams {
  supplier?: string
  startDate?: Date
  endDate?: Date
  status?: OrderStatus
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[]
}

export interface ReturnItemInput {
  productId: string
  quantity: number
  unit: string
  unitPrice: number
}

export interface ReturnOrderWithItems extends ReturnOrder {
  items: ReturnOrderItem[]
}

// ==================== 错误类型 ====================

export class PurchaseOrderValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PurchaseOrderValidationError'
  }
}

export class PurchaseOrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`进货单不存在: ${orderId}`)
    this.name = 'PurchaseOrderNotFoundError'
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`商品不存在: ${productId}`)
    this.name = 'ProductNotFoundError'
  }
}

export class UnitNotFoundError extends Error {
  constructor(productId: string, unitName: string) {
    super(`单位不存在: ${unitName} (商品ID: ${productId})`)
    this.name = 'UnitNotFoundError'
  }
}

export class OrderAlreadyConfirmedError extends Error {
  constructor(orderId: string) {
    super(`进货单已确认，无法重复操作: ${orderId}`)
    this.name = 'OrderAlreadyConfirmedError'
  }
}

export class ReturnOrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`退货单不存在: ${orderId}`)
    this.name = 'ReturnOrderNotFoundError'
  }
}

export class ReturnQuantityExceededError extends Error {
  constructor(productId: string, maxQuantity: number, requestedQuantity: number) {
    super(`退货数量超出限制: 最大可退 ${maxQuantity}，请求退货 ${requestedQuantity} (商品ID: ${productId})`)
    this.name = 'ReturnQuantityExceededError'
  }
}

export class InsufficientStockError extends Error {
  constructor(productId: string, required: number, available: number) {
    super(`库存不足: 需要 ${required}，可用 ${available} (商品ID: ${productId})`)
    this.name = 'InsufficientStockError'
  }
}

// ==================== 进货服务类 ====================

export class PurchaseService {
  private db: DbType

  constructor(db: DbType) {
    this.db = db
  }

  // ==================== 订单号生成 ====================

  /**
   * 生成唯一的进货单号
   * 格式: PO + 年月日 + 4位序号
   */
  generateOrderNumber(): string {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `PO${dateStr}${random}`
  }

  /**
   * 生成唯一的退货单号
   * 格式: PR + 年月日 + 4位序号
   */
  generateReturnOrderNumber(): string {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `PR${dateStr}${random}`
  }

  // ==================== 单位换算 ====================

  /**
   * 将指定单位的数量转换为基本单位
   */
  private convertToBaseUnit(product: Product, quantity: Decimal, unit: string): Decimal {
    if (unit === product.baseUnit) {
      return quantity.toDecimalPlaces(3)
    }

    const packageUnit = this.db.select()
      .from(packageUnits)
      .where(eq(packageUnits.productId, product.id))
      .all()
      .find(u => u.name === unit)

    if (!packageUnit) {
      throw new UnitNotFoundError(product.id, unit)
    }

    return quantity.mul(packageUnit.conversionRate).toDecimalPlaces(3)
  }

  /**
   * 验证单位是否有效
   */
  private validateUnit(productId: string, unit: string): Product {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    if (unit === product.baseUnit) {
      return product
    }

    const packageUnit = this.db.select()
      .from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()
      .find(u => u.name === unit)

    if (!packageUnit) {
      throw new UnitNotFoundError(productId, unit)
    }

    return product
  }

  // ==================== 进货单管理 ====================

  /**
   * 创建进货单
   * 需求: 3.1, 3.2, 3.3, 3.5
   */
  createPurchaseOrder(input: CreatePurchaseOrderInput): PurchaseOrderWithItems {
    // 验证供应商
    if (!input.supplier || input.supplier.trim().length === 0) {
      throw new PurchaseOrderValidationError('供应商不能为空')
    }

    // 验证商品清单不为空
    if (!input.items || input.items.length === 0) {
      throw new PurchaseOrderValidationError('商品清单不能为空')
    }

    // 验证每个商品项
    const validatedItems: Array<{
      product: Product
      input: PurchaseOrderItemInput
      subtotal: Decimal
    }> = []

    for (const item of input.items) {
      // 验证数量大于零
      if (item.quantity <= 0) {
        throw new PurchaseOrderValidationError(`商品数量必须大于零 (商品ID: ${item.productId})`)
      }

      // 验证单价非负
      if (item.unitPrice < 0) {
        throw new PurchaseOrderValidationError(`商品单价不能为负数 (商品ID: ${item.productId})`)
      }

      // 验证商品和单位
      const product = this.validateUnit(item.productId, item.unit)

      // 计算小计
      const subtotal = new Decimal(item.quantity).mul(item.unitPrice).toDecimalPlaces(2)

      validatedItems.push({ product, input: item, subtotal })
    }

    // 计算总金额
    const totalAmount = validatedItems.reduce(
      (sum, item) => sum.add(item.subtotal),
      new Decimal(0)
    ).toDecimalPlaces(2)

    const now = new Date()
    const orderDate = input.orderDate ?? now

    // 创建进货单
    const order = this.db.insert(purchaseOrders).values({
      orderNumber: this.generateOrderNumber(),
      supplier: input.supplier.trim(),
      orderDate,
      totalAmount: totalAmount.toNumber(),
      status: 'PENDING',
      createdAt: now,
    }).returning().get()

    // 创建进货单明细
    const orderItems: PurchaseOrderItem[] = []
    for (const { product, input: item, subtotal } of validatedItems) {
      const orderItem = this.db.insert(purchaseOrderItems).values({
        purchaseOrderId: order.id,
        productId: item.productId,
        productName: product.name,
        quantity: new Decimal(item.quantity).toDecimalPlaces(3).toNumber(),
        unit: item.unit,
        unitPrice: new Decimal(item.unitPrice).toDecimalPlaces(4).toNumber(),
        subtotal: subtotal.toNumber(),
      }).returning().get()

      orderItems.push(orderItem)
    }

    return { ...order, items: orderItems }
  }

  /**
   * 确认进货单（入库）
   * 需求: 3.4, 3.7
   */
  confirmPurchaseOrder(orderId: string): PurchaseOrderWithItems {
    // 获取进货单
    const order = this.db.select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId))
      .get()

    if (!order) {
      throw new PurchaseOrderNotFoundError(orderId)
    }

    // 检查状态
    if (order.status === 'CONFIRMED') {
      throw new OrderAlreadyConfirmedError(orderId)
    }

    // 获取进货单明细
    const items = this.db.select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId))
      .all()

    const now = new Date()

    // 更新库存
    for (const item of items) {
      const product = this.db.select()
        .from(products)
        .where(eq(products.id, item.productId))
        .get()

      if (!product) {
        throw new ProductNotFoundError(item.productId)
      }

      // 将数量换算为基本单位
      const baseQuantity = this.convertToBaseUnit(
        product,
        new Decimal(item.quantity),
        item.unit
      )

      // 获取或创建库存记录
      let inventory = this.db.select()
        .from(inventoryRecords)
        .where(eq(inventoryRecords.productId, item.productId))
        .get()

      if (!inventory) {
        inventory = this.db.insert(inventoryRecords).values({
          productId: item.productId,
          quantity: 0,
          lastUpdated: now,
        }).returning().get()
      }

      // 更新库存
      const newQuantity = new Decimal(inventory.quantity).add(baseQuantity).toDecimalPlaces(3)

      this.db.update(inventoryRecords)
        .set({
          quantity: newQuantity.toNumber(),
          lastUpdated: now,
        })
        .where(eq(inventoryRecords.productId, item.productId))
        .run()

      // 记录库存变动
      this.db.insert(inventoryTransactions).values({
        productId: item.productId,
        transactionType: 'PURCHASE',
        quantityChange: baseQuantity.toNumber(),
        unit: product.baseUnit,
        referenceId: orderId,
        timestamp: now,
        note: `进货单: ${order.orderNumber}`,
      }).run()
    }

    // 更新进货单状态
    const updatedOrder = this.db.update(purchaseOrders)
      .set({
        status: 'CONFIRMED',
        confirmedAt: now,
      })
      .where(eq(purchaseOrders.id, orderId))
      .returning()
      .get()

    return { ...updatedOrder, items }
  }

  /**
   * 获取进货单详情
   * 需求: 3.7
   */
  getPurchaseOrder(orderId: string): PurchaseOrderWithItems | null {
    const order = this.db.select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId))
      .get()

    if (!order) return null

    const items = this.db.select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId))
      .all()

    return { ...order, items }
  }

  /**
   * 根据订单号获取进货单
   */
  getPurchaseOrderByNumber(orderNumber: string): PurchaseOrderWithItems | null {
    const order = this.db.select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.orderNumber, orderNumber))
      .get()

    if (!order) return null

    const items = this.db.select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, order.id))
      .all()

    return { ...order, items }
  }

  /**
   * 搜索进货记录
   * 需求: 3.6
   */
  searchPurchaseOrders(params: SearchPurchaseOrdersParams = {}): PurchaseOrderWithItems[] {
    const { supplier, startDate, endDate, status } = params

    // 构建查询条件
    const conditions = []

    if (supplier && supplier.trim().length > 0) {
      conditions.push(like(purchaseOrders.supplier, `%${supplier.trim()}%`))
    }

    if (startDate) {
      conditions.push(gte(purchaseOrders.orderDate, startDate))
    }

    if (endDate) {
      conditions.push(lte(purchaseOrders.orderDate, endDate))
    }

    if (status) {
      conditions.push(eq(purchaseOrders.status, status))
    }

    // 执行查询
    let orders: PurchaseOrder[]
    if (conditions.length > 0) {
      orders = this.db.select()
        .from(purchaseOrders)
        .where(and(...conditions))
        .orderBy(desc(purchaseOrders.orderDate))
        .all()
    } else {
      orders = this.db.select()
        .from(purchaseOrders)
        .orderBy(desc(purchaseOrders.orderDate))
        .all()
    }

    if (orders.length === 0) return []

    // 批量获取订单明细
    const orderIds = orders.map(o => o.id)
    const allItems = this.db.select()
      .from(purchaseOrderItems)
      .where(inArray(purchaseOrderItems.purchaseOrderId, orderIds))
      .all()

    return orders.map(order => ({
      ...order,
      items: allItems.filter(item => item.purchaseOrderId === order.id),
    }))
  }

  /**
   * 获取所有进货单
   */
  getAllPurchaseOrders(): PurchaseOrderWithItems[] {
    return this.searchPurchaseOrders()
  }

  /**
   * 删除进货单（仅限待确认状态）
   */
  deletePurchaseOrder(orderId: string): void {
    const order = this.db.select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId))
      .get()

    if (!order) {
      throw new PurchaseOrderNotFoundError(orderId)
    }

    if (order.status === 'CONFIRMED') {
      throw new PurchaseOrderValidationError('已确认的进货单无法删除')
    }

    this.db.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId)).run()
  }

  // ==================== 进货退货管理 ====================

  /**
   * 获取进货单已退货数量
   */
  private getReturnedQuantities(originalOrderId: string): Map<string, number> {
    const returnedMap = new Map<string, number>()

    // 查找所有基于此进货单的已确认退货单
    const confirmedReturns = this.db.select()
      .from(returnOrders)
      .where(and(
        eq(returnOrders.originalOrderId, originalOrderId),
        eq(returnOrders.orderType, 'PURCHASE'),
        eq(returnOrders.status, 'CONFIRMED')
      ))
      .all()

    if (confirmedReturns.length === 0) return returnedMap

    const returnIds = confirmedReturns.map(r => r.id)
    const returnItems = this.db.select()
      .from(returnOrderItems)
      .where(inArray(returnOrderItems.returnOrderId, returnIds))
      .all()

    for (const item of returnItems) {
      const current = returnedMap.get(item.productId) ?? 0
      returnedMap.set(item.productId, current + item.quantity)
    }

    return returnedMap
  }

  /**
   * 创建进货退货单
   * 需求: 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.6
   */
  createPurchaseReturn(
    originalOrderId: string,
    returnItems: ReturnItemInput[]
  ): ReturnOrderWithItems {
    // 获取原进货单
    const originalOrder = this.getPurchaseOrder(originalOrderId)
    if (!originalOrder) {
      throw new PurchaseOrderNotFoundError(originalOrderId)
    }

    // 验证原进货单已确认
    if (originalOrder.status !== 'CONFIRMED') {
      throw new PurchaseOrderValidationError('只能对已确认的进货单创建退货')
    }

    // 验证退货商品清单不为空
    if (!returnItems || returnItems.length === 0) {
      throw new PurchaseOrderValidationError('退货商品清单不能为空')
    }

    // 获取已退货数量
    const returnedQuantities = this.getReturnedQuantities(originalOrderId)

    // 验证每个退货项
    const validatedItems: Array<{
      product: Product
      originalItem: PurchaseOrderItem
      input: ReturnItemInput
      subtotal: Decimal
    }> = []

    for (const item of returnItems) {
      // 验证数量大于零
      if (item.quantity <= 0) {
        throw new PurchaseOrderValidationError(`退货数量必须大于零 (商品ID: ${item.productId})`)
      }

      // 查找原进货单中的商品
      const originalItem = originalOrder.items.find(i => i.productId === item.productId)
      if (!originalItem) {
        throw new PurchaseOrderValidationError(`商品不在原进货单中 (商品ID: ${item.productId})`)
      }

      // 验证商品和单位
      const product = this.validateUnit(item.productId, item.unit)

      // 计算可退数量（原数量 - 已退数量）
      const alreadyReturned = returnedQuantities.get(item.productId) ?? 0
      const maxReturnQuantity = new Decimal(originalItem.quantity).sub(alreadyReturned)

      // 验证退货数量不超过可退数量
      if (new Decimal(item.quantity).gt(maxReturnQuantity)) {
        throw new ReturnQuantityExceededError(
          item.productId,
          maxReturnQuantity.toNumber(),
          item.quantity
        )
      }

      // 计算小计
      const subtotal = new Decimal(item.quantity).mul(item.unitPrice).toDecimalPlaces(2)

      validatedItems.push({ product, originalItem, input: item, subtotal })
    }

    // 计算退货总金额
    const totalAmount = validatedItems.reduce(
      (sum, item) => sum.add(item.subtotal),
      new Decimal(0)
    ).toDecimalPlaces(2)

    const now = new Date()

    // 创建退货单
    const returnOrder = this.db.insert(returnOrders).values({
      orderNumber: this.generateReturnOrderNumber(),
      originalOrderId,
      orderType: 'PURCHASE',
      returnDate: now,
      totalAmount: totalAmount.toNumber(),
      status: 'PENDING',
      createdAt: now,
    }).returning().get()

    // 创建退货单明细
    const orderItems: ReturnOrderItem[] = []
    for (const { product, input: item, subtotal } of validatedItems) {
      const orderItem = this.db.insert(returnOrderItems).values({
        returnOrderId: returnOrder.id,
        productId: item.productId,
        productName: product.name,
        quantity: new Decimal(item.quantity).toDecimalPlaces(3).toNumber(),
        unit: item.unit,
        unitPrice: new Decimal(item.unitPrice).toDecimalPlaces(4).toNumber(),
        subtotal: subtotal.toNumber(),
      }).returning().get()

      orderItems.push(orderItem)
    }

    return { ...returnOrder, items: orderItems }
  }

  /**
   * 确认进货退货（出库）
   * 需求: 3.1.5, 3.1.7
   */
  confirmPurchaseReturn(returnId: string): ReturnOrderWithItems {
    // 获取退货单
    const returnOrder = this.db.select()
      .from(returnOrders)
      .where(eq(returnOrders.id, returnId))
      .get()

    if (!returnOrder) {
      throw new ReturnOrderNotFoundError(returnId)
    }

    // 验证是进货退货
    if (returnOrder.orderType !== 'PURCHASE') {
      throw new PurchaseOrderValidationError('此退货单不是进货退货单')
    }

    // 检查状态
    if (returnOrder.status === 'CONFIRMED') {
      throw new OrderAlreadyConfirmedError(returnId)
    }

    // 获取退货单明细
    const items = this.db.select()
      .from(returnOrderItems)
      .where(eq(returnOrderItems.returnOrderId, returnId))
      .all()

    const now = new Date()

    // 减少库存
    for (const item of items) {
      const product = this.db.select()
        .from(products)
        .where(eq(products.id, item.productId))
        .get()

      if (!product) {
        throw new ProductNotFoundError(item.productId)
      }

      // 将数量换算为基本单位
      const baseQuantity = this.convertToBaseUnit(
        product,
        new Decimal(item.quantity),
        item.unit
      )

      // 获取库存记录
      const inventory = this.db.select()
        .from(inventoryRecords)
        .where(eq(inventoryRecords.productId, item.productId))
        .get()

      if (!inventory) {
        throw new InsufficientStockError(item.productId, baseQuantity.toNumber(), 0)
      }

      // 检查库存是否充足
      const currentQuantity = new Decimal(inventory.quantity)
      if (currentQuantity.lt(baseQuantity)) {
        throw new InsufficientStockError(
          item.productId,
          baseQuantity.toNumber(),
          currentQuantity.toNumber()
        )
      }

      // 更新库存
      const newQuantity = currentQuantity.sub(baseQuantity).toDecimalPlaces(3)

      this.db.update(inventoryRecords)
        .set({
          quantity: newQuantity.toNumber(),
          lastUpdated: now,
        })
        .where(eq(inventoryRecords.productId, item.productId))
        .run()

      // 记录库存变动
      this.db.insert(inventoryTransactions).values({
        productId: item.productId,
        transactionType: 'RETURN',
        quantityChange: baseQuantity.neg().toNumber(),
        unit: product.baseUnit,
        referenceId: returnId,
        timestamp: now,
        note: `进货退货单: ${returnOrder.orderNumber}`,
      }).run()
    }

    // 更新退货单状态
    const updatedOrder = this.db.update(returnOrders)
      .set({
        status: 'CONFIRMED',
        confirmedAt: now,
      })
      .where(eq(returnOrders.id, returnId))
      .returning()
      .get()

    return { ...updatedOrder, items }
  }

  /**
   * 获取退货单详情
   */
  getReturnOrder(returnId: string): ReturnOrderWithItems | null {
    const returnOrder = this.db.select()
      .from(returnOrders)
      .where(eq(returnOrders.id, returnId))
      .get()

    if (!returnOrder) return null

    const items = this.db.select()
      .from(returnOrderItems)
      .where(eq(returnOrderItems.returnOrderId, returnId))
      .all()

    return { ...returnOrder, items }
  }

  /**
   * 获取进货单的所有退货记录
   */
  getReturnOrdersByPurchaseOrder(purchaseOrderId: string): ReturnOrderWithItems[] {
    const returns = this.db.select()
      .from(returnOrders)
      .where(and(
        eq(returnOrders.originalOrderId, purchaseOrderId),
        eq(returnOrders.orderType, 'PURCHASE')
      ))
      .orderBy(desc(returnOrders.returnDate))
      .all()

    if (returns.length === 0) return []

    const returnIds = returns.map(r => r.id)
    const allItems = this.db.select()
      .from(returnOrderItems)
      .where(inArray(returnOrderItems.returnOrderId, returnIds))
      .all()

    return returns.map(returnOrder => ({
      ...returnOrder,
      items: allItems.filter(item => item.returnOrderId === returnOrder.id),
    }))
  }
}

// ==================== 工厂函数 ====================

export function createPurchaseService(db: DbType): PurchaseService {
  return new PurchaseService(db)
}

export function createPurchaseServiceFromSqlite(sqlite: Database.Database): PurchaseService {
  const db = drizzle(sqlite, { schema: { ...schema, ...relations } })
  return new PurchaseService(db)
}
