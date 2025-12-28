/**
 * 商品服务层属性测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { createTestDb, initTestDbSchema } from '@/test/db-helpers'
import { createProductServiceFromSqlite, ProductService } from '../product-service'
import { priceArb, unitNameArb, productNameArb, conversionRateArb } from '@/test/generators'
import type Database from 'better-sqlite3'

describe('商品服务层属性测试', () => {
  let sqlite: Database.Database
  let service: ProductService

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    initTestDbSchema(sqlite)
    service = createProductServiceFromSqlite(sqlite)
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

  /**
   * 属性 1: 商品编码唯一性
   * *对于任意*两个不同的商品，它们的商品编码必须不同。
   * **验证需求: 1.5**
   * 
   * Feature: hardware-store-management, Property 1: 商品编码唯一性
   */
  describe('属性 1: 商品编码唯一性', () => {
    it('创建多个商品时，每个商品的编码都是唯一的', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: productNameArb,
              baseUnit: unitNameArb,
              purchasePrice: priceArb,
              retailPrice: priceArb,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (productDataList) => {
            clearDatabase()
            
            const createdProducts = productDataList.map(data => 
              service.createProduct(data)
            )

            const codes = createdProducts.map(p => p.code)
            const uniqueCodes = new Set(codes)
            return uniqueCodes.size === codes.length
          }
        ),
        { numRuns: 100 }
      )
    })

    it('生成的商品编码格式正确', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          (productData) => {
            clearDatabase()
            
            const product = service.createProduct(productData)
            return product.code.startsWith('SP') && product.code.length === 8
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 2: 必填字段验证
   * *对于任意*缺少必填字段（商品名称、基本单位或零售价）的商品数据，系统应该拒绝创建并返回错误。
   * **验证需求: 1.2**
   * 
   * Feature: hardware-store-management, Property 2: 必填字段验证
   */
  describe('属性 2: 必填字段验证', () => {
    it('缺少商品名称时应该拒绝创建', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.constantFrom('', '   ', '\t', '\n'),
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          (productData) => {
            clearDatabase()
            
            try {
              service.createProduct(productData)
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('商品名称不能为空')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('缺少基本单位时应该拒绝创建', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: fc.constantFrom('', '   ', '\t', '\n'),
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          (productData) => {
            clearDatabase()
            
            try {
              service.createProduct(productData)
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('基本单位不能为空')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('有效的商品数据应该成功创建', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          (productData) => {
            clearDatabase()
            
            const product = service.createProduct(productData)
            
            return (
              product.id !== undefined &&
              product.name === productData.name.trim() &&
              product.baseUnit === productData.baseUnit.trim()
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 3: 换算比例有效性
   * *对于任意*包装单位，其换算比例必须大于零。
   * **验证需求: 1.7**
   * 
   * Feature: hardware-store-management, Property 3: 换算比例有效性
   */
  describe('属性 3: 换算比例有效性', () => {
    it('换算比例为零或负数时应该拒绝添加', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          fc.constantFrom(0, -1, -0.5, -100),
          (productData, invalidRate) => {
            clearDatabase()
            
            const product = service.createProduct(productData)
            
            try {
              service.addPackageUnit(product.id, '箱', invalidRate)
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('换算比例必须大于零')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('有效的换算比例应该成功添加', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: productNameArb,
            baseUnit: unitNameArb,
            purchasePrice: priceArb,
            retailPrice: priceArb,
          }),
          conversionRateArb,
          unitNameArb,
          (productData, rate, unitName) => {
            clearDatabase()
            
            const product = service.createProduct(productData)
            
            // 确保单位名称与基本单位不同
            const actualUnitName = unitName === product.baseUnit ? `${unitName}装` : unitName
            
            const packageUnit = service.addPackageUnit(product.id, actualUnitName, rate)
            
            return (
              packageUnit.productId === product.id &&
              packageUnit.name === actualUnitName &&
              packageUnit.conversionRate > 0
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
