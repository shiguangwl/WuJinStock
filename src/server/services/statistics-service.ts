/**
 * 统计服务层
 * 实现销售统计、报表生成等核心业务逻辑
 * 需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'
import {
  products,
  salesOrders,
  salesOrderItems,
  purchaseOrders,
  purchaseOrderItems,
  packageUnits,
  type Product,
  type SalesOrder,
  type SalesOrderItem,
} from '@/server/db/schema'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { eq, and, gte, lte, sql, desc, inArray } from 'drizzle-orm'
import Decimal from 'decimal.js'

// ==================== 类型定义 ====================

type DbSchema = typeof schema & typeof relations
type DbType = BetterSQLite3Database<DbSchema>

export interface SalesSummary {
  totalSales: number      // 总销售额
  totalOrders: number     // 总订单数
  totalQuantity: number   // 总销售数量（基本单位）
}

export interface DailySales {
  date: string            // 日期 YYYY-MM-DD
  sales: number           // 当日销售额
  orders: number          // 当日订单数
}

export interface TopSellingProduct {
  product: Product
  quantity: number        // 销售数量（基本单位）
  sales: number           // 销售额
}

export interface GrossProfitResult {
  totalSales: number      // 总销售额
  totalCost: number       // 总成本
  grossProfit: number     // 毛利润
  profitMargin: number    // 毛利率（百分比）
}

export interface SearchStatisticsParams {
  startDate?: Date
  endDate?: Date
  productId?: string
}

// ==================== 统计服务类 ====================

export class StatisticsService {
  private db: DbType

  constructor(db: DbType) {
    this.db = db
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
      // 如果找不到单位，假设是基本单位
      return quantity.toDecimalPlaces(3)
    }

    return quantity.mul(packageUnit.conversionRate).toDecimalPlaces(3)
  }

  // ==================== 销售汇总 ====================

  /**
   * 获取销售汇总
   * 需求: 5.3 - 提供销售统计报表，显示指定时间段内的总销售额、总销售数量
   */
  getSalesSummary(startDate: Date, endDate: Date): SalesSummary {
    // 查询已确认的销售单
    const orders = this.db.select()
      .from(salesOrders)
      .where(and(
        eq(salesOrders.status, 'CONFIRMED'),
        gte(salesOrders.orderDate, startDate),
        lte(salesOrders.orderDate, endDate)
      ))
      .all()

    if (orders.length === 0) {
      return {
        totalSales: 0,
        totalOrders: 0,
        totalQuantity: 0,
      }
    }

    // 计算总销售额
    const totalSales = orders.reduce(
      (sum, order) => sum.add(new Decimal(order.totalAmount)),
      new Decimal(0)
    )

    // 获取所有订单明细
    const orderIds = orders.map(o => o.id)
    const allItems = this.db.select()
      .from(salesOrderItems)
      .where(inArray(salesOrderItems.salesOrderId, orderIds))
      .all()

    // 计算总销售数量（换算为基本单位）
    let totalQuantity = new Decimal(0)
    for (const item of allItems) {
      const product = this.db.select()
        .from(products)
        .where(eq(products.id, item.productId))
        .get()

      if (product) {
        const baseQuantity = this.convertToBaseUnit(
          product,
          new Decimal(item.quantity),
          item.unit
        )
        totalQuantity = totalQuantity.add(baseQuantity)
      } else {
        // 如果商品已删除，直接使用原数量
        totalQuantity = totalQuantity.add(new Decimal(item.quantity))
      }
    }

    return {
      totalSales: totalSales.toDecimalPlaces(2).toNumber(),
      totalOrders: orders.length,
      totalQuantity: totalQuantity.toDecimalPlaces(3).toNumber(),
    }
  }

  // ==================== 每日销售统计 ====================

  /**
   * 获取每日销售统计
   * 需求: 5.5 - 提供日销售汇总，显示每日的销售额和订单数量
   */
  getDailySales(startDate: Date, endDate: Date): DailySales[] {
    // 查询已确认的销售单
    const orders = this.db.select()
      .from(salesOrders)
      .where(and(
        eq(salesOrders.status, 'CONFIRMED'),
        gte(salesOrders.orderDate, startDate),
        lte(salesOrders.orderDate, endDate)
      ))
      .all()

    if (orders.length === 0) {
      return []
    }

    // 按日期分组统计
    const dailyMap = new Map<string, { sales: Decimal; orders: number }>()

    for (const order of orders) {
      const dateStr = order.orderDate.toISOString().slice(0, 10)
      const existing = dailyMap.get(dateStr) ?? { sales: new Decimal(0), orders: 0 }
      
      dailyMap.set(dateStr, {
        sales: existing.sales.add(new Decimal(order.totalAmount)),
        orders: existing.orders + 1,
      })
    }

    // 转换为数组并按日期排序
    const result: DailySales[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        sales: data.sales.toDecimalPlaces(2).toNumber(),
        orders: data.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return result
  }

  // ==================== 商品销售排行 ====================

  /**
   * 获取销售排行
   * 需求: 5.4 - 提供商品销售排行，显示销售数量最多的商品
   */
  getTopSellingProducts(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): TopSellingProduct[] {
    // 查询已确认的销售单
    const orders = this.db.select()
      .from(salesOrders)
      .where(and(
        eq(salesOrders.status, 'CONFIRMED'),
        gte(salesOrders.orderDate, startDate),
        lte(salesOrders.orderDate, endDate)
      ))
      .all()

    if (orders.length === 0) {
      return []
    }

    // 获取所有订单明细
    const orderIds = orders.map(o => o.id)
    const allItems = this.db.select()
      .from(salesOrderItems)
      .where(inArray(salesOrderItems.salesOrderId, orderIds))
      .all()

    // 按商品汇总
    const productMap = new Map<string, { quantity: Decimal; sales: Decimal }>()

    for (const item of allItems) {
      const product = this.db.select()
        .from(products)
        .where(eq(products.id, item.productId))
        .get()

      const existing = productMap.get(item.productId) ?? {
        quantity: new Decimal(0),
        sales: new Decimal(0),
      }

      // 换算为基本单位
      let baseQuantity: Decimal
      if (product) {
        baseQuantity = this.convertToBaseUnit(
          product,
          new Decimal(item.quantity),
          item.unit
        )
      } else {
        baseQuantity = new Decimal(item.quantity)
      }

      productMap.set(item.productId, {
        quantity: existing.quantity.add(baseQuantity),
        sales: existing.sales.add(new Decimal(item.subtotal)),
      })
    }

    // 转换为数组并按销售数量排序
    const sortedProducts = Array.from(productMap.entries())
      .map(([productId, data]) => {
        const product = this.db.select()
          .from(products)
          .where(eq(products.id, productId))
          .get()

        return {
          productId,
          product,
          quantity: data.quantity.toDecimalPlaces(3).toNumber(),
          sales: data.sales.toDecimalPlaces(2).toNumber(),
        }
      })
      .filter(item => item.product !== undefined)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)

    return sortedProducts.map(item => ({
      product: item.product!,
      quantity: item.quantity,
      sales: item.sales,
    }))
  }

  // ==================== 毛利润计算 ====================

  /**
   * 计算毛利润
   * 需求: 5.6 - 计算并显示毛利润（销售额减去进货成本）
   * 
   * 属性 19: 毛利润计算
   * 对于任意时间段，毛利润应该等于该时间段内所有销售单的销售额减去对应商品的进货成本
   */
  calculateGrossProfit(startDate: Date, endDate: Date): GrossProfitResult {
    // 查询已确认的销售单
    const orders = this.db.select()
      .from(salesOrders)
      .where(and(
        eq(salesOrders.status, 'CONFIRMED'),
        gte(salesOrders.orderDate, startDate),
        lte(salesOrders.orderDate, endDate)
      ))
      .all()

    if (orders.length === 0) {
      return {
        totalSales: 0,
        totalCost: 0,
        grossProfit: 0,
        profitMargin: 0,
      }
    }

    // 计算总销售额
    const totalSales = orders.reduce(
      (sum, order) => sum.add(new Decimal(order.totalAmount)),
      new Decimal(0)
    )

    // 获取所有订单明细
    const orderIds = orders.map(o => o.id)
    const allItems = this.db.select()
      .from(salesOrderItems)
      .where(inArray(salesOrderItems.salesOrderId, orderIds))
      .all()

    // 计算总成本（使用商品的进货价）
    let totalCost = new Decimal(0)
    for (const item of allItems) {
      const product = this.db.select()
        .from(products)
        .where(eq(products.id, item.productId))
        .get()

      if (product) {
        // 换算为基本单位
        const baseQuantity = this.convertToBaseUnit(
          product,
          new Decimal(item.quantity),
          item.unit
        )
        // 成本 = 基本单位数量 × 进货价
        const itemCost = baseQuantity.mul(new Decimal(product.purchasePrice))
        totalCost = totalCost.add(itemCost)
      }
    }

    // 计算毛利润
    const grossProfit = totalSales.sub(totalCost)

    // 计算毛利率
    let profitMargin = new Decimal(0)
    if (!totalSales.isZero()) {
      profitMargin = grossProfit.div(totalSales).mul(100)
    }

    return {
      totalSales: totalSales.toDecimalPlaces(2).toNumber(),
      totalCost: totalCost.toDecimalPlaces(2).toNumber(),
      grossProfit: grossProfit.toDecimalPlaces(2).toNumber(),
      profitMargin: profitMargin.toDecimalPlaces(2).toNumber(),
    }
  }

  // ==================== 历史销售记录查询 ====================

  /**
   * 查询历史销售记录
   * 需求: 5.1, 5.2 - 记录所有已确认的销售单信息，允许查询历史销售记录
   */
  searchSalesHistory(params: SearchStatisticsParams = {}): Array<SalesOrder & { items: SalesOrderItem[] }> {
    const { startDate, endDate, productId } = params

    // 构建查询条件
    const conditions = [eq(salesOrders.status, 'CONFIRMED')]

    if (startDate) {
      conditions.push(gte(salesOrders.orderDate, startDate))
    }

    if (endDate) {
      conditions.push(lte(salesOrders.orderDate, endDate))
    }

    // 执行查询
    const orders = this.db.select()
      .from(salesOrders)
      .where(and(...conditions))
      .orderBy(desc(salesOrders.orderDate))
      .all()

    if (orders.length === 0) return []

    // 批量获取订单明细
    const orderIds = orders.map(o => o.id)
    const allItems = this.db.select()
      .from(salesOrderItems)
      .where(inArray(salesOrderItems.salesOrderId, orderIds))
      .all()

    // 如果指定了商品ID，过滤只包含该商品的订单
    let filteredOrders = orders
    if (productId) {
      const orderIdsWithProduct = new Set(
        allItems
          .filter(item => item.productId === productId)
          .map(item => item.salesOrderId)
      )
      filteredOrders = orders.filter(order => orderIdsWithProduct.has(order.id))
    }

    return filteredOrders.map(order => ({
      ...order,
      items: allItems.filter(item => item.salesOrderId === order.id),
    }))
  }

  // ==================== 商品销售明细 ====================

  /**
   * 获取指定商品的销售明细
   */
  getProductSalesDetail(
    productId: string,
    startDate: Date,
    endDate: Date
  ): {
    product: Product | null
    totalQuantity: number
    totalSales: number
    orderCount: number
    details: Array<{
      orderNumber: string
      orderDate: Date
      quantity: number
      unit: string
      unitPrice: number
      subtotal: number
    }>
  } {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    // 查询已确认的销售单
    const orders = this.db.select()
      .from(salesOrders)
      .where(and(
        eq(salesOrders.status, 'CONFIRMED'),
        gte(salesOrders.orderDate, startDate),
        lte(salesOrders.orderDate, endDate)
      ))
      .all()

    if (orders.length === 0) {
      return {
        product: product ?? null,
        totalQuantity: 0,
        totalSales: 0,
        orderCount: 0,
        details: [],
      }
    }

    // 获取包含该商品的订单明细
    const orderIds = orders.map(o => o.id)
    const items = this.db.select()
      .from(salesOrderItems)
      .where(and(
        inArray(salesOrderItems.salesOrderId, orderIds),
        eq(salesOrderItems.productId, productId)
      ))
      .all()

    if (items.length === 0) {
      return {
        product: product ?? null,
        totalQuantity: 0,
        totalSales: 0,
        orderCount: 0,
        details: [],
      }
    }

    // 计算汇总数据
    let totalQuantity = new Decimal(0)
    let totalSales = new Decimal(0)
    const orderSet = new Set<string>()

    const details: Array<{
      orderNumber: string
      orderDate: Date
      quantity: number
      unit: string
      unitPrice: number
      subtotal: number
    }> = []

    for (const item of items) {
      const order = orders.find(o => o.id === item.salesOrderId)
      if (!order) continue

      orderSet.add(order.id)

      // 换算为基本单位
      let baseQuantity: Decimal
      if (product) {
        baseQuantity = this.convertToBaseUnit(
          product,
          new Decimal(item.quantity),
          item.unit
        )
      } else {
        baseQuantity = new Decimal(item.quantity)
      }

      totalQuantity = totalQuantity.add(baseQuantity)
      totalSales = totalSales.add(new Decimal(item.subtotal))

      details.push({
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })
    }

    return {
      product: product ?? null,
      totalQuantity: totalQuantity.toDecimalPlaces(3).toNumber(),
      totalSales: totalSales.toDecimalPlaces(2).toNumber(),
      orderCount: orderSet.size,
      details: details.sort((a, b) => 
        b.orderDate.getTime() - a.orderDate.getTime()
      ),
    }
  }
}

// ==================== 工厂函数 ====================

export function createStatisticsService(db: DbType): StatisticsService {
  return new StatisticsService(db)
}

export function createStatisticsServiceFromSqlite(sqlite: Database.Database): StatisticsService {
  const db = drizzle(sqlite, { schema: { ...schema, ...relations } })
  return new StatisticsService(db)
}
