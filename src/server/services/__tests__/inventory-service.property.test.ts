/**
 * 库存服务层属性测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import * as fc from 'fast-check'
import Decimal from 'decimal.js'
import { createTestDb, initTestDbSchema } from '@/test/db-helpers'
import { createProductServiceFromSqlite, ProductService } from '../product-service'
import { createInventoryServiceFromSqlite, InventoryService } from '../inventory-service'
import { priceArb, unitNameArb, productNameArb, conversionRateArb, quantityArb, stockThresholdArb } from '@/test/generators'
import type Database from 'better-sqlite3'

describe('库存服务层属性测试', () => {
  let sqlite: Database.Database
  let productService: ProductService
  let inventoryService: InventoryService

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    initTestDbSchema(sqlite)
    productService = createProductServiceFromSqlite(sqlite)
    inventoryService = createInventoryServiceFromSqlite(sqlite)
  })

  afterEach(() => {
    sqlite.close()
  })

  // 清空数据库的辅助函数
  function clearDatabase() {
    sqlite.exec('DELETE FROM inventory_transactions')
    sqlite.exec('DELETE FROM inventory_records')
    sqlite.exec('DELETE FROM package_units')
    sqlite.exec('DELETE FROM product_storage_locations')
    sqlite.exec('DELETE FROM products')
  }

  // 创建测试商品的辅助函数
  function createTestProduct(data?: Partial<{
    name: string
    baseUnit: string
    purchasePrice: number
    retailPrice: number
    minStockThreshold: number
  }>) {
    return productService.createProduct({
      name: data?.name ?? '测试商品',
      baseUnit: data?.baseUnit ?? '个',
      purchasePrice: data?.purchasePrice ?? 10,
      retailPrice: data?.retailPrice ?? 15,
      minStockThreshold: data?.minStockThreshold ?? 0,
    })
  }

  /**
   * 属性 4: 单位换算一致性
   * *对于任意*商品、数量和单位，将数量从该单位换算为基本单位，再换算回原单位，应该得到原始数量（在精度范围内）。
   * **验证需求: 1.1.4, 1.1.5**
   * 
   * Feature: hardware-store-management, Property 4: 单位换算一致性
   */
  describe('属性 4: 单位换算一致性', () => {
    it('基本单位换算往返一致性', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          quantityArb,
          (productData, quantity) => {
            clearDatabase()
            
            const product = productService.createProduct(productData)
            const originalQuantity = new Decimal(quantity)
            
            // 基本单位换算应该保持不变
            const toBase = inventoryService.convertToBaseUnit(product, originalQuantity, product.baseUnit)
            const backToOriginal = inventoryService.convertFromBaseUnit(product, toBase, product.baseUnit)
            
            // 验证往返一致性（允许小的浮点误差）
            return backToOriginal.sub(originalQuantity).abs().lte(0.001)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('包装单位换算往返一致性', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          // 换算率 >= 1，符合实际业务场景（1箱 = N个，N >= 1）
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true })
            .map(n => Math.round(n * 100) / 100)
            .filter(n => n >= 1),
          quantityArb,
          (productData, conversionRate, quantity) => {
            clearDatabase()
            
            const product = productService.createProduct(productData)
            
            // 添加包装单位
            const packageUnitName = product.baseUnit === '箱' ? '盒' : '箱'
            productService.addPackageUnit(product.id, packageUnitName, conversionRate)
            
            const originalQuantity = new Decimal(quantity)
            
            // 换算为基本单位
            const toBase = inventoryService.convertToBaseUnit(product, originalQuantity, packageUnitName)
            
            // 换算回包装单位
            const backToOriginal = inventoryService.convertFromBaseUnit(product, toBase, packageUnitName)
            
            // 验证往返一致性（允许小的浮点误差）
            return backToOriginal.sub(originalQuantity).abs().lte(0.001)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('换算结果正确性', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          // 换算率 >= 1，符合实际业务场景
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true })
            .map(n => Math.round(n * 100) / 100)
            .filter(n => n >= 1),
          quantityArb,
          (productData, conversionRate, quantity) => {
            clearDatabase()
            
            const product = productService.createProduct(productData)
            
            // 添加包装单位
            const packageUnitName = product.baseUnit === '箱' ? '盒' : '箱'
            productService.addPackageUnit(product.id, packageUnitName, conversionRate)
            
            const originalQuantity = new Decimal(quantity)
            
            // 换算为基本单位
            const toBase = inventoryService.convertToBaseUnit(product, originalQuantity, packageUnitName)
            
            // 验证换算结果: 包装数量 × 换算率 = 基本单位数量
            const expectedBase = originalQuantity.mul(conversionRate).toDecimalPlaces(3)
            
            return toBase.sub(expectedBase).abs().lte(0.001)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 5: 小数精度支持
   * *对于任意*带有小数的数量值（精度至少两位小数），系统应该正确保存和计算，不丢失精度。
   * **验证需求: 1.1.7, 1.1.8**
   * 
   * Feature: hardware-store-management, Property 5: 小数精度支持
   */
  describe('属性 5: 小数精度支持', () => {
    it('小数数量在库存调整中保持精度', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          // 生成带小数的数量（最多3位小数）
          fc.float({ min: Math.fround(0.001), max: Math.fround(9999.999), noNaN: true })
            .map(n => Math.round(n * 1000) / 1000)
            .filter(n => n > 0),
          (productData, quantity) => {
            clearDatabase()
            
            const product = productService.createProduct(productData)
            
            // 调整库存
            inventoryService.adjustInventory({
              productId: product.id,
              quantityChange: quantity,
              transactionType: 'PURCHASE',
              unit: product.baseUnit,
            })
            
            // 获取库存
            const inventory = inventoryService.getInventory(product.id)
            
            // 验证精度保持（允许小的浮点误差）
            const diff = Math.abs(inventory!.quantity - quantity)
            return diff < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('多次小数调整累计正确', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          fc.array(
            fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true })
              .map(n => Math.round(n * 100) / 100)
              .filter(n => n > 0),
            { minLength: 2, maxLength: 5 }
          ),
          (productData, quantities) => {
            clearDatabase()
            
            const product = productService.createProduct(productData)
            
            // 多次调整库存
            let expectedTotal = new Decimal(0)
            for (const qty of quantities) {
              inventoryService.adjustInventory({
                productId: product.id,
                quantityChange: qty,
                transactionType: 'PURCHASE',
                unit: product.baseUnit,
              })
              expectedTotal = expectedTotal.add(qty)
            }
            
            // 获取库存
            const inventory = inventoryService.getInventory(product.id)
            
            // 验证累计正确
            const diff = new Decimal(inventory!.quantity).sub(expectedTotal).abs()
            return diff.lte(0.01)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 6: 库存预警触发
   * *对于任意*商品，当其库存数量低于设定的最低库存阈值时，系统应该将该商品标记为需要预警。
   * **验证需求: 2.3**
   * 
   * Feature: hardware-store-management, Property 6: 库存预警触发
   */
  describe('属性 6: 库存预警触发', () => {
    it('库存低于阈值时触发预警', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          // 阈值
          fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true })
            .map(n => Math.round(n * 100) / 100),
          // 库存数量（低于阈值）
          fc.float({ min: Math.fround(0), max: Math.fround(9.99), noNaN: true })
            .map(n => Math.round(n * 100) / 100),
          (productData, threshold, stockQuantity) => {
            clearDatabase()
            
            // 创建商品并设置阈值
            const product = productService.createProduct({
              ...productData,
              minStockThreshold: threshold,
            })
            
            // 设置库存（低于阈值）
            if (stockQuantity > 0) {
              inventoryService.adjustInventory({
                productId: product.id,
                quantityChange: stockQuantity,
                transactionType: 'PURCHASE',
                unit: product.baseUnit,
              })
            }
            
            // 检查是否为低库存
            const isLow = inventoryService.isLowStock(product.id)
            
            // 库存低于阈值时应该触发预警
            return isLow === true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('库存高于或等于阈值时不触发预警', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          // 阈值
          fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true })
            .map(n => Math.round(n * 100) / 100),
          // 额外库存（使总库存 >= 阈值）
          fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true })
            .map(n => Math.round(n * 100) / 100),
          (productData, threshold, extraStock) => {
            clearDatabase()
            
            // 创建商品并设置阈值
            const product = productService.createProduct({
              ...productData,
              minStockThreshold: threshold,
            })
            
            // 设置库存（>= 阈值）
            const stockQuantity = threshold + extraStock
            inventoryService.adjustInventory({
              productId: product.id,
              quantityChange: stockQuantity,
              transactionType: 'PURCHASE',
              unit: product.baseUnit,
            })
            
            // 检查是否为低库存
            const isLow = inventoryService.isLowStock(product.id)
            
            // 库存高于或等于阈值时不应该触发预警
            return isLow === false
          }
        ),
        { numRuns: 100 }
      )
    })

    it('低库存商品列表包含所有低库存商品', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: productNameArb,
              baseUnit: unitNameArb,
              purchasePrice: priceArb,
              retailPrice: priceArb,
              threshold: fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true })
                .map(n => Math.round(n * 100) / 100),
              stock: fc.float({ min: Math.fround(0), max: Math.fround(150), noNaN: true })
                .map(n => Math.round(n * 100) / 100),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (productsData) => {
            clearDatabase()
            
            const createdProducts: Array<{ id: string; isLow: boolean }> = []
            
            for (const data of productsData) {
              const product = productService.createProduct({
                name: data.name,
                baseUnit: data.baseUnit,
                purchasePrice: data.purchasePrice,
                retailPrice: data.retailPrice,
                minStockThreshold: data.threshold,
              })
              
              if (data.stock > 0) {
                inventoryService.adjustInventory({
                  productId: product.id,
                  quantityChange: data.stock,
                  transactionType: 'PURCHASE',
                  unit: product.baseUnit,
                })
              }
              
              createdProducts.push({
                id: product.id,
                isLow: data.stock < data.threshold,
              })
            }
            
            // 获取低库存列表
            const lowStockList = inventoryService.getLowStockProducts()
            const lowStockIds = new Set(lowStockList.map(item => item.product.id))
            
            // 验证所有低库存商品都在列表中
            for (const p of createdProducts) {
              if (p.isLow && !lowStockIds.has(p.id)) {
                return false
              }
              if (!p.isLow && lowStockIds.has(p.id)) {
                return false
              }
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
