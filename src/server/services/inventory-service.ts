/**
 * 库存服务层
 * 实现库存查询、预警、调整、单位换算等核心业务逻辑
 * 需求: 2.1, 2.2, 2.3, 2.4, 2.8, 1.1.4, 1.1.5
 */
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'
import { 
  products, 
  packageUnits, 
  inventoryRecords, 
  inventoryTransactions,
  type Product, 
  type PackageUnit, 
  type InventoryRecord, 
  type InventoryTransaction,
  type TransactionType,
} from '@/server/db/schema'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { eq, and, gte, lte, lt, inArray } from 'drizzle-orm'
import Decimal from 'decimal.js'

// ==================== 类型定义 ====================

type DbSchema = typeof schema & typeof relations
type DbType = BetterSQLite3Database<DbSchema>

export interface InventoryWithProduct {
  inventory: InventoryRecord
  product: Product
}

export interface LowStockProduct {
  product: Product
  inventory: InventoryRecord
  deficit: number // 缺口数量 = 阈值 - 当前库存
}

export interface AdjustInventoryParams {
  productId: string
  quantityChange: number
  transactionType: TransactionType
  unit: string
  referenceId?: string
  note?: string
}

export interface GetTransactionsParams {
  productId?: string
  startDate?: Date
  endDate?: Date
  transactionType?: TransactionType
}

export interface InventoryTransactionWithProduct extends InventoryTransaction {
  product: Product | null
}

// ==================== 错误类型 ====================

export class InventoryNotFoundError extends Error {
  constructor(productId: string) {
    super(`库存记录不存在: ${productId}`)
    this.name = 'InventoryNotFoundError'
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

export class InsufficientStockError extends Error {
  constructor(productId: string, required: number, available: number) {
    super(`库存不足: 需要 ${required}，可用 ${available} (商品ID: ${productId})`)
    this.name = 'InsufficientStockError'
  }
}

export class InvalidQuantityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidQuantityError'
  }
}

// ==================== 库存服务类 ====================

export class InventoryService {
  private db: DbType

  constructor(db: DbType) {
    this.db = db
  }

  // ==================== 库存查询 ====================

  /**
   * 获取商品库存
   * 需求: 2.1
   */
  getInventory(productId: string): InventoryRecord | null {
    const record = this.db.select()
      .from(inventoryRecords)
      .where(eq(inventoryRecords.productId, productId))
      .get()
    return record ?? null
  }

  /**
   * 获取商品库存（带商品信息）
   */
  getInventoryWithProduct(productId: string): InventoryWithProduct | null {
    const inventory = this.getInventory(productId)
    if (!inventory) return null

    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()
    
    if (!product) return null

    return { inventory, product }
  }

  /**
   * 获取所有库存记录
   */
  getAllInventory(): InventoryWithProduct[] {
    const records = this.db.select()
      .from(inventoryRecords)
      .all()

    if (records.length === 0) return []

    const productIds = records.map(r => r.productId)
    const productList = this.db.select()
      .from(products)
      .where(inArray(products.id, productIds))
      .all()

    return records.map(inventory => ({
      inventory,
      product: productList.find(p => p.id === inventory.productId)!,
    })).filter(item => item.product !== undefined)
  }

  /**
   * 获取低库存商品列表
   * 需求: 2.3, 2.4
   */
  getLowStockProducts(): LowStockProduct[] {
    // 获取所有商品及其库存
    const allProducts = this.db.select().from(products).all()
    const allInventory = this.db.select().from(inventoryRecords).all()

    const lowStockProducts: LowStockProduct[] = []

    for (const product of allProducts) {
      const inventory = allInventory.find(i => i.productId === product.id)
      const currentQuantity = inventory?.quantity ?? 0
      const threshold = product.minStockThreshold ?? 0

      // 如果当前库存低于阈值，则为低库存
      if (currentQuantity < threshold) {
        lowStockProducts.push({
          product,
          inventory: inventory ?? {
            id: '',
            productId: product.id,
            quantity: 0,
            lastUpdated: new Date(),
          },
          deficit: new Decimal(threshold).sub(currentQuantity).toDecimalPlaces(3).toNumber(),
        })
      }
    }

    // 按缺口数量降序排序
    return lowStockProducts.sort((a, b) => b.deficit - a.deficit)
  }

  /**
   * 检查商品是否为低库存
   * 需求: 2.3
   */
  isLowStock(productId: string): boolean {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()
    
    if (!product) return false

    const inventory = this.getInventory(productId)
    const currentQuantity = inventory?.quantity ?? 0
    const threshold = product.minStockThreshold ?? 0

    return currentQuantity < threshold
  }

  // ==================== 库存调整 ====================

  /**
   * 调整库存
   * 需求: 2.8
   */
  adjustInventory(params: AdjustInventoryParams): InventoryRecord {
    const { productId, quantityChange, transactionType, unit, referenceId, note } = params

    // 验证商品存在
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()
    
    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 将数量换算为基本单位
    const baseQuantityChange = this.convertToBaseUnit(product, new Decimal(quantityChange), unit)

    // 获取或创建库存记录
    let inventory = this.getInventory(productId)
    const now = new Date()

    if (!inventory) {
      // 创建新的库存记录
      inventory = this.db.insert(inventoryRecords).values({
        productId,
        quantity: 0,
        lastUpdated: now,
      }).returning().get()
    }

    // 计算新库存
    const currentQuantity = new Decimal(inventory.quantity)
    const newQuantity = currentQuantity.add(baseQuantityChange)

    // 验证库存不能为负（除非是盘点调整）
    if (newQuantity.lt(0) && transactionType !== 'ADJUSTMENT') {
      throw new InsufficientStockError(
        productId,
        Math.abs(baseQuantityChange.toNumber()),
        currentQuantity.toNumber()
      )
    }

    // 更新库存
    const updatedInventory = this.db.update(inventoryRecords)
      .set({
        quantity: newQuantity.toDecimalPlaces(3).toNumber(),
        lastUpdated: now,
      })
      .where(eq(inventoryRecords.productId, productId))
      .returning()
      .get()

    // 记录库存变动
    this.db.insert(inventoryTransactions).values({
      productId,
      transactionType,
      quantityChange: baseQuantityChange.toDecimalPlaces(3).toNumber(),
      unit: product.baseUnit, // 记录时使用基本单位
      referenceId: referenceId ?? null,
      timestamp: now,
      note: note ?? null,
    }).run()

    return updatedInventory
  }

  /**
   * 设置库存数量（用于盘点）
   */
  setInventoryQuantity(productId: string, newQuantity: number, note?: string): InventoryRecord {
    // 验证商品存在
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()
    
    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 验证数量非负
    if (newQuantity < 0) {
      throw new InvalidQuantityError('库存数量不能为负数')
    }

    // 获取当前库存
    const inventory = this.getInventory(productId)
    const currentQuantity = inventory?.quantity ?? 0
    const quantityChange = new Decimal(newQuantity).sub(currentQuantity)

    // 调整库存
    return this.adjustInventory({
      productId,
      quantityChange: quantityChange.toNumber(),
      transactionType: 'ADJUSTMENT',
      unit: product.baseUnit,
      note: note ?? '盘点调整',
    })
  }

  // ==================== 库存变动历史 ====================

  /**
   * 获取库存变动历史
   * 需求: 2.8
   */
  getInventoryTransactions(params: GetTransactionsParams = {}): InventoryTransactionWithProduct[] {
    const { productId, startDate, endDate, transactionType } = params

    // 构建查询条件
    const conditions = []
    
    if (productId) {
      conditions.push(eq(inventoryTransactions.productId, productId))
    }
    
    if (startDate) {
      conditions.push(gte(inventoryTransactions.timestamp, startDate))
    }
    
    if (endDate) {
      conditions.push(lte(inventoryTransactions.timestamp, endDate))
    }
    
    if (transactionType) {
      conditions.push(eq(inventoryTransactions.transactionType, transactionType))
    }

    // 执行查询
    let transactions: InventoryTransaction[]
    if (conditions.length > 0) {
      transactions = this.db.select()
        .from(inventoryTransactions)
        .where(and(...conditions))
        .orderBy(inventoryTransactions.timestamp)
        .all()
    } else {
      transactions = this.db.select()
        .from(inventoryTransactions)
        .orderBy(inventoryTransactions.timestamp)
        .all()
    }

    if (transactions.length === 0) return []

    // 获取关联的商品信息
    const productIds = [...new Set(transactions.map(t => t.productId))]
    const productList = this.db.select()
      .from(products)
      .where(inArray(products.id, productIds))
      .all()

    return transactions.map(transaction => ({
      ...transaction,
      product: productList.find(p => p.id === transaction.productId) ?? null,
    }))
  }

  // ==================== 单位换算 ====================

  /**
   * 将指定单位的数量转换为基本单位
   * 需求: 1.1.4
   */
  convertToBaseUnit(product: Product, quantity: Decimal, unit: string): Decimal {
    // 如果已经是基本单位，直接返回
    if (unit === product.baseUnit) {
      return quantity.toDecimalPlaces(3)
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

    // 换算: 包装数量 × 换算率 = 基本单位数量
    return quantity.mul(packageUnit.conversionRate).toDecimalPlaces(3)
  }

  /**
   * 将基本单位的数量转换为指定单位
   * 需求: 1.1.5
   */
  convertFromBaseUnit(product: Product, baseQuantity: Decimal, targetUnit: string): Decimal {
    // 如果目标是基本单位，直接返回
    if (targetUnit === product.baseUnit) {
      return baseQuantity.toDecimalPlaces(3)
    }

    // 查找包装单位
    const packageUnit = this.db.select()
      .from(packageUnits)
      .where(eq(packageUnits.productId, product.id))
      .all()
      .find(u => u.name === targetUnit)

    if (!packageUnit) {
      throw new UnitNotFoundError(product.id, targetUnit)
    }

    // 换算: 基本单位数量 ÷ 换算率 = 包装数量
    return baseQuantity.div(packageUnit.conversionRate).toDecimalPlaces(3)
  }

  /**
   * 通过商品ID进行单位换算（便捷方法）
   */
  convertToBaseUnitById(productId: string, quantity: Decimal, unit: string): Decimal {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    return this.convertToBaseUnit(product, quantity, unit)
  }

  /**
   * 通过商品ID进行单位换算（便捷方法）
   */
  convertFromBaseUnitById(productId: string, baseQuantity: Decimal, targetUnit: string): Decimal {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    return this.convertFromBaseUnit(product, baseQuantity, targetUnit)
  }

  // ==================== 库存充足性检查 ====================

  /**
   * 检查库存是否充足
   * 需求: 4.4, 4.5
   */
  checkStockAvailability(productId: string, quantity: Decimal, unit: string): boolean {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 将需求数量换算为基本单位
    const requiredBaseQuantity = this.convertToBaseUnit(product, quantity, unit)

    // 获取当前库存
    const inventory = this.getInventory(productId)
    const availableQuantity = new Decimal(inventory?.quantity ?? 0)

    // 检查是否充足
    return availableQuantity.gte(requiredBaseQuantity)
  }

  /**
   * 获取可用库存数量（指定单位）
   */
  getAvailableQuantity(productId: string, unit: string): Decimal {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    const inventory = this.getInventory(productId)
    const baseQuantity = new Decimal(inventory?.quantity ?? 0)

    // 如果请求的是基本单位，直接返回
    if (unit === product.baseUnit) {
      return baseQuantity
    }

    // 换算为目标单位
    return this.convertFromBaseUnit(product, baseQuantity, unit)
  }

  /**
   * 批量检查库存充足性
   */
  checkBatchStockAvailability(
    items: Array<{ productId: string; quantity: number; unit: string }>
  ): Array<{ productId: string; available: boolean; shortage?: number }> {
    return items.map(item => {
      try {
        const available = this.checkStockAvailability(
          item.productId,
          new Decimal(item.quantity),
          item.unit
        )

        if (available) {
          return { productId: item.productId, available: true }
        }

        // 计算缺口
        const product = this.db.select()
          .from(products)
          .where(eq(products.id, item.productId))
          .get()!

        const requiredBase = this.convertToBaseUnit(product, new Decimal(item.quantity), item.unit)
        const inventory = this.getInventory(item.productId)
        const availableBase = new Decimal(inventory?.quantity ?? 0)
        const shortage = requiredBase.sub(availableBase).toNumber()

        return { productId: item.productId, available: false, shortage }
      } catch {
        return { productId: item.productId, available: false }
      }
    })
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取商品的所有可用单位
   */
  getAvailableUnits(productId: string): string[] {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    const units = [product.baseUnit]

    const pkgUnits = this.db.select()
      .from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()

    units.push(...pkgUnits.map(u => u.name))

    return units
  }

  /**
   * 获取单位的换算率（相对于基本单位）
   */
  getConversionRate(productId: string, unit: string): Decimal {
    const product = this.db.select()
      .from(products)
      .where(eq(products.id, productId))
      .get()

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 基本单位的换算率为 1
    if (unit === product.baseUnit) {
      return new Decimal(1)
    }

    const packageUnit = this.db.select()
      .from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()
      .find(u => u.name === unit)

    if (!packageUnit) {
      throw new UnitNotFoundError(productId, unit)
    }

    return new Decimal(packageUnit.conversionRate)
  }
}

// ==================== 工厂函数 ====================

export function createInventoryService(db: DbType): InventoryService {
  return new InventoryService(db)
}

export function createInventoryServiceFromSqlite(sqlite: Database.Database): InventoryService {
  const db = drizzle(sqlite, { schema: { ...schema, ...relations } })
  return new InventoryService(db)
}
