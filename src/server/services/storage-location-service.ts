/**
 * 存放位置服务层
 * 实现存放位置的增删改查和商品关联管理
 */
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'
import { storageLocations, productStorageLocations, products, type StorageLocation, type NewStorageLocation, type ProductStorageLocation, type Product } from '@/server/db/schema'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { eq, like, inArray } from 'drizzle-orm'

// ==================== 类型定义 ====================

type DbSchema = typeof schema & typeof relations
type DbType = BetterSQLite3Database<DbSchema>

export interface CreateStorageLocationInput {
  name: string
  description?: string
}

export interface UpdateStorageLocationInput {
  name?: string
  description?: string
}

export interface StorageLocationWithProducts extends StorageLocation {
  products: Array<{
    link: ProductStorageLocation
    product: Product
  }>
}

// ==================== 错误类型 ====================

export class StorageLocationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageLocationValidationError'
  }
}

export class StorageLocationNotFoundError extends Error {
  constructor(locationId: string) {
    super(`存放位置不存在: ${locationId}`)
    this.name = 'StorageLocationNotFoundError'
  }
}

export class DuplicateStorageLocationError extends Error {
  constructor(name: string) {
    super(`存放位置名称已存在: ${name}`)
    this.name = 'DuplicateStorageLocationError'
  }
}

export class StorageLocationInUseError extends Error {
  constructor(name: string) {
    super(`存放位置正在使用中，无法删除: ${name}`)
    this.name = 'StorageLocationInUseError'
  }
}

// ==================== 存放位置服务类 ====================

export class StorageLocationService {
  private db: DbType

  constructor(db: DbType) {
    this.db = db
  }

  /**
   * 创建存放位置
   * 需求: 1.8
   */
  createStorageLocation(data: CreateStorageLocationInput): StorageLocation {
    // 验证名称
    if (!data.name || data.name.trim().length === 0) {
      throw new StorageLocationValidationError('存放位置名称不能为空')
    }

    // 检查名称是否已存在
    const existing = this.db.select().from(storageLocations)
      .where(eq(storageLocations.name, data.name.trim()))
      .get()
    
    if (existing) {
      throw new DuplicateStorageLocationError(data.name.trim())
    }

    const result = this.db.insert(storageLocations).values({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      createdAt: new Date(),
    }).returning().get()

    return result
  }

  /**
   * 更新存放位置
   */
  updateStorageLocation(locationId: string, data: UpdateStorageLocationInput): StorageLocation {
    const existing = this.getStorageLocationById(locationId)
    if (!existing) {
      throw new StorageLocationNotFoundError(locationId)
    }

    const updateData: Partial<NewStorageLocation> = {}

    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new StorageLocationValidationError('存放位置名称不能为空')
      }

      // 检查新名称是否与其他位置冲突
      const nameConflict = this.db.select().from(storageLocations)
        .where(eq(storageLocations.name, data.name.trim()))
        .get()
      
      if (nameConflict && nameConflict.id !== locationId) {
        throw new DuplicateStorageLocationError(data.name.trim())
      }

      updateData.name = data.name.trim()
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null
    }

    const result = this.db.update(storageLocations)
      .set(updateData)
      .where(eq(storageLocations.id, locationId))
      .returning()
      .get()

    return result
  }

  /**
   * 获取存放位置基本信息
   */
  getStorageLocationById(locationId: string): StorageLocation | null {
    const location = this.db.select().from(storageLocations)
      .where(eq(storageLocations.id, locationId))
      .get()
    return location ?? null
  }

  /**
   * 获取存放位置详情（带关联商品）
   */
  getStorageLocation(locationId: string): StorageLocationWithProducts | null {
    const location = this.db.select().from(storageLocations)
      .where(eq(storageLocations.id, locationId))
      .get()
    
    if (!location) return null

    // 获取关联的商品
    const links = this.db.select().from(productStorageLocations)
      .where(eq(productStorageLocations.locationId, locationId))
      .all()

    const productIds = links.map(l => l.productId)
    const productList = productIds.length > 0
      ? this.db.select().from(products).where(inArray(products.id, productIds)).all()
      : []

    const productsData = links.map(link => ({
      link,
      product: productList.find(p => p.id === link.productId)!,
    })).filter(item => item.product)

    return {
      ...location,
      products: productsData,
    }
  }

  /**
   * 根据名称获取存放位置
   */
  getStorageLocationByName(name: string): StorageLocation | null {
    const location = this.db.select().from(storageLocations)
      .where(eq(storageLocations.name, name))
      .get()
    return location ?? null
  }

  /**
   * 搜索存放位置
   * 需求: 1.10
   */
  searchStorageLocations(keyword?: string): StorageLocation[] {
    if (keyword && keyword.trim().length > 0) {
      const searchTerm = `%${keyword.trim()}%`
      return this.db.select().from(storageLocations)
        .where(like(storageLocations.name, searchTerm))
        .all()
    }
    return this.db.select().from(storageLocations).all()
  }

  /**
   * 获取所有存放位置
   */
  getAllStorageLocations(): StorageLocation[] {
    return this.db.select().from(storageLocations).all()
  }

  /**
   * 删除存放位置
   */
  deleteStorageLocation(locationId: string): void {
    const existing = this.getStorageLocationById(locationId)
    if (!existing) {
      throw new StorageLocationNotFoundError(locationId)
    }

    // 检查是否有商品关联
    const links = this.db.select().from(productStorageLocations)
      .where(eq(productStorageLocations.locationId, locationId))
      .all()
    
    if (links.length > 0) {
      throw new StorageLocationInUseError(existing.name)
    }

    this.db.delete(storageLocations).where(eq(storageLocations.id, locationId)).run()
  }

  // ==================== 商品位置关联管理 ====================

  /**
   * 将商品关联到存放位置
   * 需求: 1.8
   */
  linkProductToLocation(
    productId: string,
    locationId: string,
    options?: {
      note?: string
      isPrimary?: boolean
    }
  ): ProductStorageLocation {
    // 验证位置存在
    const location = this.getStorageLocationById(locationId)
    if (!location) {
      throw new StorageLocationNotFoundError(locationId)
    }

    // 验证商品存在
    const product = this.db.select().from(products).where(eq(products.id, productId)).get()
    if (!product) {
      throw new StorageLocationValidationError(`商品不存在: ${productId}`)
    }

    // 检查是否已关联
    const existing = this.db.select().from(productStorageLocations)
      .where(eq(productStorageLocations.productId, productId))
      .all()
      .find(l => l.locationId === locationId)
    
    if (existing) {
      throw new StorageLocationValidationError('商品已关联到该位置')
    }

    // 如果设置为主要位置，先取消其他主要位置
    if (options?.isPrimary) {
      this.db.update(productStorageLocations)
        .set({ isPrimary: false })
        .where(eq(productStorageLocations.productId, productId))
        .run()
    }

    const result = this.db.insert(productStorageLocations).values({
      productId,
      locationId,
      note: options?.note?.trim() || null,
      isPrimary: options?.isPrimary ?? false,
      createdAt: new Date(),
    }).returning().get()

    return result
  }

  /**
   * 更新商品位置关联
   */
  updateProductLocationLink(
    productId: string,
    locationId: string,
    updates: {
      note?: string | null
      isPrimary?: boolean
    }
  ): ProductStorageLocation {
    // 查找关联
    const existing = this.db.select().from(productStorageLocations)
      .where(eq(productStorageLocations.productId, productId))
      .all()
      .find(l => l.locationId === locationId)
    
    if (!existing) {
      throw new StorageLocationValidationError('商品未关联到该位置')
    }

    const updateData: Partial<ProductStorageLocation> = {}

    if (updates.note !== undefined) {
      updateData.note = updates.note?.trim() || null
    }

    if (updates.isPrimary !== undefined) {
      // 如果设置为主要位置，先取消其他主要位置
      if (updates.isPrimary) {
        this.db.update(productStorageLocations)
          .set({ isPrimary: false })
          .where(eq(productStorageLocations.productId, productId))
          .run()
      }
      updateData.isPrimary = updates.isPrimary
    }

    const result = this.db.update(productStorageLocations)
      .set(updateData)
      .where(eq(productStorageLocations.id, existing.id))
      .returning()
      .get()

    return result
  }

  /**
   * 取消商品与位置的关联
   */
  unlinkProductFromLocation(productId: string, locationId: string): void {
    const existing = this.db.select().from(productStorageLocations)
      .where(eq(productStorageLocations.productId, productId))
      .all()
      .find(l => l.locationId === locationId)
    
    if (!existing) {
      throw new StorageLocationValidationError('商品未关联到该位置')
    }

    this.db.delete(productStorageLocations)
      .where(eq(productStorageLocations.id, existing.id))
      .run()
  }

  /**
   * 获取商品的所有存放位置
   * 需求: 1.9
   */
  getProductLocations(productId: string): Array<{
    link: ProductStorageLocation
    location: StorageLocation
  }> {
    const links = this.db.select().from(productStorageLocations)
      .where(eq(productStorageLocations.productId, productId))
      .all()

    const locationIds = links.map(l => l.locationId)
    const locations = locationIds.length > 0
      ? this.db.select().from(storageLocations).where(inArray(storageLocations.id, locationIds)).all()
      : []

    return links.map(link => ({
      link,
      location: locations.find(l => l.id === link.locationId)!,
    })).filter(item => item.location)
  }

  /**
   * 获取存放位置下的所有商品
   */
  getLocationProducts(locationId: string): Array<{
    link: ProductStorageLocation
    product: Product
  }> {
    const links = this.db.select().from(productStorageLocations)
      .where(eq(productStorageLocations.locationId, locationId))
      .all()

    const productIds = links.map(l => l.productId)
    const productList = productIds.length > 0
      ? this.db.select().from(products).where(inArray(products.id, productIds)).all()
      : []

    return links.map(link => ({
      link,
      product: productList.find(p => p.id === link.productId)!,
    })).filter(item => item.product)
  }
}

// 工厂函数：创建带数据库连接的服务实例
export function createStorageLocationService(db: DbType): StorageLocationService {
  return new StorageLocationService(db)
}

// 工厂函数：从 SQLite 实例创建服务
export function createStorageLocationServiceFromSqlite(sqlite: Database.Database): StorageLocationService {
  const db = drizzle(sqlite, { schema: { ...schema, ...relations } })
  return new StorageLocationService(db)
}
