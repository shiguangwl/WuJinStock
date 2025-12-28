/**
 * 测试数据生成器
 * 用于属性测试的随机数据生成
 */
import * as fc from 'fast-check'
import type { NewProduct, NewPackageUnit, NewStorageLocation } from '@/server/db/schema'

/**
 * 生成有效的商品编码
 */
export const productCodeArb = fc.stringMatching(/^[A-Z]{2}[0-9]{6}$/)

/**
 * 生成有效的商品名称（非空字符串）
 */
export const productNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0)

/**
 * 生成有效的单位名称
 */
export const unitNameArb = fc.constantFrom('个', '件', '箱', '盒', '包', '米', '公斤', '克', '升', '毫升')

/**
 * 生成有效的价格（正数，最多4位小数）
 */
export const priceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(99999), noNaN: true })
  .map(n => Math.round(n * 10000) / 10000)
  .filter(n => n > 0)

/**
 * 生成有效的数量（正数，最多3位小数）
 */
export const quantityArb = fc.float({ min: Math.fround(0.01), max: Math.fround(99999), noNaN: true })
  .map(n => Math.round(n * 1000) / 1000)
  .filter(n => n > 0)

/**
 * 生成有效的换算比例（大于0）
 */
export const conversionRateArb = fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true })
  .map(n => Math.round(n * 1000) / 1000)
  .filter(n => n > 0)

/**
 * 生成有效的库存阈值（非负数）
 */
export const stockThresholdArb = fc.float({ min: Math.fround(0), max: Math.fround(99999), noNaN: true })
  .map(n => Math.round(n * 1000) / 1000)

/**
 * 生成有效的商品数据
 */
export const newProductArb: fc.Arbitrary<Omit<NewProduct, 'id' | 'createdAt' | 'updatedAt'>> = fc.record({
  code: productCodeArb,
  name: productNameArb,
  specification: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  baseUnit: unitNameArb,
  purchasePrice: priceArb,
  retailPrice: priceArb,
  supplier: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  minStockThreshold: fc.option(stockThresholdArb, { nil: undefined }),
})

/**
 * 生成有效的包装单位数据
 */
export const newPackageUnitArb = (productId: string): fc.Arbitrary<Omit<NewPackageUnit, 'id'>> => 
  fc.record({
    productId: fc.constant(productId),
    name: unitNameArb,
    conversionRate: conversionRateArb,
    purchasePrice: fc.option(priceArb, { nil: undefined }),
    retailPrice: fc.option(priceArb, { nil: undefined }),
  })

/**
 * 生成有效的存放位置数据
 */
export const newStorageLocationArb: fc.Arbitrary<Omit<NewStorageLocation, 'id' | 'createdAt'>> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
})

/**
 * 生成供应商名称
 */
export const supplierNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0)

/**
 * 生成客户名称
 */
export const customerNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  { nil: undefined }
)

/**
 * 生成折扣百分比（0-100）
 */
export const discountPercentArb = fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true })
  .map(n => Math.round(n * 100) / 100)

/**
 * 生成抹零金额（小额，通常0-10元）
 */
export const roundingAmountArb = fc.float({ min: Math.fround(0), max: Math.fround(10), noNaN: true })
  .map(n => Math.round(n * 100) / 100)
