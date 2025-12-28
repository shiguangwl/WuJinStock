/**
 * 统计服务层属性测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import * as fc from 'fast-check'
import { createTestDb, initTestDbSchema } from '@/test/db-helpers'
import { createStatisticsServiceFromSqlite, StatisticsService } from '../statistics-service'
import { createSalesServiceFromSqlite, SalesService } from '../sales-service'
import { createProductServiceFromSqlite, ProductService } from '../product-service'
import { createInventoryServiceFromSqlite, InventoryService } from '../inventory-service'
import { priceArb, quantityArb } from '@/test/generators'
import type Database from 'better-sqlite3'
import Decimal from 'decimal.js'

describe('统计服务层属性测试', () => {
  let sqlite: Database.Database
  let statisticsService: StatisticsService
  let salesService: SalesService
  let productService: ProductService
  let inventoryService: InventoryService

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    initTestDbSchema(sqlite)
    statisticsService = createStatisticsServiceFromSqlite(sqlite)
    salesService = createSalesServiceFromSqlite(sqlite)
    productService = createProductServiceFromSqlite(sqlite)
    inventoryService = createInventoryServiceFromSqlite(sqlite)
  })

  afterEach(() => {
    sqlite.close()
  })

  // 清空数据库的辅助函数
  function clearDatabase() {
    sqlite.exec('DELETE FROM return_order_items')
    sqlite.exec('DELETE FROM return_orders')
    sqlite.exec('DELETE FROM sales_order_items')
    sqlite.exec('DELETE FROM sales_orders')
    sqlite.exec('DELETE FROM purchase_order_items')
    sqlite.exec('DELETE FROM purchase_orders')
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

  // 为商品添加库存的辅助函数
  let inventoryCounter = 0
  function addInventory(productId: string, quantity: number) {
    const product = productService.getProduct(productId)
    if (!product) throw new Error('商品不存在')
    
    inventoryCounter++
    
    inventoryService.adjustInventory({
      productId,
      quantityChange: quantity,
      transactionType: 'PURCHASE',
      unit: product.baseUnit,
      note: `测试库存添加 #${inventoryCounter}`,
    })
  }

  /**
   * 属性 19: 毛利润计算
   * *对于任意*时间段，毛利润应该等于该时间段内所有销售单的销售额减去对应商品的进货成本。
   * **验证需求: 5.6**
   * 
   * Feature: hardware-store-management, Property 19: 毛利润计算
   */
  describe('属性 19: 毛利润计算', () => {
    it('毛利润应该等于销售额减去进货成本（单个商品）', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, purchasePrice, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ purchasePrice, retailPrice })
            addInventory(product.id, quantity + 100)
            
            // 创建并确认销售单
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            salesService.confirmSalesOrder(order.id)
            
            // 计算毛利润
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 昨天
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // 明天
            const result = statisticsService.calculateGrossProfit(startDate, endDate)
            
            // 期望的销售额
            const expectedSales = new Decimal(quantity).mul(retailPrice).toDecimalPlaces(2).toNumber()
            // 期望的成本 = 数量 × 进货价
            const expectedCost = new Decimal(quantity).mul(purchasePrice).toDecimalPlaces(2).toNumber()
            // 期望的毛利润
            const expectedProfit = new Decimal(expectedSales).sub(expectedCost).toDecimalPlaces(2).toNumber()
            
            return (
              Math.abs(result.totalSales - expectedSales) < 0.01 &&
              Math.abs(result.totalCost - expectedCost) < 0.01 &&
              Math.abs(result.grossProfit - expectedProfit) < 0.01
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('毛利润应该等于销售额减去进货成本（多个商品）', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              quantity: quantityArb,
              purchasePrice: priceArb,
              retailPrice: priceArb,
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (itemsData) => {
            clearDatabase()
            
            // 创建商品并添加库存
            const products = itemsData.map((data, index) => {
              const product = createTestProduct({
                name: `商品${index}`,
                purchasePrice: data.purchasePrice,
                retailPrice: data.retailPrice,
              })
              addInventory(product.id, data.quantity + 100)
              return product
            })
            
            // 创建并确认销售单
            const order = salesService.createSalesOrder({
              items: products.map((p, index) => ({
                productId: p.id,
                quantity: itemsData[index].quantity,
                unit: p.baseUnit,
              })),
            })
            salesService.confirmSalesOrder(order.id)
            
            // 计算毛利润
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
            const result = statisticsService.calculateGrossProfit(startDate, endDate)
            
            // 使用与服务层相同的计算方式：
            // 销售额 = 订单的 totalAmount（已经过精度处理）
            // 成本 = 每个商品的 (数量 × 进货价)，数量使用订单中的实际数量
            const expectedSales = new Decimal(order.totalAmount)
            
            let expectedCost = new Decimal(0)
            for (let i = 0; i < order.items.length; i++) {
              const item = order.items[i]
              const data = itemsData[i]
              // 成本计算：使用订单中的实际数量（已精度处理）× 进货价
              expectedCost = expectedCost.add(
                new Decimal(item.quantity).mul(data.purchasePrice)
              )
            }
            
            const expectedProfit = expectedSales.sub(expectedCost).toDecimalPlaces(2).toNumber()
            expectedCost = expectedCost.toDecimalPlaces(2)
            
            return (
              Math.abs(result.totalSales - expectedSales.toNumber()) < 0.01 &&
              Math.abs(result.totalCost - expectedCost.toNumber()) < 0.01 &&
              Math.abs(result.grossProfit - expectedProfit) < 0.01
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('毛利率应该正确计算', () => {
      fc.assert(
        fc.property(
          quantityArb.filter(q => q >= 1), // 确保数量足够大以避免极小值精度问题
          priceArb.filter(p => p >= 1),    // 确保进货价足够大
          priceArb.filter(p => p >= 1),    // 确保零售价足够大
          (quantity, purchasePrice, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ purchasePrice, retailPrice })
            addInventory(product.id, quantity + 100)
            
            // 创建并确认销售单
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            salesService.confirmSalesOrder(order.id)
            
            // 计算毛利润
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
            const result = statisticsService.calculateGrossProfit(startDate, endDate)
            
            // 使用与服务层相同的计算方式
            // 销售额 = 订单的 totalAmount
            const expectedSales = new Decimal(order.totalAmount)
            // 成本 = 订单中的实际数量 × 进货价
            const expectedCost = new Decimal(order.items[0].quantity).mul(purchasePrice).toDecimalPlaces(2)
            
            // 期望的毛利率 = (销售额 - 成本) / 销售额 × 100
            const expectedMargin = expectedSales.isZero() 
              ? 0 
              : expectedSales.sub(expectedCost).div(expectedSales).mul(100).toDecimalPlaces(2).toNumber()
            
            // 使用更宽松的容差，因为毛利率计算涉及多次除法
            return Math.abs(result.profitMargin - expectedMargin) < 0.5
          }
        ),
        { numRuns: 100 }
      )
    })

    it('没有销售时毛利润应该为零', () => {
      fc.assert(
        fc.property(
          priceArb,
          priceArb,
          (purchasePrice, retailPrice) => {
            clearDatabase()
            
            // 只创建商品，不创建销售单
            createTestProduct({ purchasePrice, retailPrice })
            
            // 计算毛利润
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
            const result = statisticsService.calculateGrossProfit(startDate, endDate)
            
            return (
              result.totalSales === 0 &&
              result.totalCost === 0 &&
              result.grossProfit === 0 &&
              result.profitMargin === 0
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('未确认的销售单不应该计入毛利润', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, purchasePrice, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ purchasePrice, retailPrice })
            addInventory(product.id, quantity + 100)
            
            // 创建销售单但不确认
            salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            // 不调用 confirmSalesOrder
            
            // 计算毛利润
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
            const result = statisticsService.calculateGrossProfit(startDate, endDate)
            
            return (
              result.totalSales === 0 &&
              result.totalCost === 0 &&
              result.grossProfit === 0
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('时间范围外的销售单不应该计入毛利润', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, purchasePrice, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ purchasePrice, retailPrice })
            addInventory(product.id, quantity + 100)
            
            // 创建并确认销售单
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            salesService.confirmSalesOrder(order.id)
            
            // 使用过去的时间范围（不包含当前销售单）
            const startDate = new Date('2020-01-01')
            const endDate = new Date('2020-12-31')
            const result = statisticsService.calculateGrossProfit(startDate, endDate)
            
            return (
              result.totalSales === 0 &&
              result.totalCost === 0 &&
              result.grossProfit === 0
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('多个销售单的毛利润应该累加', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              quantity: quantityArb,
              purchasePrice: priceArb,
              retailPrice: priceArb,
            }),
            { minLength: 2, maxLength: 3 }
          ),
          (ordersData) => {
            clearDatabase()
            
            let expectedSales = new Decimal(0)
            let expectedCost = new Decimal(0)
            
            // 为每个订单创建商品并确认销售
            for (let i = 0; i < ordersData.length; i++) {
              const data = ordersData[i]
              const product = createTestProduct({
                name: `商品${i}`,
                purchasePrice: data.purchasePrice,
                retailPrice: data.retailPrice,
              })
              addInventory(product.id, data.quantity + 100)
              
              const order = salesService.createSalesOrder({
                items: [{
                  productId: product.id,
                  quantity: data.quantity,
                  unit: product.baseUnit,
                }],
              })
              salesService.confirmSalesOrder(order.id)
              
              // 使用订单的实际值计算期望
              expectedSales = expectedSales.add(new Decimal(order.totalAmount))
              expectedCost = expectedCost.add(
                new Decimal(order.items[0].quantity).mul(data.purchasePrice)
              )
            }
            
            // 计算毛利润
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
            const result = statisticsService.calculateGrossProfit(startDate, endDate)
            
            const expectedProfit = expectedSales.sub(expectedCost).toDecimalPlaces(2).toNumber()
            
            return (
              Math.abs(result.totalSales - expectedSales.toDecimalPlaces(2).toNumber()) < 0.01 &&
              Math.abs(result.totalCost - expectedCost.toDecimalPlaces(2).toNumber()) < 0.01 &&
              Math.abs(result.grossProfit - expectedProfit) < 0.01
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
