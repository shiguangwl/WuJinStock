/**
 * 种子数据脚本
 * 为五金店管理系统添加测试数据
 * 
 * 运行方式: npx tsx scripts/seed.ts
 */
import { db } from '../src/server/db'
import {
  products,
  storageLocations,
  productStorageLocations,
  packageUnits,
  inventoryRecords,
  inventoryTransactions,
  purchaseOrders,
  purchaseOrderItems,
  salesOrders,
  salesOrderItems,
  stockTakings,
  stockTakingItems,
} from '../src/server/db/schema'
import { createId } from '@paralleldrive/cuid2'

// ==================== 测试数据定义 ====================

const STORAGE_LOCATIONS = [
  { name: 'A区-货架1', description: '五金工具区' },
  { name: 'A区-货架2', description: '电动工具区' },
  { name: 'B区-货架1', description: '水暖配件区' },
  { name: 'B区-货架2', description: '电气配件区' },
  { name: 'C区-仓库', description: '大件商品存放' },
]

const PRODUCTS_DATA = [
  // 五金工具
  { code: 'WJ000001', name: '十字螺丝刀', specification: '6寸', baseUnit: '把', purchasePrice: 5.5, retailPrice: 12, supplier: '永固工具厂', minStockThreshold: 20 },
  { code: 'WJ000002', name: '一字螺丝刀', specification: '6寸', baseUnit: '把', purchasePrice: 5, retailPrice: 10, supplier: '永固工具厂', minStockThreshold: 20 },
  { code: 'WJ000003', name: '活动扳手', specification: '8寸', baseUnit: '把', purchasePrice: 15, retailPrice: 35, supplier: '永固工具厂', minStockThreshold: 10 },
  { code: 'WJ000004', name: '羊角锤', specification: '500g', baseUnit: '把', purchasePrice: 18, retailPrice: 38, supplier: '永固工具厂', minStockThreshold: 10 },
  { code: 'WJ000005', name: '钢卷尺', specification: '5米', baseUnit: '把', purchasePrice: 8, retailPrice: 18, supplier: '永固工具厂', minStockThreshold: 15 },
  
  // 电动工具
  { code: 'DD000001', name: '电钻', specification: '220V/500W', baseUnit: '台', purchasePrice: 120, retailPrice: 268, supplier: '博世电动工具', minStockThreshold: 5 },
  { code: 'DD000002', name: '角磨机', specification: '220V/850W', baseUnit: '台', purchasePrice: 150, retailPrice: 328, supplier: '博世电动工具', minStockThreshold: 5 },
  { code: 'DD000003', name: '电锤', specification: '220V/1200W', baseUnit: '台', purchasePrice: 280, retailPrice: 598, supplier: '博世电动工具', minStockThreshold: 3 },
  
  // 水暖配件
  { code: 'SN000001', name: 'PPR水管', specification: '20mm', baseUnit: '米', purchasePrice: 3.5, retailPrice: 8, supplier: '联塑管业', minStockThreshold: 100 },
  { code: 'SN000002', name: 'PPR弯头', specification: '20mm/90度', baseUnit: '个', purchasePrice: 1.2, retailPrice: 3, supplier: '联塑管业', minStockThreshold: 50 },
  { code: 'SN000003', name: 'PPR三通', specification: '20mm', baseUnit: '个', purchasePrice: 1.5, retailPrice: 4, supplier: '联塑管业', minStockThreshold: 50 },
  { code: 'SN000004', name: '球阀', specification: '4分', baseUnit: '个', purchasePrice: 8, retailPrice: 18, supplier: '联塑管业', minStockThreshold: 20 },
  { code: 'SN000005', name: '角阀', specification: '4分', baseUnit: '个', purchasePrice: 12, retailPrice: 28, supplier: '联塑管业', minStockThreshold: 20 },
  
  // 电气配件
  { code: 'DQ000001', name: '电线', specification: 'BV2.5平方', baseUnit: '米', purchasePrice: 2.8, retailPrice: 5.5, supplier: '远东电缆', minStockThreshold: 500 },
  { code: 'DQ000002', name: '电线', specification: 'BV4平方', baseUnit: '米', purchasePrice: 4.5, retailPrice: 8.5, supplier: '远东电缆', minStockThreshold: 300 },
  { code: 'DQ000003', name: '开关面板', specification: '单开单控', baseUnit: '个', purchasePrice: 6, retailPrice: 15, supplier: '公牛电器', minStockThreshold: 30 },
  { code: 'DQ000004', name: '插座面板', specification: '五孔', baseUnit: '个', purchasePrice: 8, retailPrice: 18, supplier: '公牛电器', minStockThreshold: 30 },
  { code: 'DQ000005', name: '空气开关', specification: '2P/32A', baseUnit: '个', purchasePrice: 25, retailPrice: 55, supplier: '正泰电器', minStockThreshold: 10 },
  
  // 紧固件
  { code: 'JG000001', name: '膨胀螺丝', specification: 'M8x80', baseUnit: '个', purchasePrice: 0.35, retailPrice: 1, supplier: '华人螺丝', minStockThreshold: 200 },
  { code: 'JG000002', name: '自攻螺丝', specification: 'M4x30', baseUnit: '个', purchasePrice: 0.05, retailPrice: 0.2, supplier: '华人螺丝', minStockThreshold: 500 },
  { code: 'JG000003', name: '六角螺栓', specification: 'M10x50', baseUnit: '个', purchasePrice: 0.8, retailPrice: 2, supplier: '华人螺丝', minStockThreshold: 100 },
  { code: 'JG000004', name: '平垫片', specification: 'M10', baseUnit: '个', purchasePrice: 0.02, retailPrice: 0.1, supplier: '华人螺丝', minStockThreshold: 500 },
  { code: 'JG000005', name: '弹簧垫片', specification: 'M10', baseUnit: '个', purchasePrice: 0.03, retailPrice: 0.15, supplier: '华人螺丝', minStockThreshold: 500 },
]

// 包装单位配置（部分商品有多种包装）
const PACKAGE_UNITS_CONFIG: Record<string, Array<{ name: string; conversionRate: number; purchasePrice?: number; retailPrice?: number }>> = {
  'WJ000001': [{ name: '盒', conversionRate: 10, purchasePrice: 50, retailPrice: 100 }],
  'WJ000002': [{ name: '盒', conversionRate: 10, purchasePrice: 45, retailPrice: 90 }],
  'SN000001': [{ name: '卷', conversionRate: 50, purchasePrice: 160, retailPrice: 350 }],
  'DQ000001': [{ name: '卷', conversionRate: 100, purchasePrice: 260, retailPrice: 500 }],
  'DQ000002': [{ name: '卷', conversionRate: 100, purchasePrice: 420, retailPrice: 800 }],
  'JG000001': [{ name: '盒', conversionRate: 100, purchasePrice: 32, retailPrice: 80 }],
  'JG000002': [{ name: '盒', conversionRate: 500, purchasePrice: 22, retailPrice: 80 }, { name: '箱', conversionRate: 5000, purchasePrice: 200, retailPrice: 700 }],
  'JG000003': [{ name: '盒', conversionRate: 50, purchasePrice: 35, retailPrice: 85 }],
  'JG000004': [{ name: '包', conversionRate: 100, purchasePrice: 1.8, retailPrice: 8 }],
  'JG000005': [{ name: '包', conversionRate: 100, purchasePrice: 2.5, retailPrice: 12 }],
}

// ==================== 种子数据插入 ====================

async function seed() {
  console.log('🌱 开始插入种子数据...')

  // 1. 插入存放位置
  console.log('📍 插入存放位置...')
  const locationIds: Record<string, string> = {}
  for (const loc of STORAGE_LOCATIONS) {
    const id = createId()
    locationIds[loc.name] = id
    await db.insert(storageLocations).values({ id, ...loc })
  }

  // 2. 插入商品
  console.log('📦 插入商品...')
  const productIds: Record<string, string> = {}
  for (const product of PRODUCTS_DATA) {
    const id = createId()
    productIds[product.code] = id
    await db.insert(products).values({ id, ...product })
  }

  // 3. 插入包装单位
  console.log('📐 插入包装单位...')
  for (const [code, units] of Object.entries(PACKAGE_UNITS_CONFIG)) {
    const productId = productIds[code]
    for (const unit of units) {
      await db.insert(packageUnits).values({
        id: createId(),
        productId,
        ...unit,
      })
    }
  }

  // 4. 插入商品存放位置关联
  console.log('🔗 插入商品存放位置关联...')
  const locationAssignments: Record<string, string[]> = {
    'A区-货架1': ['WJ000001', 'WJ000002', 'WJ000003', 'WJ000004', 'WJ000005'],
    'A区-货架2': ['DD000001', 'DD000002', 'DD000003'],
    'B区-货架1': ['SN000001', 'SN000002', 'SN000003', 'SN000004', 'SN000005'],
    'B区-货架2': ['DQ000001', 'DQ000002', 'DQ000003', 'DQ000004', 'DQ000005'],
    'C区-仓库': ['JG000001', 'JG000002', 'JG000003', 'JG000004', 'JG000005'],
  }
  for (const [locName, codes] of Object.entries(locationAssignments)) {
    for (const code of codes) {
      await db.insert(productStorageLocations).values({
        id: createId(),
        productId: productIds[code],
        locationId: locationIds[locName],
        isPrimary: true,
      })
    }
  }

  // 5. 插入库存记录
  console.log('📊 插入库存记录...')
  const initialStock: Record<string, number> = {
    'WJ000001': 50, 'WJ000002': 45, 'WJ000003': 25, 'WJ000004': 20, 'WJ000005': 30,
    'DD000001': 8, 'DD000002': 6, 'DD000003': 4,
    'SN000001': 200, 'SN000002': 100, 'SN000003': 80, 'SN000004': 40, 'SN000005': 35,
    'DQ000001': 800, 'DQ000002': 500, 'DQ000003': 50, 'DQ000004': 60, 'DQ000005': 20,
    'JG000001': 500, 'JG000002': 2000, 'JG000003': 200, 'JG000004': 1000, 'JG000005': 800,
  }
  for (const [code, quantity] of Object.entries(initialStock)) {
    await db.insert(inventoryRecords).values({
      id: createId(),
      productId: productIds[code],
      quantity,
    })
  }

  // 6. 插入进货单
  console.log('🛒 插入进货单...')
  const now = new Date()
  const purchaseOrderData = [
    {
      orderNumber: 'PO20251201001',
      supplier: '永固工具厂',
      orderDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      status: 'CONFIRMED' as const,
      items: [
        { code: 'WJ000001', quantity: 30, unit: '把', unitPrice: 5.5 },
        { code: 'WJ000002', quantity: 25, unit: '把', unitPrice: 5 },
        { code: 'WJ000003', quantity: 15, unit: '把', unitPrice: 15 },
      ],
    },
    {
      orderNumber: 'PO20251215001',
      supplier: '联塑管业',
      orderDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      status: 'CONFIRMED' as const,
      items: [
        { code: 'SN000001', quantity: 100, unit: '米', unitPrice: 3.5 },
        { code: 'SN000002', quantity: 50, unit: '个', unitPrice: 1.2 },
        { code: 'SN000004', quantity: 20, unit: '个', unitPrice: 8 },
      ],
    },
    {
      orderNumber: 'PO20251228001',
      supplier: '华人螺丝',
      orderDate: now,
      status: 'PENDING' as const,
      items: [
        { code: 'JG000001', quantity: 200, unit: '个', unitPrice: 0.35 },
        { code: 'JG000002', quantity: 1000, unit: '个', unitPrice: 0.05 },
      ],
    },
  ]

  for (const order of purchaseOrderData) {
    const orderId = createId()
    const totalAmount = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    
    await db.insert(purchaseOrders).values({
      id: orderId,
      orderNumber: order.orderNumber,
      supplier: order.supplier,
      orderDate: order.orderDate,
      totalAmount,
      status: order.status,
      confirmedAt: order.status === 'CONFIRMED' ? order.orderDate : undefined,
    })

    for (const item of order.items) {
      const product = PRODUCTS_DATA.find(p => p.code === item.code)!
      await db.insert(purchaseOrderItems).values({
        id: createId(),
        purchaseOrderId: orderId,
        productId: productIds[item.code],
        productName: product.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
      })
    }
  }

  // 7. 插入销售单
  console.log('💰 插入销售单...')
  const salesOrderData = [
    {
      orderNumber: 'SO20251220001',
      customerName: '张师傅',
      orderDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      status: 'CONFIRMED' as const,
      discountAmount: 5,
      roundingAmount: 0.5,
      items: [
        { code: 'WJ000001', quantity: 2, unit: '把', unitPrice: 12 },
        { code: 'WJ000003', quantity: 1, unit: '把', unitPrice: 35 },
        { code: 'JG000001', quantity: 20, unit: '个', unitPrice: 1 },
      ],
    },
    {
      orderNumber: 'SO20251225001',
      customerName: '李工',
      orderDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      status: 'CONFIRMED' as const,
      discountAmount: 20,
      roundingAmount: 0,
      items: [
        { code: 'DD000001', quantity: 1, unit: '台', unitPrice: 268 },
        { code: 'DQ000001', quantity: 50, unit: '米', unitPrice: 5.5 },
        { code: 'DQ000003', quantity: 5, unit: '个', unitPrice: 15 },
      ],
    },
    {
      orderNumber: 'SO20251228001',
      customerName: null,
      orderDate: now,
      status: 'PENDING' as const,
      discountAmount: 0,
      roundingAmount: 0,
      items: [
        { code: 'SN000001', quantity: 20, unit: '米', unitPrice: 8 },
        { code: 'SN000002', quantity: 10, unit: '个', unitPrice: 3 },
        { code: 'SN000004', quantity: 2, unit: '个', unitPrice: 18 },
      ],
    },
  ]

  for (const order of salesOrderData) {
    const orderId = createId()
    const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const totalAmount = subtotal - order.discountAmount - order.roundingAmount

    await db.insert(salesOrders).values({
      id: orderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      orderDate: order.orderDate,
      subtotal,
      discountAmount: order.discountAmount,
      roundingAmount: order.roundingAmount,
      totalAmount,
      status: order.status,
      confirmedAt: order.status === 'CONFIRMED' ? order.orderDate : undefined,
    })

    for (const item of order.items) {
      const product = PRODUCTS_DATA.find(p => p.code === item.code)!
      await db.insert(salesOrderItems).values({
        id: createId(),
        salesOrderId: orderId,
        productId: productIds[item.code],
        productName: product.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        originalPrice: product.retailPrice,
        subtotal: item.quantity * item.unitPrice,
      })
    }
  }

  // 8. 插入库存变动记录
  console.log('📈 插入库存变动记录...')
  const transactions = [
    { code: 'WJ000001', type: 'PURCHASE', change: 30, unit: '把', note: '进货入库' },
    { code: 'WJ000001', type: 'SALE', change: -2, unit: '把', note: '销售出库' },
    { code: 'DD000001', type: 'SALE', change: -1, unit: '台', note: '销售出库' },
    { code: 'SN000001', type: 'PURCHASE', change: 100, unit: '米', note: '进货入库' },
    { code: 'DQ000001', type: 'SALE', change: -50, unit: '米', note: '销售出库' },
  ]

  for (const tx of transactions) {
    await db.insert(inventoryTransactions).values({
      id: createId(),
      productId: productIds[tx.code],
      transactionType: tx.type,
      quantityChange: tx.change,
      unit: tx.unit,
      note: tx.note,
    })
  }

  // 9. 插入盘点记录
  console.log('📋 插入盘点记录...')
  const stockTakingId = createId()
  await db.insert(stockTakings).values({
    id: stockTakingId,
    takingDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    status: 'COMPLETED',
    completedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
  })

  const stockTakingItemsData = [
    { code: 'WJ000001', systemQuantity: 48, actualQuantity: 50, unit: '把' },
    { code: 'WJ000002', systemQuantity: 45, actualQuantity: 45, unit: '把' },
    { code: 'DD000001', systemQuantity: 8, actualQuantity: 8, unit: '台' },
    { code: 'JG000002', systemQuantity: 2050, actualQuantity: 2000, unit: '个' },
  ]

  for (const item of stockTakingItemsData) {
    const product = PRODUCTS_DATA.find(p => p.code === item.code)!
    await db.insert(stockTakingItems).values({
      id: createId(),
      stockTakingId,
      productId: productIds[item.code],
      productName: product.name,
      systemQuantity: item.systemQuantity,
      actualQuantity: item.actualQuantity,
      difference: item.actualQuantity - item.systemQuantity,
      unit: item.unit,
    })
  }

  console.log('✅ 种子数据插入完成！')
  console.log(`   - 存放位置: ${STORAGE_LOCATIONS.length} 条`)
  console.log(`   - 商品: ${PRODUCTS_DATA.length} 条`)
  console.log(`   - 进货单: ${purchaseOrderData.length} 条`)
  console.log(`   - 销售单: ${salesOrderData.length} 条`)
  console.log(`   - 盘点记录: 1 条`)
}

seed().catch(console.error)
