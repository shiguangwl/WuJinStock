/**
 * 商品服务层
 * 实现商品的增删改查、编码生成等核心业务逻辑
 */
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'
import { products, packageUnits, inventoryRecords, productStorageLocations, storageLocations, type Product, type NewProduct, type PackageUnit, type ProductStorageLocation, type StorageLocation } from '@/server/db/schema'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { eq, like, or, inArray } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import Decimal from 'decimal.js'

// ==================== 类型定义 ====================

type DbSchema = typeof schema & typeof relations
type DbType = BetterSQLite3Database<DbSchema>

export interface CreateProductInput {
  name: string
  specification?: string
  baseUnit: string
  purchasePrice: number
  retailPrice: number
  supplier?: string
  minStockThreshold?: number
}

export interface UpdateProductInput {
  name?: string
  specification?: string
  baseUnit?: string
  purchasePrice?: number
  retailPrice?: number
  supplier?: string
  minStockThreshold?: number
}

export interface SearchProductsParams {
  keyword?: string
  location?: string
}

export interface ProductStorageLocationWithLocation extends ProductStorageLocation {
  location: StorageLocation | null
}

export interface ProductWithRelations extends Product {
  packageUnits: PackageUnit[]
  storageLocations: ProductStorageLocationWithLocation[]
}

// ==================== 错误类型 ====================

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProductValidationError'
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`商品不存在: ${productId}`)
    this.name = 'ProductNotFoundError'
  }
}

export class DuplicateProductCodeError extends Error {
  constructor(code: string) {
    super(`商品编码已存在: ${code}`)
    this.name = 'DuplicateProductCodeError'
  }
}

export class PackageUnitValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageUnitValidationError'
  }
}

export class PackageUnitNotFoundError extends Error {
  constructor(productId: string, unitName: string) {
    super(`包装单位不存在: ${unitName} (商品ID: ${productId})`)
    this.name = 'PackageUnitNotFoundError'
  }
}

export class PackageUnitInUseError extends Error {
  constructor(unitName: string) {
    super(`包装单位已被使用，无法删除: ${unitName}`)
    this.name = 'PackageUnitInUseError'
  }
}

// ==================== 商品服务类 ====================

export class ProductService {
  private db: DbType

  constructor(db: DbType) {
    this.db = db
  }

  /**
   * 生成唯一的商品编码
   * 格式: SP + 6位字符
   */
  generateProductCode(): string {
    const prefix = 'SP'
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4)
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `${prefix}${timestamp}${random}`
  }

  /**
   * 生成唯一的商品编码（带重复检查）
   */
  generateUniqueProductCode(): string {
    let code: string
    let attempts = 0
    const maxAttempts = 10

    do {
      code = this.generateProductCode()
      const existing = this.db.select().from(products).where(eq(products.code, code)).get()
      if (!existing) {
        return code
      }
      attempts++
    } while (attempts < maxAttempts)

    // 如果多次尝试都失败，使用 cuid2 确保唯一性
    return `SP${createId().slice(0, 6).toUpperCase()}`
  }

  /**
   * 验证商品数据
   */
  private validateProductData(data: CreateProductInput): void {
    // 验证必填字段
    if (!data.name || data.name.trim().length === 0) {
      throw new ProductValidationError('商品名称不能为空')
    }

    if (!data.baseUnit || data.baseUnit.trim().length === 0) {
      throw new ProductValidationError('基本单位不能为空')
    }

    if (data.retailPrice === undefined || data.retailPrice === null) {
      throw new ProductValidationError('零售价不能为空')
    }

    // 验证价格有效性
    if (data.retailPrice < 0) {
      throw new ProductValidationError('零售价不能为负数')
    }

    if (data.purchasePrice < 0) {
      throw new ProductValidationError('进货价不能为负数')
    }

    // 验证库存阈值
    if (data.minStockThreshold !== undefined && data.minStockThreshold < 0) {
      throw new ProductValidationError('最低库存阈值不能为负数')
    }
  }

  /**
   * 创建商品
   * 需求: 1.1, 1.2, 1.5
   */
  createProduct(data: CreateProductInput): Product {
    // 验证数据
    this.validateProductData(data)

    // 生成唯一编码
    const code = this.generateUniqueProductCode()

    // 使用 Decimal.js 处理价格精度
    const purchasePrice = new Decimal(data.purchasePrice).toDecimalPlaces(4).toNumber()
    const retailPrice = new Decimal(data.retailPrice).toDecimalPlaces(4).toNumber()
    const minStockThreshold = data.minStockThreshold !== undefined 
      ? new Decimal(data.minStockThreshold).toDecimalPlaces(3).toNumber()
      : 0

    const now = new Date()

    const result = this.db.insert(products).values({
      code,
      name: data.name.trim(),
      specification: data.specification?.trim() || null,
      baseUnit: data.baseUnit.trim(),
      purchasePrice,
      retailPrice,
      supplier: data.supplier?.trim() || null,
      minStockThreshold,
      createdAt: now,
      updatedAt: now,
    }).returning().get()

    // 创建初始库存记录（数量为0）
    this.db.insert(inventoryRecords).values({
      productId: result.id,
      quantity: 0,
      lastUpdated: now,
    }).run()

    return result
  }

  /**
   * 更新商品信息
   * 需求: 1.3
   */
  updateProduct(productId: string, data: UpdateProductInput): Product {
    // 检查商品是否存在
    const existing = this.getProductById(productId)
    if (!existing) {
      throw new ProductNotFoundError(productId)
    }

    // 构建更新数据
    const updateData: Partial<NewProduct> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new ProductValidationError('商品名称不能为空')
      }
      updateData.name = data.name.trim()
    }

    if (data.specification !== undefined) {
      updateData.specification = data.specification?.trim() || null
    }

    if (data.baseUnit !== undefined) {
      if (!data.baseUnit || data.baseUnit.trim().length === 0) {
        throw new ProductValidationError('基本单位不能为空')
      }
      updateData.baseUnit = data.baseUnit.trim()
    }

    if (data.purchasePrice !== undefined) {
      if (data.purchasePrice < 0) {
        throw new ProductValidationError('进货价不能为负数')
      }
      updateData.purchasePrice = new Decimal(data.purchasePrice).toDecimalPlaces(4).toNumber()
    }

    if (data.retailPrice !== undefined) {
      if (data.retailPrice < 0) {
        throw new ProductValidationError('零售价不能为负数')
      }
      updateData.retailPrice = new Decimal(data.retailPrice).toDecimalPlaces(4).toNumber()
    }

    if (data.supplier !== undefined) {
      updateData.supplier = data.supplier?.trim() || null
    }

    if (data.minStockThreshold !== undefined) {
      if (data.minStockThreshold < 0) {
        throw new ProductValidationError('最低库存阈值不能为负数')
      }
      updateData.minStockThreshold = new Decimal(data.minStockThreshold).toDecimalPlaces(3).toNumber()
    }

    const result = this.db.update(products)
      .set(updateData)
      .where(eq(products.id, productId))
      .returning()
      .get()

    return result
  }

  /**
   * 获取商品基本信息（不含关联）
   */
  getProductById(productId: string): Product | null {
    const product = this.db.select().from(products).where(eq(products.id, productId)).get()
    return product ?? null
  }

  /**
   * 获取商品详情（带关联数据）
   * 需求: 1.4
   */
  getProduct(productId: string): ProductWithRelations | null {
    // 获取商品基本信息
    const product = this.db.select().from(products).where(eq(products.id, productId)).get()
    if (!product) return null

    // 获取包装单位
    const units = this.db.select().from(packageUnits).where(eq(packageUnits.productId, productId)).all()

    // 获取存放位置关联
    const locationLinks = this.db.select().from(productStorageLocations).where(eq(productStorageLocations.productId, productId)).all()
    
    // 获取位置详情
    const locationIds = locationLinks.map(l => l.locationId)
    const locations = locationIds.length > 0 
      ? this.db.select().from(storageLocations).where(inArray(storageLocations.id, locationIds)).all()
      : []
    
    // 组装存放位置数据
    const storageLocationData: ProductStorageLocationWithLocation[] = locationLinks.map(link => ({
      ...link,
      location: locations.find(l => l.id === link.locationId) ?? null,
    }))

    return {
      ...product,
      packageUnits: units,
      storageLocations: storageLocationData,
    }
  }

  /**
   * 根据编码获取商品
   */
  getProductByCode(code: string): Product | null {
    const product = this.db.select().from(products).where(eq(products.code, code)).get()
    return product ?? null
  }

  /**
   * 搜索商品
   * 支持按名称、规格模糊搜索
   * 需求: 1.4
   */
  searchProducts(params: SearchProductsParams = {}): ProductWithRelations[] {
    const { keyword, location } = params

    // 获取商品列表
    let productList: Product[]
    
    if (keyword && keyword.trim().length > 0) {
      // 转义 SQL LIKE 通配符，确保搜索字面字符
      const escapedKeyword = keyword.trim()
        .replace(/\\/g, '\\\\')  // 先转义反斜杠
        .replace(/%/g, '\\%')    // 转义 %
        .replace(/_/g, '\\_')    // 转义 _
      const searchTerm = `%${escapedKeyword}%`
      productList = this.db.select().from(products).where(
        or(
          like(products.name, searchTerm),
          like(products.specification, searchTerm),
          like(products.code, searchTerm),
        )
      ).all()
    } else {
      productList = this.db.select().from(products).all()
    }

    if (productList.length === 0) return []

    // 批量获取包装单位
    const productIds = productList.map(p => p.id)
    const allUnits = this.db.select().from(packageUnits).where(inArray(packageUnits.productId, productIds)).all()

    // 批量获取存放位置关联
    const allLocationLinks = this.db.select().from(productStorageLocations).where(inArray(productStorageLocations.productId, productIds)).all()
    
    // 获取所有位置详情
    const locationIds = [...new Set(allLocationLinks.map(l => l.locationId))]
    const allLocations = locationIds.length > 0 
      ? this.db.select().from(storageLocations).where(inArray(storageLocations.id, locationIds)).all()
      : []

    // 组装结果
    let results: ProductWithRelations[] = productList.map(product => {
      const units = allUnits.filter(u => u.productId === product.id)
      const locationLinks = allLocationLinks.filter(l => l.productId === product.id)
      const storageLocationData: ProductStorageLocationWithLocation[] = locationLinks.map(link => ({
        ...link,
        location: allLocations.find(l => l.id === link.locationId) ?? null,
      }))

      return {
        ...product,
        packageUnits: units,
        storageLocations: storageLocationData,
      }
    })

    // 如果需要按位置过滤
    if (location && location.trim().length > 0) {
      results = results.filter((product) => 
        product.storageLocations.some(sl => 
          sl.location?.name.includes(location.trim())
        )
      )
    }

    return results
  }

  /**
   * 获取所有商品
   */
  getAllProducts(): Product[] {
    return this.db.select().from(products).all()
  }

  /**
   * 删除商品
   */
  deleteProduct(productId: string): void {
    const existing = this.getProductById(productId)
    if (!existing) {
      throw new ProductNotFoundError(productId)
    }

    this.db.delete(products).where(eq(products.id, productId)).run()
  }

  /**
   * 检查商品编码是否已存在
   */
  isCodeExists(code: string): boolean {
    const existing = this.db.select().from(products).where(eq(products.code, code)).get()
    return !!existing
  }

  // ==================== 包装单位管理 ====================

  /**
   * 添加包装单位
   * 需求: 1.6, 1.7, 1.1.1, 1.1.2, 1.1.3
   */
  addPackageUnit(
    productId: string,
    unitName: string,
    conversionRate: number,
    options?: {
      purchasePrice?: number
      retailPrice?: number
    }
  ): PackageUnit {
    // 验证商品存在
    const product = this.getProductById(productId)
    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 验证单位名称
    if (!unitName || unitName.trim().length === 0) {
      throw new PackageUnitValidationError('包装单位名称不能为空')
    }

    // 验证换算比例
    if (conversionRate <= 0) {
      throw new PackageUnitValidationError('换算比例必须大于零')
    }

    // 检查是否已存在同名单位
    const existing = this.db.select().from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()
      .find(u => u.name === unitName.trim())
    
    if (existing) {
      throw new PackageUnitValidationError(`包装单位已存在: ${unitName}`)
    }

    // 处理精度
    const rate = new Decimal(conversionRate).toDecimalPlaces(4).toNumber()
    const purchasePrice = options?.purchasePrice !== undefined
      ? new Decimal(options.purchasePrice).toDecimalPlaces(4).toNumber()
      : null
    const retailPrice = options?.retailPrice !== undefined
      ? new Decimal(options.retailPrice).toDecimalPlaces(4).toNumber()
      : null

    const result = this.db.insert(packageUnits).values({
      productId,
      name: unitName.trim(),
      conversionRate: rate,
      purchasePrice,
      retailPrice,
    }).returning().get()

    return result
  }

  /**
   * 更新包装单位
   */
  updatePackageUnit(
    productId: string,
    unitName: string,
    updates: {
      conversionRate?: number
      purchasePrice?: number | null
      retailPrice?: number | null
    }
  ): PackageUnit {
    // 验证商品存在
    const product = this.getProductById(productId)
    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 查找包装单位
    const existing = this.db.select().from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()
      .find(u => u.name === unitName)
    
    if (!existing) {
      throw new PackageUnitNotFoundError(productId, unitName)
    }

    // 构建更新数据
    const updateData: Partial<PackageUnit> = {}

    if (updates.conversionRate !== undefined) {
      if (updates.conversionRate <= 0) {
        throw new PackageUnitValidationError('换算比例必须大于零')
      }
      updateData.conversionRate = new Decimal(updates.conversionRate).toDecimalPlaces(4).toNumber()
    }

    if (updates.purchasePrice !== undefined) {
      updateData.purchasePrice = updates.purchasePrice !== null
        ? new Decimal(updates.purchasePrice).toDecimalPlaces(4).toNumber()
        : null
    }

    if (updates.retailPrice !== undefined) {
      updateData.retailPrice = updates.retailPrice !== null
        ? new Decimal(updates.retailPrice).toDecimalPlaces(4).toNumber()
        : null
    }

    const result = this.db.update(packageUnits)
      .set(updateData)
      .where(eq(packageUnits.id, existing.id))
      .returning()
      .get()

    return result
  }

  /**
   * 删除包装单位
   * 需求: 1.1.6 - 如果该单位已被历史订单使用，阻止删除
   */
  removePackageUnit(productId: string, unitName: string): void {
    // 验证商品存在
    const product = this.getProductById(productId)
    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 查找包装单位
    const existing = this.db.select().from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()
      .find(u => u.name === unitName)
    
    if (!existing) {
      throw new PackageUnitNotFoundError(productId, unitName)
    }

    // TODO: 检查是否被历史订单使用（需要在订单模块实现后添加）
    // 目前先允许删除

    this.db.delete(packageUnits).where(eq(packageUnits.id, existing.id)).run()
  }

  /**
   * 获取商品的所有包装单位
   */
  getPackageUnits(productId: string): PackageUnit[] {
    return this.db.select().from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()
  }

  /**
   * 计算包装单位价格
   * 如果包装单位有特定价格则使用特定价格，否则使用基础价格 × 换算率
   * 需求: 1.1.1, 1.1.2, 1.1.3
   */
  calculatePackageUnitPrice(
    product: Product,
    packageUnit: PackageUnit,
    priceType: 'purchase' | 'retail'
  ): number {
    if (priceType === 'purchase') {
      // 优先使用包装单位特定价格
      if (packageUnit.purchasePrice !== null) {
        return packageUnit.purchasePrice
      }
      // 否则使用基础价格 × 换算率
      return new Decimal(product.purchasePrice)
        .mul(packageUnit.conversionRate)
        .toDecimalPlaces(4)
        .toNumber()
    } else {
      // 优先使用包装单位特定价格
      if (packageUnit.retailPrice !== null) {
        return packageUnit.retailPrice
      }
      // 否则使用基础价格 × 换算率
      return new Decimal(product.retailPrice)
        .mul(packageUnit.conversionRate)
        .toDecimalPlaces(4)
        .toNumber()
    }
  }

  /**
   * 获取商品指定单位的价格
   * 如果是基本单位，返回基础价格；如果是包装单位，计算包装单位价格
   */
  getUnitPrice(
    productId: string,
    unitName: string,
    priceType: 'purchase' | 'retail'
  ): number {
    const product = this.getProductById(productId)
    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    // 如果是基本单位
    if (unitName === product.baseUnit) {
      return priceType === 'purchase' ? product.purchasePrice : product.retailPrice
    }

    // 查找包装单位
    const packageUnit = this.db.select().from(packageUnits)
      .where(eq(packageUnits.productId, productId))
      .all()
      .find(u => u.name === unitName)

    if (!packageUnit) {
      throw new PackageUnitNotFoundError(productId, unitName)
    }

    return this.calculatePackageUnitPrice(product, packageUnit, priceType)
  }
}

// 工厂函数：创建带数据库连接的服务实例
export function createProductService(db: DbType): ProductService {
  return new ProductService(db)
}

// 工厂函数：从 SQLite 实例创建服务
export function createProductServiceFromSqlite(sqlite: Database.Database): ProductService {
  const db = drizzle(sqlite, { schema: { ...schema, ...relations } })
  return new ProductService(db)
}
