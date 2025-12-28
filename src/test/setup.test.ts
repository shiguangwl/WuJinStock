import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { createTestDb, initTestDbSchema } from './db-helpers'
import { priceArb, quantityArb, conversionRateArb } from './generators'

describe('测试框架验证', () => {
  it('Vitest 正常工作', () => {
    expect(1 + 1).toBe(2)
  })

  it('fast-check 正常工作', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a
      }),
      { numRuns: 100 }
    )
  })

  it('测试数据库可以创建', () => {
    const { db, sqlite } = createTestDb()
    initTestDbSchema(sqlite)
    expect(db).toBeDefined()
    sqlite.close()
  })

  it('价格生成器生成有效值', () => {
    fc.assert(
      fc.property(priceArb, (price) => {
        return price > 0 && price <= 99999.9999
      }),
      { numRuns: 100 }
    )
  })

  it('数量生成器生成有效值', () => {
    fc.assert(
      fc.property(quantityArb, (quantity) => {
        return quantity > 0 && quantity <= 99999.999
      }),
      { numRuns: 100 }
    )
  })

  it('换算比例生成器生成有效值', () => {
    fc.assert(
      fc.property(conversionRateArb, (rate) => {
        return rate > 0 && rate <= 10000
      }),
      { numRuns: 100 }
    )
  })
})
