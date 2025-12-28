/**
 * 销售服务层属性测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { createTestDb, initTestDbSchema } from '@/test/db-helpers'
import { createSalesServiceFromSqlite, SalesService } from '../sales-service'
import { createProductServiceFromSqlite, ProductService } from '../product-service'
import { createInventoryServiceFromSqlite, InventoryService } from '../inventory-service'
import { createPurchaseServiceFromSqlite, PurchaseService } from '../purchase-service'
import { priceArb, quantityArb, supplierNameArb, conversionRateArb, customerNameArb, discountPercentArb, roundingAmountArb } from '@/test/generators'
import type Database from 'better-sqlite3'
import Decimal from 'decimal.js'

describe('销售服务层属性测试', () => {
  let sqlite: Database.Database
  let salesService: SalesService
  let productService: ProductService
  let inventoryService: InventoryService
  let purchaseService: PurchaseService

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    initTestDbSchema(sqlite)
    salesService = createSalesServiceFromSqlite(sqlite)
    productService = createProductServiceFromSqlite(sqlite)
    inventoryService = createInventoryServiceFromSqlite(sqlite)
    purchaseService = createPurchaseServiceFromSqlite(sqlite)
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
  function createTestProduct(data?: Partial<{ name: string; baseUnit: string; purchasePrice: number; retailPrice: number }>) {
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
    
    // 使用计数器确保订单号唯一
    inventoryCounter++
    
    // 直接通过库存服务调整库存，避免订单号冲突
    inventoryService.adjustInventory({
      productId,
      quantityChange: quantity,
      transactionType: 'PURCHASE',
      unit: product.baseUnit,
      note: `测试库存添加 #${inventoryCounter}`,
    })
  }

  /**
   * 属性 15: 库存充足性验证
   * *对于任意*销售单和商品，如果该商品的可用库存（换算为基本单位）小于销售数量（换算为基本单位），系统应该阻止添加该商品到销售单。
   * **验证需求: 4.4, 4.5**
   * 
   * Feature: hardware-store-management, Property 15: 库存充足性验证
   */
  describe('属性 15: 库存充足性验证', () => {
    it('库存不足时应该拒绝创建销售单', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 不添加库存，直接尝试创建销售单
            try {
              salesService.createSalesOrder({
                items: [{
                  productId: product.id,
                  quantity,
                  unit: product.baseUnit,
                }],
              })
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('库存不足')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('库存充足时应该成功创建销售单', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加足够的库存
            addInventory(product.id, quantity + 10)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            return (
              order.id !== undefined &&
              order.status === 'PENDING' &&
              order.items.length === 1 &&
              order.items[0].productId === product.id
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('销售数量刚好等于库存时应该成功创建销售单', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加刚好等于销售数量的库存
            addInventory(product.id, quantity)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            return (
              order.id !== undefined &&
              order.items.length === 1 &&
              Math.abs(order.items[0].quantity - quantity) < 0.001
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('使用包装单位时应该正确验证库存充足性', () => {
      fc.assert(
        fc.property(
          quantityArb.filter(q => q >= 1), // 确保数量足够大
          priceArb,
          conversionRateArb.filter(r => r >= 1), // 确保换算率足够大
          (quantity, retailPrice, conversionRate) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加包装单位
            productService.addPackageUnit(product.id, '箱', conversionRate)
            
            // 添加的库存（基本单位）少于销售需要的数量
            const requiredBaseQuantity = new Decimal(quantity).mul(conversionRate).toNumber()
            // 添加一半的库存，确保不足
            const insufficientStock = new Decimal(requiredBaseQuantity).div(2).toDecimalPlaces(3).toNumber()
            
            if (insufficientStock > 0) {
              addInventory(product.id, insufficientStock)
            }
            
            try {
              salesService.createSalesOrder({
                items: [{
                  productId: product.id,
                  quantity,
                  unit: '箱',
                }],
              })
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('库存不足')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 16: 销售单自动填充价格
   * *对于任意*销售单，添加商品时，如果未指定单价，系统应该自动使用该商品的零售价。
   * **验证需求: 4.3**
   * 
   * Feature: hardware-store-management, Property 16: 销售单自动填充价格
   */
  describe('属性 16: 销售单自动填充价格', () => {
    it('未指定单价时应该自动使用商品零售价', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 10)
            
            // 不指定单价
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                // unitPrice 不指定
              }],
            })
            
            const item = order.items[0]
            return Math.abs(item.unitPrice - retailPrice) < 0.0001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('指定单价时应该使用指定的价格', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, retailPrice, customPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 10)
            
            // 指定自定义单价
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice: customPrice,
              }],
            })
            
            const item = order.items[0]
            return Math.abs(item.unitPrice - customPrice) < 0.0001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('使用包装单位时应该自动计算包装单位价格', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          conversionRateArb,
          (quantity, retailPrice, conversionRate) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加包装单位（不设置特定价格）
            productService.addPackageUnit(product.id, '箱', conversionRate)
            
            // 添加足够的库存
            const requiredBaseQuantity = new Decimal(quantity).mul(conversionRate).toNumber()
            addInventory(product.id, requiredBaseQuantity + 10)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: '箱',
              }],
            })
            
            const item = order.items[0]
            // 期望价格 = 基础零售价 × 换算率
            const expectedPrice = new Decimal(retailPrice).mul(conversionRate).toDecimalPlaces(4).toNumber()
            
            return Math.abs(item.unitPrice - expectedPrice) < 0.0001
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 18: 销售减少库存
   * *对于任意*销售单，确认销售后，每个商品的库存减少量应该等于销售数量（换算为基本单位）。
   * **验证需求: 4.10**
   * 
   * Feature: hardware-store-management, Property 18: 销售减少库存
   */
  describe('属性 18: 销售减少库存', () => {
    it('确认销售单后库存应该正确减少（基本单位）', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加足够的库存
            const initialStock = quantity + 100
            addInventory(product.id, initialStock)
            
            // 获取进货后的库存
            const inventoryBeforeSale = inventoryService.getInventory(product.id)
            const quantityBeforeSale = inventoryBeforeSale?.quantity ?? 0
            
            // 创建并确认销售单
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            salesService.confirmSalesOrder(order.id)
            
            // 获取销售后的库存
            const inventoryAfterSale = inventoryService.getInventory(product.id)
            const quantityAfterSale = inventoryAfterSale?.quantity ?? 0
            
            // 验证库存减少量
            const expectedDecrease = new Decimal(quantity).toDecimalPlaces(3).toNumber()
            const actualDecrease = new Decimal(quantityBeforeSale).sub(quantityAfterSale).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualDecrease - expectedDecrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('确认销售单后库存应该正确减少（包装单位）', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          conversionRateArb,
          (quantity, retailPrice, conversionRate) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加包装单位
            productService.addPackageUnit(product.id, '箱', conversionRate)
            
            // 添加足够的库存（基本单位）
            const requiredBaseQuantity = new Decimal(quantity).mul(conversionRate).toNumber()
            const initialStock = requiredBaseQuantity + 100
            addInventory(product.id, initialStock)
            
            // 获取销售前的库存
            const inventoryBeforeSale = inventoryService.getInventory(product.id)
            const quantityBeforeSale = inventoryBeforeSale?.quantity ?? 0
            
            // 创建并确认销售单（使用包装单位）
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: '箱',
              }],
            })
            salesService.confirmSalesOrder(order.id)
            
            // 获取销售后的库存
            const inventoryAfterSale = inventoryService.getInventory(product.id)
            const quantityAfterSale = inventoryAfterSale?.quantity ?? 0
            
            // 验证库存减少量（应该是 quantity * conversionRate）
            const expectedDecrease = new Decimal(quantity).mul(conversionRate).toDecimalPlaces(3).toNumber()
            const actualDecrease = new Decimal(quantityBeforeSale).sub(quantityAfterSale).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualDecrease - expectedDecrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('多个商品的销售单应该正确减少各自的库存', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              quantity: quantityArb,
              retailPrice: priceArb,
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (itemsData) => {
            clearDatabase()
            
            // 创建多个商品并添加库存
            const products = itemsData.map((data, index) => {
              const product = createTestProduct({ name: `商品${index}`, retailPrice: data.retailPrice })
              addInventory(product.id, data.quantity + 100)
              return product
            })
            
            // 获取销售前的库存
            const quantitiesBeforeSale = products.map(p => {
              const inv = inventoryService.getInventory(p.id)
              return inv?.quantity ?? 0
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
            
            // 验证每个商品的库存减少量
            return products.every((p, index) => {
              const inventoryAfterSale = inventoryService.getInventory(p.id)
              const quantityAfterSale = inventoryAfterSale?.quantity ?? 0
              const expectedDecrease = new Decimal(itemsData[index].quantity).toDecimalPlaces(3).toNumber()
              const actualDecrease = new Decimal(quantitiesBeforeSale[index]).sub(quantityAfterSale).toDecimalPlaces(3).toNumber()
              return Math.abs(actualDecrease - expectedDecrease) < 0.001
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 17: 销售单金额计算
   * *对于任意*销售单，应收金额应该等于（所有商品小计之和 - 折扣金额 - 抹零金额）。
   * **验证需求: 4.6, 4.7, 4.8**
   * 
   * Feature: hardware-store-management, Property 17: 销售单金额计算
   */
  describe('属性 17: 销售单金额计算', () => {
    it('销售单总金额应该等于所有明细小计之和（无折扣无抹零）', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              quantity: quantityArb,
              retailPrice: priceArb,
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (itemsData) => {
            clearDatabase()
            
            // 创建商品并添加库存
            const products = itemsData.map((data, index) => {
              const product = createTestProduct({ name: `商品${index}`, retailPrice: data.retailPrice })
              addInventory(product.id, data.quantity + 100)
              return product
            })
            
            // 创建销售单
            const order = salesService.createSalesOrder({
              items: products.map((p, index) => ({
                productId: p.id,
                quantity: itemsData[index].quantity,
                unit: p.baseUnit,
              })),
            })
            
            // 计算期望的总金额
            const expectedTotal = order.items.reduce(
              (sum, item) => sum.add(item.subtotal),
              new Decimal(0)
            ).toDecimalPlaces(2).toNumber()
            
            // 验证总金额
            return Math.abs(order.totalAmount - expectedTotal) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })

    it('每个明细的小计应该等于数量乘以单价', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            const item = order.items[0]
            const expectedSubtotal = new Decimal(quantity).mul(retailPrice).toDecimalPlaces(2).toNumber()
            
            return Math.abs(item.subtotal - expectedSubtotal) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })

    it('应用百分比折扣后总金额应该正确计算', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          discountPercentArb.filter(d => d > 0 && d <= 100),
          (quantity, retailPrice, discountPercent) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            // 应用百分比折扣
            const updatedOrder = salesService.applyDiscount(order.id, 'percentage', discountPercent)
            
            // 计算期望的折扣金额
            const expectedDiscount = new Decimal(updatedOrder.subtotal)
              .mul(discountPercent)
              .div(100)
              .toDecimalPlaces(2)
              .toNumber()
            
            // 计算期望的总金额
            const expectedTotal = new Decimal(updatedOrder.subtotal)
              .sub(expectedDiscount)
              .toDecimalPlaces(2)
              .toNumber()
            
            return (
              Math.abs(updatedOrder.discountAmount - expectedDiscount) < 0.01 &&
              Math.abs(updatedOrder.totalAmount - Math.max(0, expectedTotal)) < 0.01
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('应用固定金额折扣后总金额应该正确计算', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            // 固定折扣金额不超过小计的一半
            const fixedDiscount = new Decimal(order.subtotal).div(2).toDecimalPlaces(2).toNumber()
            
            // 应用固定金额折扣
            const updatedOrder = salesService.applyDiscount(order.id, 'fixed', fixedDiscount)
            
            // 计算期望的总金额
            const expectedTotal = new Decimal(updatedOrder.subtotal)
              .sub(fixedDiscount)
              .toDecimalPlaces(2)
              .toNumber()
            
            return (
              Math.abs(updatedOrder.discountAmount - fixedDiscount) < 0.01 &&
              Math.abs(updatedOrder.totalAmount - Math.max(0, expectedTotal)) < 0.01
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('应用抹零后总金额应该正确计算', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          roundingAmountArb,
          (quantity, retailPrice, roundingAmount) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            // 确保抹零金额不超过小计
            const actualRounding = Math.min(roundingAmount, order.subtotal)
            
            // 应用抹零
            const updatedOrder = salesService.applyRounding(order.id, actualRounding)
            
            // 计算期望的总金额
            const expectedTotal = new Decimal(updatedOrder.subtotal)
              .sub(actualRounding)
              .toDecimalPlaces(2)
              .toNumber()
            
            return (
              Math.abs(updatedOrder.roundingAmount - actualRounding) < 0.01 &&
              Math.abs(updatedOrder.totalAmount - Math.max(0, expectedTotal)) < 0.01
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('同时应用折扣和抹零后总金额应该正确计算', () => {
      fc.assert(
        fc.property(
          quantityArb.filter(q => q >= 10), // 确保金额足够大
          priceArb.filter(p => p >= 10),
          discountPercentArb.filter(d => d > 0 && d <= 50),
          roundingAmountArb.filter(r => r > 0 && r <= 5),
          (quantity, retailPrice, discountPercent, roundingAmount) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            // 应用折扣
            salesService.applyDiscount(order.id, 'percentage', discountPercent)
            
            // 应用抹零
            const updatedOrder = salesService.applyRounding(order.id, roundingAmount)
            
            // 计算期望的总金额
            const expectedDiscount = new Decimal(updatedOrder.subtotal)
              .mul(discountPercent)
              .div(100)
              .toDecimalPlaces(2)
            
            const expectedTotal = new Decimal(updatedOrder.subtotal)
              .sub(expectedDiscount)
              .sub(roundingAmount)
              .toDecimalPlaces(2)
              .toNumber()
            
            return Math.abs(updatedOrder.totalAmount - Math.max(0, expectedTotal)) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 25: 改价功能正确性
   * *对于任意*销售单中的商品，应用改价后，该商品的单价应该等于新设定的价格，且小计应该重新计算。
   * **验证需求: 4.9**
   * 
   * Feature: hardware-store-management, Property 25: 改价功能正确性
   */
  describe('属性 25: 改价功能正确性', () => {
    it('改价后商品单价应该等于新设定的价格', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, retailPrice, newPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            // 改价
            const updatedOrder = salesService.adjustItemPrice(order.id, 0, newPrice)
            
            const item = updatedOrder.items[0]
            return Math.abs(item.unitPrice - newPrice) < 0.0001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('改价后小计应该重新计算', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, retailPrice, newPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            // 改价
            const updatedOrder = salesService.adjustItemPrice(order.id, 0, newPrice)
            
            const item = updatedOrder.items[0]
            const expectedSubtotal = new Decimal(quantity).mul(newPrice).toDecimalPlaces(2).toNumber()
            
            return Math.abs(item.subtotal - expectedSubtotal) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })

    it('改价后订单总金额应该重新计算', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, retailPrice, newPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            // 改价
            const updatedOrder = salesService.adjustItemPrice(order.id, 0, newPrice)
            
            const expectedTotal = new Decimal(quantity).mul(newPrice).toDecimalPlaces(2).toNumber()
            
            return Math.abs(updatedOrder.totalAmount - expectedTotal) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })

    it('改价后原始价格应该保持不变', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          priceArb,
          (quantity, retailPrice, newPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            addInventory(product.id, quantity + 100)
            
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            
            const originalPrice = order.items[0].originalPrice
            
            // 改价
            const updatedOrder = salesService.adjustItemPrice(order.id, 0, newPrice)
            
            const item = updatedOrder.items[0]
            return Math.abs(item.originalPrice - originalPrice) < 0.0001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('多个商品时改价应该只影响指定商品', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              quantity: quantityArb,
              retailPrice: priceArb,
            }),
            { minLength: 2, maxLength: 5 }
          ),
          priceArb,
          fc.nat(),
          (itemsData, newPrice, indexSeed) => {
            clearDatabase()
            
            // 创建商品并添加库存
            const products = itemsData.map((data, index) => {
              const product = createTestProduct({ name: `商品${index}`, retailPrice: data.retailPrice })
              addInventory(product.id, data.quantity + 100)
              return product
            })
            
            // 创建销售单
            const order = salesService.createSalesOrder({
              items: products.map((p, index) => ({
                productId: p.id,
                quantity: itemsData[index].quantity,
                unit: p.baseUnit,
              })),
            })
            
            // 选择要改价的商品索引
            const targetIndex = indexSeed % order.items.length
            
            // 记录其他商品的原始价格
            const otherItemsPrices = order.items
              .filter((_, i) => i !== targetIndex)
              .map(item => item.unitPrice)
            
            // 改价
            const updatedOrder = salesService.adjustItemPrice(order.id, targetIndex, newPrice)
            
            // 验证目标商品价格已更改
            const targetPriceChanged = Math.abs(updatedOrder.items[targetIndex].unitPrice - newPrice) < 0.0001
            
            // 验证其他商品价格未变
            const otherPricesUnchanged = updatedOrder.items
              .filter((_, i) => i !== targetIndex)
              .every((item, i) => Math.abs(item.unitPrice - otherItemsPrices[i]) < 0.0001)
            
            return targetPriceChanged && otherPricesUnchanged
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 14: 销售退货增加库存
   * *对于任意*销售退货单，确认退货后，每个商品的库存增加量应该等于退货数量（换算为基本单位）。
   * **验证需求: 4.1.5**
   * 
   * Feature: hardware-store-management, Property 14: 销售退货增加库存
   */
  describe('属性 14: 销售退货增加库存', () => {
    it('确认销售退货后库存应该正确增加（基本单位）', () => {
      fc.assert(
        fc.property(
          quantityArb.filter(q => q >= 2), // 确保数量足够大以便退货
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加足够的库存
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
            
            // 获取销售后的库存
            const inventoryAfterSale = inventoryService.getInventory(product.id)
            const quantityAfterSale = inventoryAfterSale?.quantity ?? 0
            
            // 创建并确认退货单（退货一半）
            const returnQuantity = new Decimal(quantity).div(2).toDecimalPlaces(3).toNumber()
            const returnOrder = salesService.createSalesReturn(order.id, [{
              productId: product.id,
              quantity: returnQuantity,
              unit: product.baseUnit,
              unitPrice: retailPrice,
            }])
            salesService.confirmSalesReturn(returnOrder.id)
            
            // 获取退货后的库存
            const inventoryAfterReturn = inventoryService.getInventory(product.id)
            const quantityAfterReturn = inventoryAfterReturn?.quantity ?? 0
            
            // 验证库存增加量
            const expectedIncrease = new Decimal(returnQuantity).toDecimalPlaces(3).toNumber()
            const actualIncrease = new Decimal(quantityAfterReturn).sub(quantityAfterSale).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualIncrease - expectedIncrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('确认销售退货后库存应该正确增加（包装单位）', () => {
      fc.assert(
        fc.property(
          quantityArb.filter(q => q >= 2),
          priceArb,
          conversionRateArb.filter(r => r >= 1),
          (quantity, retailPrice, conversionRate) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加包装单位
            productService.addPackageUnit(product.id, '箱', conversionRate)
            
            // 添加足够的库存（基本单位）
            const requiredBaseQuantity = new Decimal(quantity).mul(conversionRate).toNumber()
            addInventory(product.id, requiredBaseQuantity + 100)
            
            // 创建并确认销售单（使用包装单位）
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: '箱',
              }],
            })
            salesService.confirmSalesOrder(order.id)
            
            // 获取销售后的库存
            const inventoryAfterSale = inventoryService.getInventory(product.id)
            const quantityAfterSale = inventoryAfterSale?.quantity ?? 0
            
            // 创建并确认退货单（退货一半，使用包装单位）
            const returnQuantity = new Decimal(quantity).div(2).toDecimalPlaces(3).toNumber()
            const returnOrder = salesService.createSalesReturn(order.id, [{
              productId: product.id,
              quantity: returnQuantity,
              unit: '箱',
              unitPrice: retailPrice,
            }])
            salesService.confirmSalesReturn(returnOrder.id)
            
            // 获取退货后的库存
            const inventoryAfterReturn = inventoryService.getInventory(product.id)
            const quantityAfterReturn = inventoryAfterReturn?.quantity ?? 0
            
            // 验证库存增加量（应该是 returnQuantity * conversionRate）
            const expectedIncrease = new Decimal(returnQuantity).mul(conversionRate).toDecimalPlaces(3).toNumber()
            const actualIncrease = new Decimal(quantityAfterReturn).sub(quantityAfterSale).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualIncrease - expectedIncrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('全额退货后库存应该恢复到销售前的状态', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加足够的库存
            const initialStock = quantity + 100
            addInventory(product.id, initialStock)
            
            // 获取销售前的库存
            const inventoryBeforeSale = inventoryService.getInventory(product.id)
            const quantityBeforeSale = inventoryBeforeSale?.quantity ?? 0
            
            // 创建并确认销售单
            const order = salesService.createSalesOrder({
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
              }],
            })
            salesService.confirmSalesOrder(order.id)
            
            // 创建并确认全额退货
            const returnOrder = salesService.createSalesReturn(order.id, [{
              productId: product.id,
              quantity,
              unit: product.baseUnit,
              unitPrice: retailPrice,
            }])
            salesService.confirmSalesReturn(returnOrder.id)
            
            // 获取退货后的库存
            const inventoryAfterReturn = inventoryService.getInventory(product.id)
            const quantityAfterReturn = inventoryAfterReturn?.quantity ?? 0
            
            // 验证库存恢复到销售前的状态
            return Math.abs(quantityAfterReturn - quantityBeforeSale) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('退货数量超过原销售数量时应该拒绝创建', () => {
      fc.assert(
        fc.property(
          quantityArb,
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加足够的库存
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
            
            // 尝试退货超过原数量
            const excessQuantity = new Decimal(quantity).add(0.001).toNumber()
            
            try {
              salesService.createSalesReturn(order.id, [{
                productId: product.id,
                quantity: excessQuantity,
                unit: product.baseUnit,
                unitPrice: retailPrice,
              }])
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('退货数量超出限制')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('部分退货后再次退货时应该验证累计退货数量', () => {
      fc.assert(
        fc.property(
          quantityArb.filter(q => q >= 2),
          priceArb,
          (quantity, retailPrice) => {
            clearDatabase()
            
            const product = createTestProduct({ retailPrice })
            
            // 添加足够的库存
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
            
            // 第一次退货一半
            const firstReturnQuantity = new Decimal(quantity).div(2).toDecimalPlaces(3).toNumber()
            const firstReturn = salesService.createSalesReturn(order.id, [{
              productId: product.id,
              quantity: firstReturnQuantity,
              unit: product.baseUnit,
              unitPrice: retailPrice,
            }])
            salesService.confirmSalesReturn(firstReturn.id)
            
            // 尝试第二次退货超过剩余数量
            const remainingQuantity = new Decimal(quantity).sub(firstReturnQuantity).toNumber()
            const excessQuantity = new Decimal(remainingQuantity).add(0.001).toNumber()
            
            try {
              salesService.createSalesReturn(order.id, [{
                productId: product.id,
                quantity: excessQuantity,
                unit: product.baseUnit,
                unitPrice: retailPrice,
              }])
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('退货数量超出限制')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
