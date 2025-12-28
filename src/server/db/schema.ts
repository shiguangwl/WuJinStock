import { sqliteTable, text, real, integer, unique } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

// ==================== 商品相关表 ====================

/**
 * 商品表
 * 精度说明（应用层使用 Decimal.js 处理）：
 * - 单价字段: 4 位小数精度，支持极低单价如垫片 0.0050 元/个
 * - 数量字段: 3 位小数精度，支持连续计量如电线 1.255 米
 * - 金额字段: 2 位小数精度，最终金额保留 2 位小数
 */
export const products = sqliteTable('products', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  specification: text('specification'),
  baseUnit: text('base_unit').notNull(),
  purchasePrice: real('purchase_price').notNull(),
  retailPrice: real('retail_price').notNull(),
  supplier: text('supplier'),
  minStockThreshold: real('min_stock_threshold').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert

/**
 * 存放位置表
 */
export const storageLocations = sqliteTable('storage_locations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').unique().notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type StorageLocation = typeof storageLocations.$inferSelect
export type NewStorageLocation = typeof storageLocations.$inferInsert

/**
 * 商品存放位置关联表
 * 仅记录商品存放在哪些位置，不记录具体数量
 * 库存数量统一由 inventory_records 表管理（单一事实来源）
 */
export const productStorageLocations = sqliteTable('product_storage_locations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  locationId: text('location_id').notNull().references(() => storageLocations.id, { onDelete: 'cascade' }),
  note: text('note'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => [
  unique().on(table.productId, table.locationId),
])

export type ProductStorageLocation = typeof productStorageLocations.$inferSelect
export type NewProductStorageLocation = typeof productStorageLocations.$inferInsert


/**
 * 包装单位表
 * 价格计算逻辑：
 * 1. 优先使用包装单位的特定价格（如果设置了）
 * 2. 如果没有设置，则使用：基础单价 × 换算率
 */
export const packageUnits = sqliteTable('package_units', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  conversionRate: real('conversion_rate').notNull(),
  purchasePrice: real('purchase_price'),
  retailPrice: real('retail_price'),
}, (table) => [
  unique().on(table.productId, table.name),
])

export type PackageUnit = typeof packageUnits.$inferSelect
export type NewPackageUnit = typeof packageUnits.$inferInsert

// ==================== 库存相关表 ====================

/**
 * 库存记录表
 */
export const inventoryRecords = sqliteTable('inventory_records', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').unique().notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: real('quantity').notNull(),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export type InventoryRecord = typeof inventoryRecords.$inferSelect
export type NewInventoryRecord = typeof inventoryRecords.$inferInsert

/**
 * 库存变动记录表
 * transactionType: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN'
 */
export const inventoryTransactions = sqliteTable('inventory_transactions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').notNull().references(() => products.id),
  transactionType: text('transaction_type').notNull(),
  quantityChange: real('quantity_change').notNull(),
  unit: text('unit').notNull(),
  referenceId: text('reference_id'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  note: text('note'),
})

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert
export type TransactionType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN'


// ==================== 进货相关表 ====================

/**
 * 进货单表
 * status: 'PENDING' | 'CONFIRMED'
 */
export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber: text('order_number').unique().notNull(),
  supplier: text('supplier').notNull(),
  orderDate: integer('order_date', { mode: 'timestamp' }).notNull(),
  totalAmount: real('total_amount').notNull(),
  status: text('status').default('PENDING').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
})

export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert
export type OrderStatus = 'PENDING' | 'CONFIRMED'

/**
 * 进货单明细表
 */
export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  subtotal: real('subtotal').notNull(),
})

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert

// ==================== 销售相关表 ====================

/**
 * 销售单表
 */
export const salesOrders = sqliteTable('sales_orders', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber: text('order_number').unique().notNull(),
  customerName: text('customer_name'),
  orderDate: integer('order_date', { mode: 'timestamp' }).notNull(),
  subtotal: real('subtotal').notNull(),
  discountAmount: real('discount_amount').default(0).notNull(),
  roundingAmount: real('rounding_amount').default(0).notNull(),
  totalAmount: real('total_amount').notNull(),
  status: text('status').default('PENDING').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
})

export type SalesOrder = typeof salesOrders.$inferSelect
export type NewSalesOrder = typeof salesOrders.$inferInsert

/**
 * 销售单明细表
 */
export const salesOrderItems = sqliteTable('sales_order_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  salesOrderId: text('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  originalPrice: real('original_price').notNull(),
  subtotal: real('subtotal').notNull(),
})

export type SalesOrderItem = typeof salesOrderItems.$inferSelect
export type NewSalesOrderItem = typeof salesOrderItems.$inferInsert

// ==================== 退货相关表 ====================

/**
 * 退货单表
 * orderType: 'PURCHASE' | 'SALE'
 */
export const returnOrders = sqliteTable('return_orders', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber: text('order_number').unique().notNull(),
  originalOrderId: text('original_order_id').notNull(),
  orderType: text('order_type').notNull(),
  returnDate: integer('return_date', { mode: 'timestamp' }).notNull(),
  totalAmount: real('total_amount').notNull(),
  status: text('status').default('PENDING').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
})

export type ReturnOrder = typeof returnOrders.$inferSelect
export type NewReturnOrder = typeof returnOrders.$inferInsert
export type ReturnOrderType = 'PURCHASE' | 'SALE'

/**
 * 退货单明细表
 */
export const returnOrderItems = sqliteTable('return_order_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  returnOrderId: text('return_order_id').notNull().references(() => returnOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  subtotal: real('subtotal').notNull(),
})

export type ReturnOrderItem = typeof returnOrderItems.$inferSelect
export type NewReturnOrderItem = typeof returnOrderItems.$inferInsert

// ==================== 盘点相关表 ====================

/**
 * 盘点记录表
 * status: 'IN_PROGRESS' | 'COMPLETED'
 */
export const stockTakings = sqliteTable('stock_takings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  takingDate: integer('taking_date', { mode: 'timestamp' }).notNull(),
  status: text('status').default('IN_PROGRESS').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
})

export type StockTaking = typeof stockTakings.$inferSelect
export type NewStockTaking = typeof stockTakings.$inferInsert
export type StockTakingStatus = 'IN_PROGRESS' | 'COMPLETED'

/**
 * 盘点明细表
 */
export const stockTakingItems = sqliteTable('stock_taking_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  stockTakingId: text('stock_taking_id').notNull().references(() => stockTakings.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  systemQuantity: real('system_quantity').notNull(),
  actualQuantity: real('actual_quantity').notNull(),
  difference: real('difference').notNull(),
  unit: text('unit').notNull(),
})

export type StockTakingItem = typeof stockTakingItems.$inferSelect
export type NewStockTakingItem = typeof stockTakingItems.$inferInsert

/**
 * 盘点记录（含明细）复合类型
 */
export interface StockTakingWithItems extends StockTaking {
  items: StockTakingItem[]
}
