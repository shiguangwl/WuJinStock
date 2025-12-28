/**
 * 盘点服务层属性测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import * as fc from 'fast-check'
import Decimal from 'decimal.js'
import { createTestDb, initTestDbSchema } from '@/test/db-helpers'
import { createProductServiceFromSqlite, ProductService } from '../product-service'
import { createInventoryServiceFromSqlite, InventoryService } from '../inventory-service'
import { createStockTakingServiceFromSqlite, StockTakingService } from '../stock-taking-service'
import { priceArb, unitNameArb, productNameArb, quantityArb } from '@/test/generators'
import type Database from 'better-sqlite3'

describe('盘点服务层属性测试', () => {
  let sqlite: Database.Database
  let productService: ProductService
  let inventoryService: InventoryService
  let stockTakingService: StockTakingService

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    initTestDbSchema(sqlite)
    productService = createProductServiceFromSqlite(sqlite)
    inventoryService = createInventoryServiceFromSqlite(sqlite)
    stockTakingService = createStockTakingServiceFromSqlite(sqlite)
  })

  afterEach(() => {
    sqlite.close()
  })

  // 清空数据库的辅助函数
  function clearDatabase() {
    sqlite.exec('DELETE FROM stock_taking_items')
    sqlite.exec('DELETE FROM stock_takings')
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
  }>) {
    return productService.createProduct({
      name: data?.name ?? '测试商品',
      baseUnit: data?.baseUnit ?? '个',
      purchasePrice: data?.purchasePrice ?? 10,
      retailPrice: data?.retailPrice ?? 15,
    })
  }

  /**
   * 属性 7: 盘点差异计算
   * *对于任意*盘点记录，盘点差异应该等于实际数量减去系统数量。
   * **验证需求: 2.6**
   * 
   * Feature: hardware-store-management, Property 7: 盘点差异计算
   */
  describe('属性 7: 盘点差异计算', () => {
    it('盘点差异 = 实际数量 - 系统数量', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          // 系统库存数量
          fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true })
            .map(n => Math.round(n * 1000) / 1000),
          // 实际盘点数量
          fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true })
            .map(n => Math.round(n * 1000) / 1000),
          (productData, systemQuantity, actualQuantity) => {
            clearDatabase()
            
            // 创建商品
            const product = productService.createProduct(productData)
            
            // 设置初始库存
            if (systemQuantity > 0) {
              inventoryService.adjustInventory({
                productId: product.id,
                quantityChange: systemQuantity,
                transactionType: 'PURCHASE',
                unit: product.baseUnit,
              })
            }
            
            // 创建盘点
            const stockTaking = stockTakingService.createStockTaking()
            
            // 记录实际数量
            const item = stockTakingService.recordActualQuantity(
              stockTaking.id,
              product.id,
              actualQuantity
            )
            
            // 验证差异计算: 差异 = 实际数量 - 系统数量
            const expectedDifference = new Decimal(actualQuantity)
              .sub(systemQuantity)
              .toDecimalPlaces(3)
              .toNumber()
            
            const actualDifference = item.difference
            
            // 允许小的浮点误差
            return Math.abs(actualDifference - expectedDifference) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('多商品盘点差异独立计算', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: productNameArb,
              baseUnit: unitNameArb,
              purchasePrice: priceArb,
              retailPrice: priceArb,
              systemQuantity: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true })
                .map(n => Math.round(n * 100) / 100),
              actualQuantity: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true })
                .map(n => Math.round(n * 100) / 100),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (productsData) => {
            clearDatabase()
            
            // 创建商品并设置库存
            const createdProducts: Array<{
              id: string
              systemQuantity: number
              actualQuantity: number
            }> = []
            
            for (const data of productsData) {
              const product = productService.createProduct({
                name: data.name,
                baseUnit: data.baseUnit,
                purchasePrice: data.purchasePrice,
                retailPrice: data.retailPrice,
              })
              
              if (data.systemQuantity > 0) {
                inventoryService.adjustInventory({
                  productId: product.id,
                  quantityChange: data.systemQuantity,
                  transactionType: 'PURCHASE',
                  unit: product.baseUnit,
                })
              }
              
              createdProducts.push({
                id: product.id,
                systemQuantity: data.systemQuantity,
                actualQuantity: data.actualQuantity,
              })
            }
            
            // 创建盘点
            const stockTaking = stockTakingService.createStockTaking()
            
            // 记录每个商品的实际数量并验证差异
            for (const p of createdProducts) {
              const item = stockTakingService.recordActualQuantity(
                stockTaking.id,
                p.id,
                p.actualQuantity
              )
              
              const expectedDifference = new Decimal(p.actualQuantity)
                .sub(p.systemQuantity)
                .toDecimalPlaces(3)
                .toNumber()
              
              if (Math.abs(item.difference - expectedDifference) >= 0.001) {
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

  /**
   * 属性 8: 盘点更新库存
   * *对于任意*盘点记录，确认盘点后，商品的库存数量应该等于盘点的实际数量。
   * **验证需求: 2.7**
   * 
   * Feature: hardware-store-management, Property 8: 盘点更新库存
   */
  describe('属性 8: 盘点更新库存', () => {
    it('完成盘点后库存等于实际数量', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          // 系统库存数量
          fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true })
            .map(n => Math.round(n * 1000) / 1000),
          // 实际盘点数量
          fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true })
            .map(n => Math.round(n * 1000) / 1000),
          (productData, systemQuantity, actualQuantity) => {
            clearDatabase()
            
            // 创建商品
            const product = productService.createProduct(productData)
            
            // 设置初始库存
            if (systemQuantity > 0) {
              inventoryService.adjustInventory({
                productId: product.id,
                quantityChange: systemQuantity,
                transactionType: 'PURCHASE',
                unit: product.baseUnit,
              })
            }
            
            // 创建盘点
            const stockTaking = stockTakingService.createStockTaking()
            
            // 记录实际数量
            stockTakingService.recordActualQuantity(
              stockTaking.id,
              product.id,
              actualQuantity
            )
            
            // 完成盘点
            stockTakingService.completeStockTaking(stockTaking.id)
            
            // 获取更新后的库存
            const inventory = inventoryService.getInventory(product.id)
            const finalQuantity = inventory?.quantity ?? 0
            
            // 验证库存等于实际数量
            return Math.abs(finalQuantity - actualQuantity) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('多商品盘点后各商品库存独立更新', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: productNameArb,
              baseUnit: unitNameArb,
              purchasePrice: priceArb,
              retailPrice: priceArb,
              systemQuantity: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true })
                .map(n => Math.round(n * 100) / 100),
              actualQuantity: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true })
                .map(n => Math.round(n * 100) / 100),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (productsData) => {
            clearDatabase()
            
            // 创建商品并设置库存
            const createdProducts: Array<{
              id: string
              actualQuantity: number
            }> = []
            
            for (const data of productsData) {
              const product = productService.createProduct({
                name: data.name,
                baseUnit: data.baseUnit,
                purchasePrice: data.purchasePrice,
                retailPrice: data.retailPrice,
              })
              
              if (data.systemQuantity > 0) {
                inventoryService.adjustInventory({
                  productId: product.id,
                  quantityChange: data.systemQuantity,
                  transactionType: 'PURCHASE',
                  unit: product.baseUnit,
                })
              }
              
              createdProducts.push({
                id: product.id,
                actualQuantity: data.actualQuantity,
              })
            }
            
            // 创建盘点
            const stockTaking = stockTakingService.createStockTaking()
            
            // 记录每个商品的实际数量
            for (const p of createdProducts) {
              stockTakingService.recordActualQuantity(
                stockTaking.id,
                p.id,
                p.actualQuantity
              )
            }
            
            // 完成盘点
            stockTakingService.completeStockTaking(stockTaking.id)
            
            // 验证每个商品的库存
            for (const p of createdProducts) {
              const inventory = inventoryService.getInventory(p.id)
              const finalQuantity = inventory?.quantity ?? 0
              
              if (Math.abs(finalQuantity - p.actualQuantity) >= 0.001) {
                return false
              }
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('盘点完成后状态变为COMPLETED', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          quantityArb,
          (productData, actualQuantity) => {
            clearDatabase()
            
            // 创建商品
            const product = productService.createProduct(productData)
            
            // 创建盘点
            const stockTaking = stockTakingService.createStockTaking()
            
            // 记录实际数量
            stockTakingService.recordActualQuantity(
              stockTaking.id,
              product.id,
              actualQuantity
            )
            
            // 完成盘点
            const completed = stockTakingService.completeStockTaking(stockTaking.id)
            
            // 验证状态
            return completed.status === 'COMPLETED' && completed.completedAt !== null
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
