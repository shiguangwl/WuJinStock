/**
 * 盘点服务层
 * 实现盘点的创建、录入、完成等核心业务逻辑
 * 需求: 2.5, 2.6, 2.7
 */
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'
import {
  products,
  inventoryRecords,
  inventoryTransactions,
  stockTakings,
  stockTakingItems,
  type Product,
  type StockTaking,
  type StockTakingItem,
  type StockTakingStatus,
  type StockTakingWithItems,
} from '@/server/db/schema'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { eq, desc, inArray } from 'drizzle-orm'
import Decimal from 'decimal.js'

// Re-export for backward compatibility
export type { StockTakingWithItems }

// ==================== 类型定义 ====================

type DbSchema = typeof schema & typeof relations
type DbType = BetterSQLite3Database<DbSchema>

export interface RecordActualQuantityInput {
  productId: string
  actualQuantity: number
}

// ==================== 错误类型 ====================

export class StockTakingNotFoundError extends Error {
  constructor(takingId: string) {
    super(`盘点记录不存在: ${takingId}`)
    this.name = 'StockTakingNotFoundError'
  }
}

export class StockTakingAlreadyCompletedError extends Error {
  constructor(takingId: string) {
    super(`盘点已完成，无法修改: ${takingId}`)
    this.name = 'StockTakingAlreadyCompletedError'
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`商品不存在: ${productId}`)
    this.name = 'ProductNotFoundError'
  }
}

export class InvalidQuantityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidQuantityError'
  }
}

export class StockTakingItemNotFoundError extends Error {
  constructor(takingId: string, productId: string) {
    super(`盘点明细不存在: 盘点ID ${takingId}, 商品ID ${productId}`)
    this.name = 'StockTakingItemNotFoundError'
  }
}

// ==================== 盘点服务类 ====================

export class StockTakingService {
  private db: DbType

  constructor(db: DbType) {
    this.db = db
  }

  // ==================== 盘点管理 ====================

  /**
   * 创建盘点记录
   * 需求: 2.5
   * 创建盘点时，自动将所有商品的当前库存作为系统数量记录
   */
  createStockTaking(takingDate?: Date): StockTakingWithItems {
    const now = new Date()
    const date = takingDate ?? now

    // 创建盘点记录
    const stockTaking = this.db.insert(stockTakings).values({
      takingDate: date,
      status: 'IN_PROGRESS',
      createdAt: now,
    }).returning().get()

    // 获取所有商品及其库存
    const allProducts = this.db.select().from(products).all()
    const allInventory = this.db.select().from(inventoryRecords).all()

    // 为每个商品创建盘点明细
    const items: StockTakingItem[] = []
    for (const product of allProducts) {
      const inventory = allInventory.find(i => i.productId === product.id)
      const systemQuantity = inventory?.quantity ?? 0

      const item = this.db.insert(stockTakingItems).values({
        stockTakingId: stockTaking.id,
        productId: product.id,
        productName: product.name,
        systemQuantity: new Decimal(systemQuantity).toDecimalPlaces(3).toNumber(),
        actualQuantity: new Decimal(systemQuantity).toDecimalPlaces(3).toNumber(), // 初始值等于系统数量
        difference: 0, // 初始差异为0
        unit: product.baseUnit,
      }).returning().get()

      items.push(item)
    }

    return { ...stockTaking, items }
  }

  /**
   * 记录实际盘点数量
   * 需求: 2.5, 2.6
   */
  recordActualQuantity(
    takingId: string,
    productId: string,
    actualQuantity: number
  ): StockTakingItem {
    // 获取盘点记录
    const stockTaking = this.db.select()
      .from(stockTakings)
      .where(eq(stockTakings.id, takingId))
      .get()

    if (!stockTaking) {
      throw new StockTakingNotFoundError(takingId)
    }

    // 检查盘点状态
    if (stockTaking.status === 'COMPLETED') {
      throw new StockTakingAlreadyCompletedError(takingId)
    }

    // 验证数量非负
    if (actualQuantity < 0) {
      throw new InvalidQuantityError('实际数量不能为负数')
    }

    // 获取盘点明细
    const item = this.db.select()
      .from(stockTakingItems)
      .where(eq(stockTakingItems.stockTakingId, takingId))
      .all()
      .find(i => i.productId === productId)

    if (!item) {
      throw new StockTakingItemNotFoundError(takingId, productId)
    }

    // 计算差异 = 实际数量 - 系统数量
    const actualQty = new Decimal(actualQuantity).toDecimalPlaces(3)
    const systemQty = new Decimal(item.systemQuantity)
    const difference = actualQty.sub(systemQty).toDecimalPlaces(3)

    // 更新盘点明细
    const updatedItem = this.db.update(stockTakingItems)
      .set({
        actualQuantity: actualQty.toNumber(),
        difference: difference.toNumber(),
      })
      .where(eq(stockTakingItems.id, item.id))
      .returning()
      .get()

    return updatedItem
  }

  /**
   * 批量记录实际盘点数量
   */
  recordActualQuantities(
    takingId: string,
    inputs: RecordActualQuantityInput[]
  ): StockTakingItem[] {
    const results: StockTakingItem[] = []
    for (const input of inputs) {
      const item = this.recordActualQuantity(takingId, input.productId, input.actualQuantity)
      results.push(item)
    }
    return results
  }

  /**
   * 完成盘点（更新库存）
   * 需求: 2.7
   */
  completeStockTaking(takingId: string): StockTakingWithItems {
    // 获取盘点记录
    const stockTaking = this.db.select()
      .from(stockTakings)
      .where(eq(stockTakings.id, takingId))
      .get()

    if (!stockTaking) {
      throw new StockTakingNotFoundError(takingId)
    }

    // 检查盘点状态
    if (stockTaking.status === 'COMPLETED') {
      throw new StockTakingAlreadyCompletedError(takingId)
    }

    // 获取盘点明细
    const items = this.db.select()
      .from(stockTakingItems)
      .where(eq(stockTakingItems.stockTakingId, takingId))
      .all()

    const now = new Date()

    // 更新库存
    for (const item of items) {
      // 只处理有差异的商品
      if (item.difference === 0) continue

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

      // 更新库存为实际数量
      this.db.update(inventoryRecords)
        .set({
          quantity: new Decimal(item.actualQuantity).toDecimalPlaces(3).toNumber(),
          lastUpdated: now,
        })
        .where(eq(inventoryRecords.productId, item.productId))
        .run()

      // 记录库存变动（差异值）
      this.db.insert(inventoryTransactions).values({
        productId: item.productId,
        transactionType: 'ADJUSTMENT',
        quantityChange: new Decimal(item.difference).toDecimalPlaces(3).toNumber(),
        unit: item.unit,
        referenceId: takingId,
        timestamp: now,
        note: `盘点调整: 系统数量 ${item.systemQuantity}, 实际数量 ${item.actualQuantity}`,
      }).run()
    }

    // 更新盘点状态
    const updatedStockTaking = this.db.update(stockTakings)
      .set({
        status: 'COMPLETED',
        completedAt: now,
      })
      .where(eq(stockTakings.id, takingId))
      .returning()
      .get()

    return { ...updatedStockTaking, items }
  }

  /**
   * 获取盘点记录详情
   */
  getStockTaking(takingId: string): StockTakingWithItems | null {
    const stockTaking = this.db.select()
      .from(stockTakings)
      .where(eq(stockTakings.id, takingId))
      .get()

    if (!stockTaking) return null

    const items = this.db.select()
      .from(stockTakingItems)
      .where(eq(stockTakingItems.stockTakingId, takingId))
      .all()

    return { ...stockTaking, items }
  }

  /**
   * 获取所有盘点记录
   */
  getAllStockTakings(): StockTakingWithItems[] {
    const takings = this.db.select()
      .from(stockTakings)
      .orderBy(desc(stockTakings.takingDate))
      .all()

    if (takings.length === 0) return []

    const takingIds = takings.map(t => t.id)
    const allItems = this.db.select()
      .from(stockTakingItems)
      .where(inArray(stockTakingItems.stockTakingId, takingIds))
      .all()

    return takings.map(taking => ({
      ...taking,
      items: allItems.filter(item => item.stockTakingId === taking.id),
    }))
  }

  /**
   * 获取盘点记录（按状态筛选）
   */
  getStockTakingsByStatus(status: StockTakingStatus): StockTakingWithItems[] {
    const takings = this.db.select()
      .from(stockTakings)
      .where(eq(stockTakings.status, status))
      .orderBy(desc(stockTakings.takingDate))
      .all()

    if (takings.length === 0) return []

    const takingIds = takings.map(t => t.id)
    const allItems = this.db.select()
      .from(stockTakingItems)
      .where(inArray(stockTakingItems.stockTakingId, takingIds))
      .all()

    return takings.map(taking => ({
      ...taking,
      items: allItems.filter(item => item.stockTakingId === taking.id),
    }))
  }

  /**
   * 删除盘点记录（仅限进行中状态）
   */
  deleteStockTaking(takingId: string): void {
    const stockTaking = this.db.select()
      .from(stockTakings)
      .where(eq(stockTakings.id, takingId))
      .get()

    if (!stockTaking) {
      throw new StockTakingNotFoundError(takingId)
    }

    if (stockTaking.status === 'COMPLETED') {
      throw new StockTakingAlreadyCompletedError(takingId)
    }

    // 级联删除会自动删除明细
    this.db.delete(stockTakings).where(eq(stockTakings.id, takingId)).run()
  }

  /**
   * 获取盘点差异汇总
   */
  getStockTakingDifferenceSummary(takingId: string): {
    totalItems: number
    itemsWithDifference: number
    totalPositiveDifference: number
    totalNegativeDifference: number
  } {
    const stockTaking = this.getStockTaking(takingId)
    if (!stockTaking) {
      throw new StockTakingNotFoundError(takingId)
    }

    const items = stockTaking.items
    const itemsWithDifference = items.filter(i => i.difference !== 0)

    let totalPositiveDifference = new Decimal(0)
    let totalNegativeDifference = new Decimal(0)

    for (const item of itemsWithDifference) {
      const diff = new Decimal(item.difference)
      if (diff.gt(0)) {
        totalPositiveDifference = totalPositiveDifference.add(diff)
      } else {
        totalNegativeDifference = totalNegativeDifference.add(diff.abs())
      }
    }

    return {
      totalItems: items.length,
      itemsWithDifference: itemsWithDifference.length,
      totalPositiveDifference: totalPositiveDifference.toDecimalPlaces(3).toNumber(),
      totalNegativeDifference: totalNegativeDifference.toDecimalPlaces(3).toNumber(),
    }
  }
}

// ==================== 工厂函数 ====================

export function createStockTakingService(db: DbType): StockTakingService {
  return new StockTakingService(db)
}

export function createStockTakingServiceFromSqlite(sqlite: Database.Database): StockTakingService {
  const db = drizzle(sqlite, { schema: { ...schema, ...relations } })
  return new StockTakingService(db)
}
