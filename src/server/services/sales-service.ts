/**
 * 销售服务层
 * 实现销售单的创建、确认、查询、折扣、抹零、改价等核心业务逻辑
 * 需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10
 */
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'
import {
  products,
  packageUnits,
  salesOrders,
  salesOrderItems,
  inventoryRecords,
  inventoryTransactions,
  returnOrders,
  returnOrderItems,
  type Product,
  type PackageUnit,
  type SalesOrder,
  type SalesOrderItem,
  type ReturnOrder,
  type ReturnOrderItem,
  type OrderStatus,
} from '@/server/db/schema'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { eq, and, gte, lte, like, inArray, desc } from 'drizzle-orm'
import Decimal from 'decimal.js'

// ==================== 类型定义 ====================

type DbSchema = typeof schema & typeof relations
type DbType = BetterSQLite3Database<DbSchema>

export interface CreateSalesOrderInput {
  customerName?: string
  orderDate?: Date
  items: SalesOrderItemInput[]
}

export interface SalesOrderItemInput {
  productId: string
  quantity: number
  unit: string
  unitPrice?: number // 可选，不提供则使用商品零售价
}

export interface AddOrderItemInput {
  productId: string
  quantity: number
  unit: string
  unitPrice?: number
}

export interface SearchSalesOrdersParams {
  customerName?: string
  startDate?: Date
  endDate?: Date
  status?: OrderStatus
}

export interface SalesOrderWithItems extends SalesOrder {
  items: SalesOrderItem[]
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

export class SalesOrderValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesOrderValidationError'
  }
}

export class SalesOrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`销售单不存在: ${orderId}`)
    this.name = 'SalesOrderNotFoundError'
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
    super(`销售单已确认，无法重复操作: ${orderId}`)
    this.name = 'OrderAlreadyConfirmedError'
  }
}

export class InsufficientStockError extends Error {
  constructor(productId: string, productName: string, required: number, available: number) {
    super(`库存不足: ${productName} 需要 ${required}，可用 ${available}`)
    this.name = 'InsufficientStockError'
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

export class InvalidItemIndexError extends Error {
  constructor(index: number) {
    super(`无效的商品索引: ${index}`)
    this.name = 'InvalidItemIndexError'
  }
}

// ==================== 销售服务类 ====================

export class SalesService {
  private db: DbType

  constructor(db: DbType) {
    this.db = db
  }

  // ==================== 订单号生成 ====================

  /**
   * 生成唯一的销售单号
   * 格式: SO + 年月日 + 4位序号
   */
  generateOrderNumber(): string {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `SO${dateStr}${random}`
  }

  /**
   * 生成唯一的退货单号
   * 格式: SR + 年月日 + 4位序号
   */
  generateReturnOrderNumber(): string {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `SR${dateStr}${random}`
  }

  // ==================== 单位换算和价格获取 ====================

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
   * 验证单位是否有效并返回商品信息
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

  /**
   * 获取商品在指定单位下的零售价
   * 需求: 4.3 - 自动填充商品零售价
   */
  private getRetailPrice(product: Product, unit: string): Decimal {
    // 如果是基本单位，直接返回商品零售价
    if (unit === product.baseUnit) {
      return new Decimal(product.retailPrice)
    }

    // 查找包装单位
    const packageUnit = this.db.select()
      .from(packageUnits)
      .where(eq(packageUnits.productId, product.id))
      .all()
      .find(u => u.name === unit)

    if (!packageUnit) {
      throw new UnitNotFoundError(product.id, unit)
    }

    // 优先使用包装单位的特定零售价
    if (packageUnit.retailPrice !== null && packageUnit.retailPrice !== undefined) {
      return new Decimal(packageUnit.retailPrice)
    }

    // 否则使用：基础零售价 × 换算率
    return new Decimal(product.retailPrice).mul(packageUnit.conversionRate).toDecimalPlaces(4)
  }

  /**
   * 检查库存是否充足
   * 需求: 4.4, 4.5
   */
  private checkStockAvailability(
    product: Product,
    quantity: Decimal,
    unit: string
  ): { available: boolean; currentStock: Decimal; requiredBase: Decimal } {
    // 将需求数量换算为基本单位
    const requiredBase = this.convertToBaseUnit(product, quantity, unit)

    // 获取当前库存
    const inventory = this.db.select()
      .from(inventoryRecords)
      .where(eq(inventoryRecords.productId, product.id))
      .get()

    const currentStock = new Decimal(inventory?.quantity ?? 0)

    return {
      available: currentStock.gte(requiredBase),
      currentStock,
      requiredBase,
    }
  }

  // ==================== 销售单管理 ====================

  /**
   * 创建销售单
   * 需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
   */
  createSalesOrder(input: CreateSalesOrderInput): SalesOrderWithItems {
    // 验证商品清单不为空
    if (!input.items || input.items.length === 0) {
      throw new SalesOrderValidationError('商品清单不能为空')
    }

    // 验证每个商品项
    const validatedItems: Array<{
      product: Product
      input: SalesOrderItemInput
      unitPrice: Decimal
      subtotal: Decimal
    }> = []

    for (const item of input.items) {
      // 验证数量大于零
      if (item.quantity <= 0) {
        throw new SalesOrderValidationError(`商品数量必须大于零 (商品ID: ${item.productId})`)
      }

      // 验证商品和单位
      const product = this.validateUnit(item.productId, item.unit)

      // 检查库存充足性 (需求: 4.4, 4.5)
      const stockCheck = this.checkStockAvailability(
        product,
        new Decimal(item.quantity),
        item.unit
      )

      if (!stockCheck.available) {
        throw new InsufficientStockError(
          item.productId,
          product.name,
          stockCheck.requiredBase.toNumber(),
          stockCheck.currentStock.toNumber()
        )
      }

      // 获取单价 (需求: 4.3 - 自动填充价格)
      let unitPrice: Decimal
      if (item.unitPrice !== undefined && item.unitPrice !== null) {
        if (item.unitPrice < 0) {
          throw new SalesOrderValidationError(`商品单价不能为负数 (商品ID: ${item.productId})`)
        }
        unitPrice = new Decimal(item.unitPrice).toDecimalPlaces(4)
      } else {
        unitPrice = this.getRetailPrice(product, item.unit)
      }

      // 计算小计
      const subtotal = new Decimal(item.quantity).mul(unitPrice).toDecimalPlaces(2)

      validatedItems.push({ product, input: item, unitPrice, subtotal })
    }

    // 计算小计总额
    const subtotal = validatedItems.reduce(
      (sum, item) => sum.add(item.subtotal),
      new Decimal(0)
    ).toDecimalPlaces(2)

    const now = new Date()
    const orderDate = input.orderDate ?? now

    // 创建销售单 (需求: 4.6 - 自动计算总金额)
    const order = this.db.insert(salesOrders).values({
      orderNumber: this.generateOrderNumber(),
      customerName: input.customerName?.trim() || null,
      orderDate,
      subtotal: subtotal.toNumber(),
      discountAmount: 0,
      roundingAmount: 0,
      totalAmount: subtotal.toNumber(),
      status: 'PENDING',
      createdAt: now,
    }).returning().get()

    // 创建销售单明细
    const orderItems: SalesOrderItem[] = []
    for (const { product, input: item, unitPrice, subtotal: itemSubtotal } of validatedItems) {
      const orderItem = this.db.insert(salesOrderItems).values({
        salesOrderId: order.id,
        productId: item.productId,
        productName: product.name,
        quantity: new Decimal(item.quantity).toDecimalPlaces(3).toNumber(),
        unit: item.unit,
        unitPrice: unitPrice.toNumber(),
        originalPrice: unitPrice.toNumber(), // 记录原始价格，用于改价功能
        subtotal: itemSubtotal.toNumber(),
      }).returning().get()

      orderItems.push(orderItem)
    }

    return { ...order, items: orderItems }
  }

  /**
   * 添加商品到销售单
   * 需求: 4.2, 4.3, 4.4, 4.5
   */
  addItemToOrder(orderId: string, itemData: AddOrderItemInput): SalesOrderWithItems {
    // 获取销售单
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) {
      throw new SalesOrderNotFoundError(orderId)
    }

    // 检查状态
    if (order.status === 'CONFIRMED') {
      throw new OrderAlreadyConfirmedError(orderId)
    }

    // 验证数量大于零
    if (itemData.quantity <= 0) {
      throw new SalesOrderValidationError(`商品数量必须大于零 (商品ID: ${itemData.productId})`)
    }

    // 验证商品和单位
    const product = this.validateUnit(itemData.productId, itemData.unit)

    // 检查库存充足性
    const stockCheck = this.checkStockAvailability(
      product,
      new Decimal(itemData.quantity),
      itemData.unit
    )

    if (!stockCheck.available) {
      throw new InsufficientStockError(
        itemData.productId,
        product.name,
        stockCheck.requiredBase.toNumber(),
        stockCheck.currentStock.toNumber()
      )
    }

    // 获取单价
    let unitPrice: Decimal
    if (itemData.unitPrice !== undefined && itemData.unitPrice !== null) {
      if (itemData.unitPrice < 0) {
        throw new SalesOrderValidationError(`商品单价不能为负数 (商品ID: ${itemData.productId})`)
      }
      unitPrice = new Decimal(itemData.unitPrice).toDecimalPlaces(4)
    } else {
      unitPrice = this.getRetailPrice(product, itemData.unit)
    }

    // 计算小计
    const itemSubtotal = new Decimal(itemData.quantity).mul(unitPrice).toDecimalPlaces(2)

    // 添加商品明细
    this.db.insert(salesOrderItems).values({
      salesOrderId: orderId,
      productId: itemData.productId,
      productName: product.name,
      quantity: new Decimal(itemData.quantity).toDecimalPlaces(3).toNumber(),
      unit: itemData.unit,
      unitPrice: unitPrice.toNumber(),
      originalPrice: unitPrice.toNumber(),
      subtotal: itemSubtotal.toNumber(),
    }).run()

    // 重新计算订单金额
    return this.recalculateOrderAmount(orderId)
  }

  /**
   * 重新计算订单金额
   */
  private recalculateOrderAmount(orderId: string): SalesOrderWithItems {
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) {
      throw new SalesOrderNotFoundError(orderId)
    }

    const items = this.db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, orderId))
      .all()

    // 计算小计总额
    const subtotal = items.reduce(
      (sum, item) => sum.add(new Decimal(item.subtotal)),
      new Decimal(0)
    ).toDecimalPlaces(2)

    // 计算应收金额 (需求: 4.6, 4.7, 4.8)
    const totalAmount = subtotal
      .sub(new Decimal(order.discountAmount))
      .sub(new Decimal(order.roundingAmount))
      .toDecimalPlaces(2)

    // 更新订单
    const updatedOrder = this.db.update(salesOrders)
      .set({
        subtotal: subtotal.toNumber(),
        totalAmount: Math.max(0, totalAmount.toNumber()), // 确保不为负
      })
      .where(eq(salesOrders.id, orderId))
      .returning()
      .get()

    return { ...updatedOrder, items }
  }

  /**
   * 确认销售单
   * 需求: 4.10
   */
  confirmSalesOrder(orderId: string): SalesOrderWithItems {
    // 获取销售单
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) {
      throw new SalesOrderNotFoundError(orderId)
    }

    // 检查状态
    if (order.status === 'CONFIRMED') {
      throw new OrderAlreadyConfirmedError(orderId)
    }

    // 获取销售单明细
    const items = this.db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, orderId))
      .all()

    if (items.length === 0) {
      throw new SalesOrderValidationError('销售单商品清单为空，无法确认')
    }

    const now = new Date()

    // 再次检查库存并减少库存
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

      const currentQuantity = new Decimal(inventory?.quantity ?? 0)

      // 检查库存是否充足
      if (currentQuantity.lt(baseQuantity)) {
        throw new InsufficientStockError(
          item.productId,
          item.productName,
          baseQuantity.toNumber(),
          currentQuantity.toNumber()
        )
      }

      // 更新库存
      const newQuantity = currentQuantity.sub(baseQuantity).toDecimalPlaces(3)

      if (inventory) {
        this.db.update(inventoryRecords)
          .set({
            quantity: newQuantity.toNumber(),
            lastUpdated: now,
          })
          .where(eq(inventoryRecords.productId, item.productId))
          .run()
      }

      // 记录库存变动
      this.db.insert(inventoryTransactions).values({
        productId: item.productId,
        transactionType: 'SALE',
        quantityChange: baseQuantity.neg().toNumber(),
        unit: product.baseUnit,
        referenceId: orderId,
        timestamp: now,
        note: `销售单: ${order.orderNumber}`,
      }).run()
    }

    // 更新销售单状态
    const updatedOrder = this.db.update(salesOrders)
      .set({
        status: 'CONFIRMED',
        confirmedAt: now,
      })
      .where(eq(salesOrders.id, orderId))
      .returning()
      .get()

    return { ...updatedOrder, items }
  }

  /**
   * 获取销售单详情
   */
  getSalesOrder(orderId: string): SalesOrderWithItems | null {
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) return null

    const items = this.db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, orderId))
      .all()

    return { ...order, items }
  }

  /**
   * 根据订单号获取销售单
   */
  getSalesOrderByNumber(orderNumber: string): SalesOrderWithItems | null {
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.orderNumber, orderNumber))
      .get()

    if (!order) return null

    const items = this.db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, order.id))
      .all()

    return { ...order, items }
  }

  /**
   * 搜索销售记录
   */
  searchSalesOrders(params: SearchSalesOrdersParams = {}): SalesOrderWithItems[] {
    const { customerName, startDate, endDate, status } = params

    // 构建查询条件
    const conditions = []

    if (customerName && customerName.trim().length > 0) {
      conditions.push(like(salesOrders.customerName, `%${customerName.trim()}%`))
    }

    if (startDate) {
      conditions.push(gte(salesOrders.orderDate, startDate))
    }

    if (endDate) {
      conditions.push(lte(salesOrders.orderDate, endDate))
    }

    if (status) {
      conditions.push(eq(salesOrders.status, status))
    }

    // 执行查询
    let orders: SalesOrder[]
    if (conditions.length > 0) {
      orders = this.db.select()
        .from(salesOrders)
        .where(and(...conditions))
        .orderBy(desc(salesOrders.orderDate))
        .all()
    } else {
      orders = this.db.select()
        .from(salesOrders)
        .orderBy(desc(salesOrders.orderDate))
        .all()
    }

    if (orders.length === 0) return []

    // 批量获取订单明细
    const orderIds = orders.map(o => o.id)
    const allItems = this.db.select()
      .from(salesOrderItems)
      .where(inArray(salesOrderItems.salesOrderId, orderIds))
      .all()

    return orders.map(order => ({
      ...order,
      items: allItems.filter(item => item.salesOrderId === order.id),
    }))
  }

  /**
   * 获取所有销售单
   */
  getAllSalesOrders(): SalesOrderWithItems[] {
    return this.searchSalesOrders()
  }

  /**
   * 删除销售单（仅限待确认状态）
   */
  deleteSalesOrder(orderId: string): void {
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) {
      throw new SalesOrderNotFoundError(orderId)
    }

    if (order.status === 'CONFIRMED') {
      throw new SalesOrderValidationError('已确认的销售单无法删除')
    }

    this.db.delete(salesOrders).where(eq(salesOrders.id, orderId)).run()
  }


  // ==================== 折扣和抹零功能 ====================

  /**
   * 应用折扣
   * 需求: 4.7
   */
  applyDiscount(
    orderId: string,
    discountType: 'percentage' | 'fixed',
    discountValue: number
  ): SalesOrderWithItems {
    // 获取销售单
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) {
      throw new SalesOrderNotFoundError(orderId)
    }

    // 检查状态
    if (order.status === 'CONFIRMED') {
      throw new OrderAlreadyConfirmedError(orderId)
    }

    // 验证折扣值
    if (discountValue < 0) {
      throw new SalesOrderValidationError('折扣值不能为负数')
    }

    let discountAmount: Decimal

    if (discountType === 'percentage') {
      // 百分比折扣
      if (discountValue > 100) {
        throw new SalesOrderValidationError('折扣百分比不能超过100%')
      }
      discountAmount = new Decimal(order.subtotal)
        .mul(discountValue)
        .div(100)
        .toDecimalPlaces(2)
    } else {
      // 固定金额折扣
      discountAmount = new Decimal(discountValue).toDecimalPlaces(2)
      if (discountAmount.gt(order.subtotal)) {
        throw new SalesOrderValidationError('折扣金额不能超过订单小计')
      }
    }

    // 计算新的应收金额
    const totalAmount = new Decimal(order.subtotal)
      .sub(discountAmount)
      .sub(new Decimal(order.roundingAmount))
      .toDecimalPlaces(2)

    // 更新订单
    const updatedOrder = this.db.update(salesOrders)
      .set({
        discountAmount: discountAmount.toNumber(),
        totalAmount: Math.max(0, totalAmount.toNumber()),
      })
      .where(eq(salesOrders.id, orderId))
      .returning()
      .get()

    const items = this.db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, orderId))
      .all()

    return { ...updatedOrder, items }
  }

  /**
   * 应用抹零
   * 需求: 4.8
   */
  applyRounding(orderId: string, roundingAmount: number): SalesOrderWithItems {
    // 获取销售单
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) {
      throw new SalesOrderNotFoundError(orderId)
    }

    // 检查状态
    if (order.status === 'CONFIRMED') {
      throw new OrderAlreadyConfirmedError(orderId)
    }

    // 验证抹零金额
    if (roundingAmount < 0) {
      throw new SalesOrderValidationError('抹零金额不能为负数')
    }

    const roundingDecimal = new Decimal(roundingAmount).toDecimalPlaces(2)

    // 计算折扣后金额
    const afterDiscount = new Decimal(order.subtotal).sub(new Decimal(order.discountAmount))

    // 抹零金额不能超过折扣后金额
    if (roundingDecimal.gt(afterDiscount)) {
      throw new SalesOrderValidationError('抹零金额不能超过折扣后金额')
    }

    // 计算新的应收金额
    const totalAmount = afterDiscount.sub(roundingDecimal).toDecimalPlaces(2)

    // 更新订单
    const updatedOrder = this.db.update(salesOrders)
      .set({
        roundingAmount: roundingDecimal.toNumber(),
        totalAmount: Math.max(0, totalAmount.toNumber()),
      })
      .where(eq(salesOrders.id, orderId))
      .returning()
      .get()

    const items = this.db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, orderId))
      .all()

    return { ...updatedOrder, items }
  }

  /**
   * 调整商品单价（改价功能）
   * 需求: 4.9
   */
  adjustItemPrice(orderId: string, itemIndex: number, newPrice: number): SalesOrderWithItems {
    // 获取销售单
    const order = this.db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
      .get()

    if (!order) {
      throw new SalesOrderNotFoundError(orderId)
    }

    // 检查状态
    if (order.status === 'CONFIRMED') {
      throw new OrderAlreadyConfirmedError(orderId)
    }

    // 验证新价格
    if (newPrice < 0) {
      throw new SalesOrderValidationError('商品单价不能为负数')
    }

    // 获取订单明细
    const items = this.db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, orderId))
      .all()

    // 验证索引
    if (itemIndex < 0 || itemIndex >= items.length) {
      throw new InvalidItemIndexError(itemIndex)
    }

    const item = items[itemIndex]
    const newPriceDecimal = new Decimal(newPrice).toDecimalPlaces(4)

    // 计算新的小计
    const newSubtotal = new Decimal(item.quantity).mul(newPriceDecimal).toDecimalPlaces(2)

    // 更新商品明细
    this.db.update(salesOrderItems)
      .set({
        unitPrice: newPriceDecimal.toNumber(),
        subtotal: newSubtotal.toNumber(),
      })
      .where(eq(salesOrderItems.id, item.id))
      .run()

    // 重新计算订单金额
    return this.recalculateOrderAmount(orderId)
  }

  // ==================== 销售退货管理 ====================

  /**
   * 获取销售单已退货数量
   */
  private getReturnedQuantities(originalOrderId: string): Map<string, number> {
    const returnedMap = new Map<string, number>()

    // 查找所有基于此销售单的已确认退货单
    const confirmedReturns = this.db.select()
      .from(returnOrders)
      .where(and(
        eq(returnOrders.originalOrderId, originalOrderId),
        eq(returnOrders.orderType, 'SALE'),
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
   * 创建销售退货单
   * 需求: 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.6
   */
  createSalesReturn(
    originalOrderId: string,
    returnItems: ReturnItemInput[]
  ): ReturnOrderWithItems {
    // 获取原销售单
    const originalOrder = this.getSalesOrder(originalOrderId)
    if (!originalOrder) {
      throw new SalesOrderNotFoundError(originalOrderId)
    }

    // 验证原销售单已确认
    if (originalOrder.status !== 'CONFIRMED') {
      throw new SalesOrderValidationError('只能对已确认的销售单创建退货')
    }

    // 验证退货商品清单不为空
    if (!returnItems || returnItems.length === 0) {
      throw new SalesOrderValidationError('退货商品清单不能为空')
    }

    // 获取已退货数量
    const returnedQuantities = this.getReturnedQuantities(originalOrderId)

    // 验证每个退货项
    const validatedItems: Array<{
      product: Product
      originalItem: SalesOrderItem
      input: ReturnItemInput
      subtotal: Decimal
    }> = []

    for (const item of returnItems) {
      // 验证数量大于零
      if (item.quantity <= 0) {
        throw new SalesOrderValidationError(`退货数量必须大于零 (商品ID: ${item.productId})`)
      }

      // 查找原销售单中的商品
      const originalItem = originalOrder.items.find(i => i.productId === item.productId)
      if (!originalItem) {
        throw new SalesOrderValidationError(`商品不在原销售单中 (商品ID: ${item.productId})`)
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
      orderType: 'SALE',
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
   * 确认销售退货（入库）
   * 需求: 4.1.5, 4.1.7
   */
  confirmSalesReturn(returnId: string): ReturnOrderWithItems {
    // 获取退货单
    const returnOrder = this.db.select()
      .from(returnOrders)
      .where(eq(returnOrders.id, returnId))
      .get()

    if (!returnOrder) {
      throw new ReturnOrderNotFoundError(returnId)
    }

    // 验证是销售退货
    if (returnOrder.orderType !== 'SALE') {
      throw new SalesOrderValidationError('此退货单不是销售退货单')
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

    // 增加库存
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
        transactionType: 'RETURN',
        quantityChange: baseQuantity.toNumber(),
        unit: product.baseUnit,
        referenceId: returnId,
        timestamp: now,
        note: `销售退货单: ${returnOrder.orderNumber}`,
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
   * 获取销售单的所有退货记录
   */
  getReturnOrdersBySalesOrder(salesOrderId: string): ReturnOrderWithItems[] {
    const returns = this.db.select()
      .from(returnOrders)
      .where(and(
        eq(returnOrders.originalOrderId, salesOrderId),
        eq(returnOrders.orderType, 'SALE')
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

export function createSalesService(db: DbType): SalesService {
  return new SalesService(db)
}

export function createSalesServiceFromSqlite(sqlite: Database.Database): SalesService {
  const db = drizzle(sqlite, { schema: { ...schema, ...relations } })
  return new SalesService(db)
}
