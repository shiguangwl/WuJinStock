/**
 * 进货服务层属性测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { createTestDb, initTestDbSchema } from '@/test/db-helpers'
import { createPurchaseServiceFromSqlite, PurchaseService } from '../purchase-service'
import { createProductServiceFromSqlite, ProductService } from '../product-service'
import { createInventoryServiceFromSqlite, InventoryService } from '../inventory-service'
import { priceArb, quantityArb, supplierNameArb, conversionRateArb } from '@/test/generators'
import type Database from 'better-sqlite3'
import Decimal from 'decimal.js'

describe('进货服务层属性测试', () => {
  let sqlite: Database.Database
  let purchaseService: PurchaseService
  let productService: ProductService
  let inventoryService: InventoryService

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    initTestDbSchema(sqlite)
    purchaseService = createPurchaseServiceFromSqlite(sqlite)
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

  /**
   * 属性 11: 进货单验证
   * *对于任意*进货单，如果商品清单为空或任何商品数量小于等于零，系统应该拒绝创建。
   * **验证需求: 3.2**
   * 
   * Feature: hardware-store-management, Property 11: 进货单验证
   */
  describe('属性 11: 进货单验证', () => {
    it('商品清单为空时应该拒绝创建', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          (supplier) => {
            clearDatabase()
            
            try {
              purchaseService.createPurchaseOrder({
                supplier,
                items: [],
              })
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('商品清单不能为空')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('商品数量为零或负数时应该拒绝创建', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          fc.constantFrom(0, -1, -0.5, -100),
          priceArb,
          (supplier, invalidQuantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            try {
              purchaseService.createPurchaseOrder({
                supplier,
                items: [{
                  productId: product.id,
                  quantity: invalidQuantity,
                  unit: product.baseUnit,
                  unitPrice,
                }],
              })
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('商品数量必须大于零')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('供应商为空时应该拒绝创建', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n'),
          quantityArb,
          priceArb,
          (emptySupplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            try {
              purchaseService.createPurchaseOrder({
                supplier: emptySupplier,
                items: [{
                  productId: product.id,
                  quantity,
                  unit: product.baseUnit,
                  unitPrice,
                }],
              })
              return false
            } catch (error) {
              return error instanceof Error && error.message.includes('供应商不能为空')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('有效的进货单数据应该成功创建', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            
            return (
              order.id !== undefined &&
              order.supplier === supplier.trim() &&
              order.status === 'PENDING' &&
              order.items.length === 1 &&
              order.items[0].productId === product.id
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 10: 进货增加库存
   * *对于任意*进货单，确认进货后，每个商品的库存增加量（换算为基本单位）应该等于进货单中该商品的数量（换算为基本单位）。
   * **验证需求: 3.4**
   * 
   * Feature: hardware-store-management, Property 10: 进货增加库存
   */
  describe('属性 10: 进货增加库存', () => {
    it('确认进货单后库存应该正确增加（基本单位）', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 获取初始库存
            const initialInventory = inventoryService.getInventory(product.id)
            const initialQuantity = initialInventory?.quantity ?? 0
            
            // 创建并确认进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 获取更新后的库存
            const updatedInventory = inventoryService.getInventory(product.id)
            const updatedQuantity = updatedInventory?.quantity ?? 0
            
            // 验证库存增加量
            const expectedIncrease = new Decimal(quantity).toDecimalPlaces(3).toNumber()
            const actualIncrease = new Decimal(updatedQuantity).sub(initialQuantity).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualIncrease - expectedIncrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('确认进货单后库存应该正确增加（包装单位）', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          conversionRateArb,
          (supplier, quantity, unitPrice, conversionRate) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 添加包装单位
            productService.addPackageUnit(product.id, '箱', conversionRate)
            
            // 获取初始库存
            const initialInventory = inventoryService.getInventory(product.id)
            const initialQuantity = initialInventory?.quantity ?? 0
            
            // 创建并确认进货单（使用包装单位）
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: '箱',
                unitPrice,
              }],
            })
            
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 获取更新后的库存
            const updatedInventory = inventoryService.getInventory(product.id)
            const updatedQuantity = updatedInventory?.quantity ?? 0
            
            // 验证库存增加量（应该是 quantity * conversionRate）
            const expectedIncrease = new Decimal(quantity).mul(conversionRate).toDecimalPlaces(3).toNumber()
            const actualIncrease = new Decimal(updatedQuantity).sub(initialQuantity).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualIncrease - expectedIncrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('多个商品的进货单应该正确增加各自的库存', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          fc.array(
            fc.record({
              quantity: quantityArb,
              unitPrice: priceArb,
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (supplier, itemsData) => {
            clearDatabase()
            
            // 创建多个商品
            const products = itemsData.map((_, index) => 
              createTestProduct({ name: `商品${index}` })
            )
            
            // 获取初始库存
            const initialQuantities = products.map(p => {
              const inv = inventoryService.getInventory(p.id)
              return inv?.quantity ?? 0
            })
            
            // 创建并确认进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: products.map((p, index) => ({
                productId: p.id,
                quantity: itemsData[index].quantity,
                unit: p.baseUnit,
                unitPrice: itemsData[index].unitPrice,
              })),
            })
            
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 验证每个商品的库存增加量
            return products.every((p, index) => {
              const updatedInventory = inventoryService.getInventory(p.id)
              const updatedQuantity = updatedInventory?.quantity ?? 0
              const expectedIncrease = new Decimal(itemsData[index].quantity).toDecimalPlaces(3).toNumber()
              const actualIncrease = new Decimal(updatedQuantity).sub(initialQuantities[index]).toDecimalPlaces(3).toNumber()
              return Math.abs(actualIncrease - expectedIncrease) < 0.001
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 9: 进货单金额计算
   * *对于任意*进货单，其总金额应该等于所有商品明细的小计之和。
   * **验证需求: 3.5**
   * 
   * Feature: hardware-store-management, Property 9: 进货单金额计算
   */
  describe('属性 9: 进货单金额计算', () => {
    it('进货单总金额应该等于所有明细小计之和', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          fc.array(
            fc.record({
              quantity: quantityArb,
              unitPrice: priceArb,
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (supplier, itemsData) => {
            clearDatabase()
            
            // 创建商品
            const products = itemsData.map((_, index) => 
              createTestProduct({ name: `商品${index}` })
            )
            
            // 创建进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: products.map((p, index) => ({
                productId: p.id,
                quantity: itemsData[index].quantity,
                unit: p.baseUnit,
                unitPrice: itemsData[index].unitPrice,
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
          supplierNameArb,
          quantityArb,
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            
            const item = order.items[0]
            const expectedSubtotal = new Decimal(quantity).mul(unitPrice).toDecimalPlaces(2).toNumber()
            
            return Math.abs(item.subtotal - expectedSubtotal) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * 属性 12: 退货数量限制
   * *对于任意*退货单（进货退货或销售退货），每个商品的退货数量不应该超过原订单中该商品的数量。
   * **验证需求: 3.1.4, 4.1.4**
   * 
   * Feature: hardware-store-management, Property 12: 退货数量限制
   */
  describe('属性 12: 退货数量限制', () => {
    it('退货数量超过原进货数量时应该拒绝创建', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 创建并确认进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 尝试退货超过原数量
            const excessQuantity = new Decimal(quantity).add(0.001).toNumber()
            
            try {
              purchaseService.createPurchaseReturn(order.id, [{
                productId: product.id,
                quantity: excessQuantity,
                unit: product.baseUnit,
                unitPrice,
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

    it('退货数量等于原进货数量时应该成功创建', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 创建并确认进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 退货等于原数量
            const returnOrder = purchaseService.createPurchaseReturn(order.id, [{
              productId: product.id,
              quantity,
              unit: product.baseUnit,
              unitPrice,
            }])
            
            return (
              returnOrder.id !== undefined &&
              returnOrder.items.length === 1 &&
              Math.abs(returnOrder.items[0].quantity - quantity) < 0.001
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('部分退货后再次退货时应该验证累计退货数量', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb.filter(q => q >= 2),
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 创建并确认进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 第一次退货一半
            const firstReturnQuantity = new Decimal(quantity).div(2).toDecimalPlaces(3).toNumber()
            const firstReturn = purchaseService.createPurchaseReturn(order.id, [{
              productId: product.id,
              quantity: firstReturnQuantity,
              unit: product.baseUnit,
              unitPrice,
            }])
            purchaseService.confirmPurchaseReturn(firstReturn.id)
            
            // 尝试第二次退货超过剩余数量
            const remainingQuantity = new Decimal(quantity).sub(firstReturnQuantity).toNumber()
            const excessQuantity = new Decimal(remainingQuantity).add(0.001).toNumber()
            
            try {
              purchaseService.createPurchaseReturn(order.id, [{
                productId: product.id,
                quantity: excessQuantity,
                unit: product.baseUnit,
                unitPrice,
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

  /**
   * 属性 13: 进货退货减少库存
   * *对于任意*进货退货单，确认退货后，每个商品的库存减少量应该等于退货数量（换算为基本单位）。
   * **验证需求: 3.1.5**
   * 
   * Feature: hardware-store-management, Property 13: 进货退货减少库存
   */
  describe('属性 13: 进货退货减少库存', () => {
    it('确认进货退货后库存应该正确减少（基本单位）', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 创建并确认进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 获取进货后的库存
            const inventoryAfterPurchase = inventoryService.getInventory(product.id)
            const quantityAfterPurchase = inventoryAfterPurchase?.quantity ?? 0
            
            // 创建并确认退货单（退货一半）
            const returnQuantity = new Decimal(quantity).div(2).toDecimalPlaces(3).toNumber()
            const returnOrder = purchaseService.createPurchaseReturn(order.id, [{
              productId: product.id,
              quantity: returnQuantity,
              unit: product.baseUnit,
              unitPrice,
            }])
            purchaseService.confirmPurchaseReturn(returnOrder.id)
            
            // 获取退货后的库存
            const inventoryAfterReturn = inventoryService.getInventory(product.id)
            const quantityAfterReturn = inventoryAfterReturn?.quantity ?? 0
            
            // 验证库存减少量
            const expectedDecrease = new Decimal(returnQuantity).toDecimalPlaces(3).toNumber()
            const actualDecrease = new Decimal(quantityAfterPurchase).sub(quantityAfterReturn).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualDecrease - expectedDecrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('确认进货退货后库存应该正确减少（包装单位）', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          conversionRateArb,
          (supplier, quantity, unitPrice, conversionRate) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 添加包装单位
            productService.addPackageUnit(product.id, '箱', conversionRate)
            
            // 创建并确认进货单（使用包装单位）
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: '箱',
                unitPrice,
              }],
            })
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 获取进货后的库存
            const inventoryAfterPurchase = inventoryService.getInventory(product.id)
            const quantityAfterPurchase = inventoryAfterPurchase?.quantity ?? 0
            
            // 创建并确认退货单（退货一半，使用包装单位）
            const returnQuantity = new Decimal(quantity).div(2).toDecimalPlaces(3).toNumber()
            const returnOrder = purchaseService.createPurchaseReturn(order.id, [{
              productId: product.id,
              quantity: returnQuantity,
              unit: '箱',
              unitPrice,
            }])
            purchaseService.confirmPurchaseReturn(returnOrder.id)
            
            // 获取退货后的库存
            const inventoryAfterReturn = inventoryService.getInventory(product.id)
            const quantityAfterReturn = inventoryAfterReturn?.quantity ?? 0
            
            // 验证库存减少量（应该是 returnQuantity * conversionRate）
            const expectedDecrease = new Decimal(returnQuantity).mul(conversionRate).toDecimalPlaces(3).toNumber()
            const actualDecrease = new Decimal(quantityAfterPurchase).sub(quantityAfterReturn).toDecimalPlaces(3).toNumber()
            
            return Math.abs(actualDecrease - expectedDecrease) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('全额退货后库存应该恢复到进货前的状态', () => {
      fc.assert(
        fc.property(
          supplierNameArb,
          quantityArb,
          priceArb,
          (supplier, quantity, unitPrice) => {
            clearDatabase()
            
            const product = createTestProduct()
            
            // 获取初始库存
            const initialInventory = inventoryService.getInventory(product.id)
            const initialQuantity = initialInventory?.quantity ?? 0
            
            // 创建并确认进货单
            const order = purchaseService.createPurchaseOrder({
              supplier,
              items: [{
                productId: product.id,
                quantity,
                unit: product.baseUnit,
                unitPrice,
              }],
            })
            purchaseService.confirmPurchaseOrder(order.id)
            
            // 创建并确认全额退货
            const returnOrder = purchaseService.createPurchaseReturn(order.id, [{
              productId: product.id,
              quantity,
              unit: product.baseUnit,
              unitPrice,
            }])
            purchaseService.confirmPurchaseReturn(returnOrder.id)
            
            // 获取退货后的库存
            const finalInventory = inventoryService.getInventory(product.id)
            const finalQuantity = finalInventory?.quantity ?? 0
            
            // 验证库存恢复到初始状态
            return Math.abs(finalQuantity - initialQuantity) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
