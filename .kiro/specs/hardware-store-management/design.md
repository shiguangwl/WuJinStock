# 设计文档 - 五金店管理系统

## 概述

五金店管理系统是一个桌面应用程序，旨在帮助五金店店主高效管理商品信息、库存、进货、销售等日常业务。系统采用模块化设计，确保各功能模块职责清晰、易于维护和扩展。

### 设计目标

- **易用性**: 界面简洁直观，操作流程符合五金店实际业务习惯
- **准确性**: 库存和账目数据准确可靠，支持多单位换算和小数精度
- **灵活性**: 支持抹零、改价、退货等实际业务场景
- **可维护性**: 模块化设计，代码结构清晰，便于后续功能扩展

## 架构

### 整体架构

系统采用 Next.js App Router 架构，前后端一体化：

```
┌─────────────────────────────────────────────────────────┐
│                    客户端层 (Client)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  商品管理页面  │  │  库存管理页面  │  │  销售管理页面  │  │
│  │  /products   │  │  /inventory  │  │  /sales      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│           ↓                ↓                  ↓          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         共享组件 (components/shared)                │ │
│  │  DataTable, ProductSelector, UnitConverter...      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Server Actions / API Routes                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ product-     │  │ inventory-   │  │ sales-       │  │
│  │ actions.ts   │  │ actions.ts   │  │ actions.ts   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                 业务逻辑层 (Services)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ ProductService│  │InventoryServ │  │ SalesService │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              数据访问层 (Drizzle ORM)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Product     │  │  Inventory   │  │  Order       │  │
│  │  Schema      │  │  Schema      │  │  Schema      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    数据库 (SQLite)                       │
└─────────────────────────────────────────────────────────┘
```

### 技术选型

采用最新的 Next.js 15 技术栈，提供高性能的 Web 应用：

**前端技术栈**:
- **框架**: Next.js 15+ (App Router + Turbopack)
- **语言**: TypeScript 5+
- **UI 组件**: HeroUI (原 NextUI)
- **样式**: Tailwind CSS + CSS Modules
- **表单处理**: React Hook Form + Zod
- **状态管理**: Zustand (客户端状态)

**后端技术栈**:
- **API**: Next.js Server Actions
- **数据库**: SQLite (生产/开发统一使用，适合单店桌面应用)
- **ORM**: Drizzle ORM
- **验证**: Zod
- **认证**: Auth.js (NextAuth.js v5)

**开发工具**:
- **包管理**: pnpm
- **构建工具**: Turbopack
- **代码规范**: ESLint + Prettier
- **测试**: Vitest (单元测试) + fast-check (属性测试)
- **E2E 测试**: Playwright

## 组件和接口

### 核心领域模型

#### 1. 商品 (Product)

```typescript
// src/server/db/schema.ts - Drizzle Schema (SQLite)
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

export const products = sqliteTable('products', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  specification: text('specification'),
  baseUnit: text('base_unit').notNull(),
  // 单价使用 real 类型，应用层处理精度
  purchasePrice: real('purchase_price').notNull(),
  retailPrice: real('retail_price').notNull(),
  supplier: text('supplier'),
  minStockThreshold: real('min_stock_threshold').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// TypeScript Type
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert

/**
 * 精度说明（应用层使用 Decimal.js 处理）：
 * - 单价字段: 4 位小数精度，支持极低单价如垫片 0.0050 元/个
 * - 数量字段: 3 位小数精度，支持连续计量如电线 1.255 米
 * - 金额字段: 2 位小数精度，最终金额保留 2 位小数
 */
```

#### 1.1 存放位置 (StorageLocation)

```typescript
// Drizzle Schema (SQLite) - 存放位置表
export const storageLocations = sqliteTable('storage_locations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').unique().notNull(), // 如：A区货架1层、仓库B柜
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// TypeScript Type
export type StorageLocation = typeof storageLocations.$inferSelect
export type NewStorageLocation = typeof storageLocations.$inferInsert
```

#### 1.2 商品存放位置关联 (ProductStorageLocation)

```typescript
// Drizzle Schema (SQLite) - 商品与存放位置的多对多关联
// 注意：此表仅记录商品存放在哪些位置，不记录具体数量
// 库存数量统一由 inventory_records 表管理（单一事实来源）
import { unique } from 'drizzle-orm/sqlite-core'

export const productStorageLocations = sqliteTable('product_storage_locations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  locationId: text('location_id').notNull().references(() => storageLocations.id, { onDelete: 'cascade' }),
  note: text('note'), // 备注，如"展示用"、"主要库存"
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false), // 是否为主要存放位置
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  uniqueProductLocation: unique().on(table.productId, table.locationId),
}))

// TypeScript Type
export type ProductStorageLocation = typeof productStorageLocations.$inferSelect
export type NewProductStorageLocation = typeof productStorageLocations.$inferInsert

/**
 * 设计说明：
 * - 此表仅记录"商品放在哪些位置"，不记录每个位置的具体数量
 * - 库存数量统一由 inventory_records 表管理，避免数据冗余
 * - 对于中小型五金店，只需知道"这东西放在哪"即可
 */
```

#### 2. 包装单位 (PackageUnit)

```typescript
// Drizzle Schema (SQLite)
import { unique } from 'drizzle-orm/sqlite-core'

export const packageUnits = sqliteTable('package_units', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // 换算率使用 real 类型，应用层处理精度（4位小数）
  conversionRate: real('conversion_rate').notNull(),
  // 包装单位特定价格（可选，用于批发/整件优惠）
  purchasePrice: real('purchase_price'), // 进货价（可选）
  retailPrice: real('retail_price'),     // 零售价（可选）
}, (table) => ({
  uniqueProductUnit: unique().on(table.productId, table.name),
}))

// TypeScript Type
export type PackageUnit = typeof packageUnits.$inferSelect
export type NewPackageUnit = typeof packageUnits.$inferInsert

/**
 * 价格计算逻辑：
 * 1. 优先使用包装单位的特定价格（如果设置了）
 * 2. 如果没有设置，则使用：基础单价 × 换算率
 * 
 * 示例：
 * - 螺丝基础价：0.5元/个
 * - 1盒 = 100个，盒装特价：40元（而非 50元）
 * - 销售1盒时，使用 40元，而非 0.5 × 100 = 50元
 */
```

#### 3. 库存记录 (InventoryRecord)

```typescript
// Drizzle Schema (SQLite)
export const inventoryRecords = sqliteTable('inventory_records', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').unique().notNull().references(() => products.id, { onDelete: 'cascade' }),
  // 数量使用 real 类型，应用层处理精度（3位小数）
  quantity: real('quantity').notNull(),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// TypeScript Type
export type InventoryRecord = typeof inventoryRecords.$inferSelect
export type NewInventoryRecord = typeof inventoryRecords.$inferInsert
```

#### 4. 库存变动记录 (InventoryTransaction)

```typescript
// Drizzle Schema (SQLite)
// SQLite 不支持 enum，使用 text 类型 + 应用层验证
// transactionType: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN'

export const inventoryTransactions = sqliteTable('inventory_transactions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  productId: text('product_id').notNull().references(() => products.id),
  transactionType: text('transaction_type').notNull(), // PURCHASE, SALE, ADJUSTMENT, RETURN
  // 数量变化使用 real 类型，应用层处理精度（3位小数）
  quantityChange: real('quantity_change').notNull(),
  unit: text('unit').notNull(),
  referenceId: text('reference_id'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  note: text('note'),
})

// TypeScript Type
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert
export type TransactionType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN'
```

#### 5. 进货单 (PurchaseOrder)

```typescript
// Drizzle Schema (SQLite)
// SQLite 不支持 enum，使用 text 类型 + 应用层验证
// orderStatus: 'PENDING' | 'CONFIRMED'

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber: text('order_number').unique().notNull(),
  supplier: text('supplier').notNull(),
  orderDate: integer('order_date', { mode: 'timestamp' }).notNull(),
  // 总金额使用 real 类型，应用层处理精度（2位小数）
  totalAmount: real('total_amount').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, CONFIRMED
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
})

// TypeScript Type
export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert
export type OrderStatus = 'PENDING' | 'CONFIRMED'
```

#### 6. 进货单明细 (PurchaseOrderItem)

```typescript
// Drizzle Schema (SQLite)
export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  // 数量使用 real 类型，应用层处理精度（3位小数）
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  // 单价使用 real 类型，应用层处理精度（4位小数）
  unitPrice: real('unit_price').notNull(),
  // 小计使用 real 类型，应用层处理精度（2位小数）
  subtotal: real('subtotal').notNull(),
})

// TypeScript Type
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert
```

#### 7. 销售单 (SalesOrder)

```typescript
// Drizzle Schema (SQLite)
export const salesOrders = sqliteTable('sales_orders', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber: text('order_number').unique().notNull(),
  customerName: text('customer_name'),
  orderDate: integer('order_date', { mode: 'timestamp' }).notNull(),
  // 金额字段使用 real 类型，应用层处理精度（2位小数）
  subtotal: real('subtotal').notNull(),
  discountAmount: real('discount_amount').default(0).notNull(),
  roundingAmount: real('rounding_amount').default(0).notNull(),
  totalAmount: real('total_amount').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, CONFIRMED
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
})

// TypeScript Type
export type SalesOrder = typeof salesOrders.$inferSelect
export type NewSalesOrder = typeof salesOrders.$inferInsert
```

#### 8. 销售单明细 (SalesOrderItem)

```typescript
// Drizzle Schema (SQLite)
export const salesOrderItems = sqliteTable('sales_order_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  salesOrderId: text('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  // 数量使用 real 类型，应用层处理精度（3位小数）
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  // 单价使用 real 类型，应用层处理精度（4位小数）
  unitPrice: real('unit_price').notNull(),
  originalPrice: real('original_price').notNull(),
  // 小计使用 real 类型，应用层处理精度（2位小数）
  subtotal: real('subtotal').notNull(),
})

// TypeScript Type
export type SalesOrderItem = typeof salesOrderItems.$inferSelect
export type NewSalesOrderItem = typeof salesOrderItems.$inferInsert
```

#### 9. 退货单 (ReturnOrder)

```typescript
// Drizzle Schema (SQLite)
// SQLite 不支持 enum，使用 text 类型 + 应用层验证
// returnOrderType: 'PURCHASE' | 'SALE'

export const returnOrders = sqliteTable('return_orders', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber: text('order_number').unique().notNull(),
  originalOrderId: text('original_order_id').notNull(),
  orderType: text('order_type').notNull(), // PURCHASE, SALE
  returnDate: integer('return_date', { mode: 'timestamp' }).notNull(),
  // 金额使用 real 类型，应用层处理精度（2位小数）
  totalAmount: real('total_amount').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, CONFIRMED
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
})

// TypeScript Type
export type ReturnOrder = typeof returnOrders.$inferSelect
export type NewReturnOrder = typeof returnOrders.$inferInsert
export type ReturnOrderType = 'PURCHASE' | 'SALE'
```

#### 10. 退货单明细 (ReturnOrderItem)

```typescript
// Drizzle Schema (SQLite)
export const returnOrderItems = sqliteTable('return_order_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  returnOrderId: text('return_order_id').notNull().references(() => returnOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  // 数量使用 real 类型，应用层处理精度（3位小数）
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  // 单价使用 real 类型，应用层处理精度（4位小数）
  unitPrice: real('unit_price').notNull(),
  // 小计使用 real 类型，应用层处理精度（2位小数）
  subtotal: real('subtotal').notNull(),
})

// TypeScript Type
export type ReturnOrderItem = typeof returnOrderItems.$inferSelect
export type NewReturnOrderItem = typeof returnOrderItems.$inferInsert
```

#### 11. 盘点记录 (StockTaking)

```typescript
// Drizzle Schema (SQLite)
// SQLite 不支持 enum，使用 text 类型 + 应用层验证
// stockTakingStatus: 'IN_PROGRESS' | 'COMPLETED'

export const stockTakings = sqliteTable('stock_takings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  takingDate: integer('taking_date', { mode: 'timestamp' }).notNull(),
  status: text('status').default('IN_PROGRESS').notNull(), // IN_PROGRESS, COMPLETED
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
})

// TypeScript Type
export type StockTaking = typeof stockTakings.$inferSelect
export type NewStockTaking = typeof stockTakings.$inferInsert
export type StockTakingStatus = 'IN_PROGRESS' | 'COMPLETED'
```

#### 12. 盘点明细 (StockTakingItem)

```typescript
// Drizzle Schema (SQLite)
export const stockTakingItems = sqliteTable('stock_taking_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  stockTakingId: text('stock_taking_id').notNull().references(() => stockTakings.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  // 数量使用 real 类型，应用层处理精度（3位小数）
  systemQuantity: real('system_quantity').notNull(),
  actualQuantity: real('actual_quantity').notNull(),
  difference: real('difference').notNull(),
  unit: text('unit').notNull(),
})

// TypeScript Type
export type StockTakingItem = typeof stockTakingItems.$inferSelect
export type NewStockTakingItem = typeof stockTakingItems.$inferInsert
```

### 服务层接口

#### 1. 商品服务 (ProductService)

```typescript
// src/server/services/product-service.ts
export class ProductService {
  /**
   * 创建商品
   */
  async createProduct(productData: CreateProductInput): Promise<Product>
  
  /**
   * 更新商品信息
   */
  async updateProduct(productId: string, productData: UpdateProductInput): Promise<Product>
  
  /**
   * 获取商品详情
   */
  async getProduct(productId: string): Promise<Product | null>
  
  /**
   * 搜索商品
   */
  async searchProducts(params: {
    keyword?: string
    location?: string
  }): Promise<Product[]>
  
  /**
   * 添加包装单位
   */
  async addPackageUnit(
    productId: string,
    unitName: string,
    conversionRate: Decimal
  ): Promise<void>
  
  /**
   * 删除包装单位
   */
  async removePackageUnit(productId: string, unitName: string): Promise<void>
  
  /**
   * 生成商品编码
   */
  generateProductCode(): string
}
```

#### 2. 库存服务 (InventoryService)

```typescript
// src/server/services/inventory-service.ts
export class InventoryService {
  /**
   * 获取商品库存
   */
  async getInventory(productId: string): Promise<InventoryRecord | null>
  
  /**
   * 获取低库存商品列表
   */
  async getLowStockProducts(): Promise<Array<{
    product: Product
    inventory: InventoryRecord
  }>>
  
  /**
   * 调整库存
   */
  async adjustInventory(params: {
    productId: string
    quantityChange: Decimal
    transactionType: TransactionType
    referenceId?: string
    note?: string
  }): Promise<void>
  
  /**
   * 获取库存变动历史
   */
  async getInventoryTransactions(params: {
    productId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<InventoryTransaction[]>
  
  /**
   * 将指定单位的数量转换为基本单位
   */
  async convertToBaseUnit(
    productId: string,
    quantity: Decimal,
    unit: string
  ): Promise<Decimal>
  
  /**
   * 检查库存是否充足
   */
  async checkStockAvailability(
    productId: string,
    quantity: Decimal,
    unit: string
  ): Promise<boolean>
}
```

#### 3. 进货服务 (PurchaseService)

```typescript
// src/server/services/purchase-service.ts
export class PurchaseService {
  /**
   * 创建进货单
   */
  async createPurchaseOrder(orderData: CreatePurchaseOrderInput): Promise<PurchaseOrder>
  
  /**
   * 确认进货单（入库）
   */
  async confirmPurchaseOrder(orderId: string): Promise<void>
  
  /**
   * 获取进货单详情
   */
  async getPurchaseOrder(orderId: string): Promise<PurchaseOrder | null>
  
  /**
   * 搜索进货记录
   */
  async searchPurchaseOrders(params: {
    supplier?: string
    startDate?: Date
    endDate?: Date
  }): Promise<PurchaseOrder[]>
  
  /**
   * 创建进货退货单
   */
  async createPurchaseReturn(
    originalOrderId: string,
    returnItems: ReturnItemInput[]
  ): Promise<ReturnOrder>
  
  /**
   * 确认进货退货
   */
  async confirmPurchaseReturn(returnId: string): Promise<void>
}
```

#### 4. 销售服务 (SalesService)

```typescript
// src/server/services/sales-service.ts
export class SalesService {
  /**
   * 创建销售单
   */
  async createSalesOrder(orderData: CreateSalesOrderInput): Promise<SalesOrder>
  
  /**
   * 添加商品到销售单
   */
  async addItemToOrder(orderId: string, itemData: AddOrderItemInput): Promise<void>
  
  /**
   * 应用折扣
   */
  async applyDiscount(
    orderId: string,
    discountType: 'percentage' | 'fixed',
    discountValue: Decimal
  ): Promise<void>
  
  /**
   * 应用抹零
   */
  async applyRounding(orderId: string, roundingAmount: Decimal): Promise<void>
  
  /**
   * 调整商品单价
   */
  async adjustItemPrice(
    orderId: string,
    itemIndex: number,
    newPrice: Decimal
  ): Promise<void>
  
  /**
   * 确认销售单
   */
  async confirmSalesOrder(orderId: string): Promise<void>
  
  /**
   * 获取销售单详情
   */
  async getSalesOrder(orderId: string): Promise<SalesOrder | null>
  
  /**
   * 搜索销售记录
   */
  async searchSalesOrders(params: {
    customerName?: string
    startDate?: Date
    endDate?: Date
  }): Promise<SalesOrder[]>
  
  /**
   * 创建销售退货单
   */
  async createSalesReturn(
    originalOrderId: string,
    returnItems: ReturnItemInput[]
  ): Promise<ReturnOrder>
  
  /**
   * 确认销售退货
   */
  async confirmSalesReturn(returnId: string): Promise<void>
}
```

#### 5. 盘点服务 (StockTakingService)

```typescript
// src/server/services/stock-taking-service.ts
export class StockTakingService {
  /**
   * 创建盘点记录
   */
  async createStockTaking(): Promise<StockTaking>
  
  /**
   * 记录实际盘点数量
   */
  async recordActualQuantity(
    takingId: string,
    productId: string,
    actualQuantity: Decimal
  ): Promise<void>
  
  /**
   * 完成盘点（更新库存）
   */
  async completeStockTaking(takingId: string): Promise<void>
  
  /**
   * 获取盘点记录
   */
  async getStockTaking(takingId: string): Promise<StockTaking | null>
}
```

#### 6. 统计服务 (StatisticsService)

```typescript
// src/server/services/statistics-service.ts
export class StatisticsService {
  /**
   * 获取销售汇总
   */
  async getSalesSummary(startDate: Date, endDate: Date): Promise<{
    totalSales: Decimal
    totalOrders: number
    totalQuantity: Decimal
  }>
  
  /**
   * 获取每日销售统计
   */
  async getDailySales(startDate: Date, endDate: Date): Promise<Array<{
    date: Date
    sales: Decimal
    orders: number
  }>>
  
  /**
   * 获取销售排行
   */
  async getTopSellingProducts(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{
    product: Product
    quantity: Decimal
    sales: Decimal
  }>>
  
  /**
   * 计算毛利润
   */
  async calculateGrossProfit(startDate: Date, endDate: Date): Promise<Decimal>
}
```

### 数据访问层

使用 Drizzle ORM 进行数据访问，提供类型安全的数据库操作：

```typescript
// src/server/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('./data/hardware-store.db')
export const db = drizzle(sqlite, { schema })

// 导出 schema 供其他模块使用
export * from './schema'
```

**使用示例**：

```typescript
import { db, products, packageUnits, purchaseOrders, purchaseOrderItems } from '@/server/db'
import { eq } from 'drizzle-orm'

// 查询商品（带包装单位和存放位置）
const product = await db.query.products.findFirst({
  where: eq(products.id, productId),
  with: {
    packageUnits: true,
    storageLocations: {
      with: {
        location: true
      }
    }
  }
})

// 创建进货单（使用事务）
const newOrder = db.transaction((tx) => {
  const order = tx.insert(purchaseOrders).values({
    orderNumber: generateOrderNumber(),
    supplier: 'XX供应商',
    orderDate: new Date(),
    totalAmount: '50.00',
    status: 'PENDING'
  }).returning().get()
  
  tx.insert(purchaseOrderItems).values({
    purchaseOrderId: order.id,
    productId: 'xxx',
    productName: '螺丝',
    quantity: '100',
    unit: '个',
    unitPrice: '0.5000',
    subtotal: '50.00'
  }).run()
  
  return order
})
```

**关系定义**：

```typescript
// src/server/db/relations.ts
import { relations } from 'drizzle-orm'
import { 
  products, packageUnits, inventoryRecords, 
  storageLocations, productStorageLocations,
  purchaseOrders, purchaseOrderItems, 
  salesOrders, salesOrderItems, 
  returnOrders, returnOrderItems, 
  stockTakings, stockTakingItems 
} from './schema'

export const productsRelations = relations(products, ({ many, one }) => ({
  packageUnits: many(packageUnits),
  inventoryRecord: one(inventoryRecords),
  storageLocations: many(productStorageLocations),
}))

export const packageUnitsRelations = relations(packageUnits, ({ one }) => ({
  product: one(products, {
    fields: [packageUnits.productId],
    references: [products.id],
  }),
}))

export const storageLocationsRelations = relations(storageLocations, ({ many }) => ({
  products: many(productStorageLocations),
}))

export const productStorageLocationsRelations = relations(productStorageLocations, ({ one }) => ({
  product: one(products, {
    fields: [productStorageLocations.productId],
    references: [products.id],
  }),
  location: one(storageLocations, {
    fields: [productStorageLocations.locationId],
    references: [storageLocations.id],
  }),
}))

export const purchaseOrdersRelations = relations(purchaseOrders, ({ many }) => ({
  items: many(purchaseOrderItems),
}))

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}))

export const salesOrdersRelations = relations(salesOrders, ({ many }) => ({
  items: many(salesOrderItems),
}))

export const salesOrderItemsRelations = relations(salesOrderItems, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesOrderItems.salesOrderId],
    references: [salesOrders.id],
  }),
}))

export const returnOrdersRelations = relations(returnOrders, ({ many }) => ({
  items: many(returnOrderItems),
}))

export const returnOrderItemsRelations = relations(returnOrderItems, ({ one }) => ({
  returnOrder: one(returnOrders, {
    fields: [returnOrderItems.returnOrderId],
    references: [returnOrders.id],
  }),
}))

export const stockTakingsRelations = relations(stockTakings, ({ many }) => ({
  items: many(stockTakingItems),
}))

export const stockTakingItemsRelations = relations(stockTakingItems, ({ one }) => ({
  stockTaking: one(stockTakings, {
    fields: [stockTakingItems.stockTakingId],
    references: [stockTakings.id],
  }),
}))
```

## 数据模型

### 数据存储结构

系统使用 SQLite 数据库存储数据，适合单店桌面应用场景。SQLite 具有以下优势：
- **零配置**: 无需安装数据库服务器
- **单文件**: 数据存储在单个文件中，便于备份和迁移
- **高性能**: 对于单用户/少量并发场景性能优异
- **可靠性**: 支持 ACID 事务，数据安全可靠

Drizzle ORM 管理数据库架构和迁移。

**Drizzle 配置文件结构**：

```
src/server/db/
├── index.ts              # 数据库客户端实例
├── schema.ts             # Drizzle Schema 定义
├── relations.ts          # 表关系定义
└── migrations/           # 数据库迁移历史
    ├── 0000_init.sql
    └── ...

drizzle.config.ts         # Drizzle 配置文件
data/
└── hardware-store.db     # SQLite 数据库文件
```

**drizzle.config.ts**：

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/hardware-store.db',
  },
})
```

**数据库客户端**：

```typescript
// src/server/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('./data/hardware-store.db')
export const db = drizzle(sqlite, { schema })

// 导出 schema 供其他模块使用
export * from './schema'
```

### 数据完整性保证

1. **事务支持**: Drizzle 提供事务 API，确保多表操作的原子性
2. **外键约束**: 数据库层面的外键约束保证引用完整性
3. **级联删除**: 配置适当的级联规则（如删除商品时删除包装单位）
4. **唯一约束**: 商品编码、订单号等字段的唯一性由数据库保证
5. **类型安全**: TypeScript + Drizzle 提供编译时类型检查

**事务示例**：

```typescript
import { db, salesOrders, inventoryRecords, inventoryTransactions } from '@/server/db'
import { eq, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'

// 确认销售单（事务操作）
// 注意：better-sqlite3 的事务是同步的
db.transaction((tx) => {
  // 1. 更新订单状态
  tx.update(salesOrders)
    .set({
      status: 'CONFIRMED',
      confirmedAt: new Date()
    })
    .where(eq(salesOrders.id, orderId))
    .run()
  
  // 2. 减少库存
  for (const item of order.items) {
    const baseQuantity = convertToBaseUnit(
      item.productId,
      new Decimal(item.quantity),
      item.unit
    )
    
    const currentInventory = tx.query.inventoryRecords.findFirst({
      where: eq(inventoryRecords.productId, item.productId)
    })
    
    const newQuantity = new Decimal(currentInventory!.quantity).sub(baseQuantity)
    
    tx.update(inventoryRecords)
      .set({
        quantity: newQuantity.toNumber(),
        lastUpdated: new Date()
      })
      .where(eq(inventoryRecords.productId, item.productId))
      .run()
    
    // 3. 记录库存变动
    tx.insert(inventoryTransactions).values({
      productId: item.productId,
      transactionType: 'SALE',
      quantityChange: baseQuantity.neg().toNumber(),
      unit: item.unit,
      referenceId: orderId
    }).run()
  }
})
```

### 单位换算逻辑

所有库存操作统一使用基本单位进行计算：

```typescript
/**
 * 将指定单位转换为基本单位
 */
async function convertToBaseUnit(
  product: Product,
  quantity: Decimal,
  unit: string
): Promise<Decimal> {
  if (unit === product.baseUnit) {
    return quantity
  }
  
  // 查找包装单位
  const packageUnit = product.packageUnits.find(u => u.name === unit)
  if (!packageUnit) {
    throw new Error(`未知单位: ${unit}`)
  }
  
  return quantity.mul(packageUnit.conversionRate)
}

/**
 * 将基本单位转换为指定单位
 */
async function convertFromBaseUnit(
  product: Product,
  baseQuantity: Decimal,
  targetUnit: string
): Promise<Decimal> {
  if (targetUnit === product.baseUnit) {
    return baseQuantity
  }
  
  const packageUnit = product.packageUnits.find(u => u.name === targetUnit)
  if (!packageUnit) {
    throw new Error(`未知单位: ${targetUnit}`)
  }
  
  return baseQuantity.div(packageUnit.conversionRate)
}
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性反思

在编写正确性属性之前，我需要识别并消除冗余的属性：

**识别的冗余**：
1. 需求 1.1.7 和 1.1.8 都是关于小数支持，可以合并为一个属性
2. 需求 4.4 和 4.5 是同一规则的不同表述，合并为一个属性
3. 多个关于"创建后能查询"的规则（如 3.1, 3.6, 4.1, 5.1, 5.2）可以合并为通用的持久化属性
4. 进货退货和销售退货的逻辑非常相似，可以用统一的退货属性表达
5. 单位换算在多处出现（1.1.4, 3.4, 4.10），可以提取为核心换算属性

**保留的核心属性**：
- 商品唯一性（1.5）
- 输入验证属性（必填字段、数值范围等）
- 单位换算正确性（核心不变量）
- 库存变动正确性（进货增加、销售减少、退货逆向）
- 数据持久化往返属性（6.1, 6.2）
- 业务规则验证（库存充足性、退货数量限制等）
- 计算正确性（金额、折扣、抹零等）

### 核心正确性属性

#### 属性 1: 商品编码唯一性
*对于任意*两个不同的商品，它们的商品编码必须不同。
**验证需求: 1.5**

#### 属性 2: 必填字段验证
*对于任意*缺少必填字段（商品名称、基本单位或零售价）的商品数据，系统应该拒绝创建并返回错误。
**验证需求: 1.2**

#### 属性 3: 换算比例有效性
*对于任意*包装单位，其换算比例必须大于零。
**验证需求: 1.7**

#### 属性 4: 单位换算一致性
*对于任意*商品、数量和单位，将数量从该单位换算为基本单位，再换算回原单位，应该得到原始数量（在精度范围内）。
**验证需求: 1.1.4, 1.1.5**

#### 属性 5: 小数精度支持
*对于任意*带有小数的数量值（精度至少两位小数），系统应该正确保存和计算，不丢失精度。
**验证需求: 1.1.7, 1.1.8**

#### 属性 6: 库存预警触发
*对于任意*商品，当其库存数量低于设定的最低库存阈值时，系统应该将该商品标记为需要预警。
**验证需求: 2.3**

#### 属性 7: 盘点差异计算
*对于任意*盘点记录，盘点差异应该等于实际数量减去系统数量。
**验证需求: 2.6**

#### 属性 8: 盘点更新库存
*对于任意*盘点记录，确认盘点后，商品的库存数量应该等于盘点的实际数量。
**验证需求: 2.7**

#### 属性 9: 进货单金额计算
*对于任意*进货单，其总金额应该等于所有商品明细的小计之和。
**验证需求: 3.5**

#### 属性 10: 进货增加库存
*对于任意*进货单，确认进货后，每个商品的库存增加量（换算为基本单位）应该等于进货单中该商品的数量（换算为基本单位）。
**验证需求: 3.4**

#### 属性 11: 进货单验证
*对于任意*进货单，如果商品清单为空或任何商品数量小于等于零，系统应该拒绝创建。
**验证需求: 3.2**

#### 属性 12: 退货数量限制
*对于任意*退货单（进货退货或销售退货），每个商品的退货数量不应该超过原订单中该商品的数量。
**验证需求: 3.1.4, 4.1.4**

#### 属性 13: 进货退货减少库存
*对于任意*进货退货单，确认退货后，每个商品的库存减少量应该等于退货数量（换算为基本单位）。
**验证需求: 3.1.5**

#### 属性 14: 销售退货增加库存
*对于任意*销售退货单，确认退货后，每个商品的库存增加量应该等于退货数量（换算为基本单位）。
**验证需求: 4.1.5**

#### 属性 15: 库存充足性验证
*对于任意*销售单和商品，如果该商品的可用库存（换算为基本单位）小于销售数量（换算为基本单位），系统应该阻止添加该商品到销售单。
**验证需求: 4.4, 4.5**

#### 属性 16: 销售单自动填充价格
*对于任意*销售单，添加商品时，如果未指定单价，系统应该自动使用该商品的零售价。
**验证需求: 4.3**

#### 属性 17: 销售单金额计算
*对于任意*销售单，应收金额应该等于（所有商品小计之和 - 折扣金额 - 抹零金额）。
**验证需求: 4.6, 4.7, 4.8**

#### 属性 18: 销售减少库存
*对于任意*销售单，确认销售后，每个商品的库存减少量应该等于销售数量（换算为基本单位）。
**验证需求: 4.10**

#### 属性 19: 毛利润计算
*对于任意*时间段，毛利润应该等于该时间段内所有销售单的销售额减去对应商品的进货成本。
**验证需求: 5.6**

#### 属性 20: 数据持久化往返
*对于任意*实体（商品、订单、库存等），保存到存储后重新加载，应该得到等价的实体数据。
**验证需求: 6.1, 6.2, 6.4**

#### 属性 21: 包装单位使用保护
*对于任意*商品的包装单位，如果该单位已被任何历史订单使用，系统应该阻止删除该单位。
**验证需求: 1.1.6**

#### 属性 22: 库存变动记录完整性
*对于任意*库存变动操作（进货、销售、盘点、退货），系统应该创建对应的库存变动记录，记录类型、数量变化和关联单据。
**验证需求: 2.8**

#### 属性 23: 搜索结果相关性
*对于任意*商品搜索关键词，返回的所有商品的名称或规格应该包含该关键词（模糊匹配）。
**验证需求: 1.4**

#### 属性 24: 位置搜索准确性
*对于任意*存放位置搜索，返回的所有商品的存放位置应该匹配搜索条件。
**验证需求: 1.10**

#### 属性 25: 改价功能正确性
*对于任意*销售单中的商品，应用改价后，该商品的单价应该等于新设定的价格，且小计应该重新计算。
**验证需求: 4.9**

#### 属性 26: 无效输入错误处理
*对于任意*无效的输入数据（如负数数量、空字符串等），系统应该返回明确的错误信息而不是崩溃或接受无效数据。
**验证需求: 7.3**

## 错误处理

### 错误类型

系统定义以下错误类型：

```typescript
// src/lib/errors.ts

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} 不存在: ${id}`)
    this.name = 'NotFoundError'
  }
}

export class DataIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataIntegrityError'
  }
}
```

**错误用途**：
1. **ValidationError**: 数据验证失败（必填字段缺失、数值范围不合法、格式不正确）
2. **BusinessRuleError**: 业务规则违反（库存不足、退货数量超限、包装单位被使用无法删除）
3. **NotFoundError**: 资源不存在（商品不存在、订单不存在）
4. **DataIntegrityError**: 数据完整性错误（数据损坏、关联数据不一致）

### 错误处理策略

1. **输入验证**: 在数据进入系统前进行验证，快速失败
2. **业务规则检查**: 在执行业务操作前检查前置条件
3. **事务回滚**: 操作失败时回滚所有相关变更
4. **错误日志**: 记录所有错误信息用于调试
5. **用户友好提示**: 向用户显示清晰的错误信息和建议操作

### 关键操作的错误处理

#### 确认订单 (Server Action)

```typescript
// src/server/actions/sales-actions.ts
'use server'

import { db, salesOrders, salesOrderItems, products, packageUnits, inventoryRecords, inventoryTransactions } from '@/server/db'
import { eq } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { ValidationError, BusinessRuleError, NotFoundError } from '@/lib/errors'
import { convertToBaseUnit } from '@/server/services/inventory-service'

export async function confirmSalesOrder(orderId: string) {
  try {
    // 1. 验证订单存在
    const order = db.query.salesOrders.findFirst({
      where: eq(salesOrders.id, orderId),
      with: { items: true }
    })
    
    if (!order) {
      throw new NotFoundError('销售单', orderId)
    }
    
    // 2. 验证订单状态
    if (order.status !== 'PENDING') {
      throw new BusinessRuleError(
        `订单状态不允许确认: ${order.status}`,
        'INVALID_ORDER_STATUS'
      )
    }
    
    // 3. 检查库存
    for (const item of order.items) {
      const product = db.query.products.findFirst({
        where: eq(products.id, item.productId),
        with: { packageUnits: true }
      })
      
      if (!product) {
        throw new NotFoundError('商品', item.productId)
      }
      
      const baseQuantity = convertToBaseUnit(
        product,
        new Decimal(item.quantity),
        item.unit
      )
      
      const inventory = db.query.inventoryRecords.findFirst({
        where: eq(inventoryRecords.productId, item.productId)
      })
      
      if (!inventory || new Decimal(inventory.quantity).lt(baseQuantity)) {
        throw new BusinessRuleError(
          `商品库存不足: ${item.productName}`,
          'INSUFFICIENT_STOCK'
        )
      }
    }
    
    // 4. 执行事务（better-sqlite3 事务是同步的）
    db.transaction((tx) => {
      // 更新库存
      for (const item of order.items) {
        const product = tx.query.products.findFirst({
          where: eq(products.id, item.productId),
          with: { packageUnits: true }
        })
        
        const baseQuantity = convertToBaseUnit(
          product!,
          new Decimal(item.quantity),
          item.unit
        )
        
        const currentInventory = tx.query.inventoryRecords.findFirst({
          where: eq(inventoryRecords.productId, item.productId)
        })
        
        const newQuantity = new Decimal(currentInventory!.quantity).sub(baseQuantity)
        
        tx.update(inventoryRecords)
          .set({
            quantity: newQuantity.toNumber(),
            lastUpdated: new Date()
          })
          .where(eq(inventoryRecords.productId, item.productId))
          .run()
        
        tx.insert(inventoryTransactions).values({
          productId: item.productId,
          transactionType: 'SALE',
          quantityChange: baseQuantity.neg().toNumber(),
          unit: item.unit,
          referenceId: orderId
        }).run()
      }
      
      // 更新订单状态
      tx.update(salesOrders)
        .set({
          status: 'CONFIRMED',
          confirmedAt: new Date()
        })
        .where(eq(salesOrders.id, orderId))
        .run()
    })
    
    return { success: true }
    
  } catch (error) {
    console.error('确认订单失败:', error)
    
    if (error instanceof ValidationError ||
        error instanceof BusinessRuleError ||
        error instanceof NotFoundError) {
      return { success: false, error: error.message }
    }
    
    return { success: false, error: '系统错误，请稍后重试' }
  }
}
```

## 测试策略

### 测试方法

系统采用双重测试策略：

1. **单元测试**: 验证具体示例、边界情况和错误条件
2. **基于属性的测试**: 验证通用属性在所有输入下都成立

### 基于属性的测试配置

- **测试框架**: fast-check (TypeScript 的 PBT 库)
- **单元测试框架**: Vitest
- **每个属性测试的迭代次数**: 最少 100 次
- **测试标签格式**: `// Feature: hardware-store-management, Property {N}: {property_text}`

### 测试覆盖范围

#### 单元测试重点
- 具体业务场景示例
- 边界条件（如零库存、最大数量）
- 错误处理路径
- 组件集成点

#### 属性测试重点
- 数据不变量（如商品编码唯一性）
- 往返属性（如单位换算、数据持久化）
- 业务规则（如库存变动、金额计算）
- 输入验证（如必填字段、数值范围）

### 测试数据生成策略

使用 fast-check 的 arbitrary 生成器创建测试数据：

```typescript
import * as fc from 'fast-check'
import { Decimal } from 'decimal.js'

// 商品数据生成器
const productArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  specification: fc.option(fc.string({ maxLength: 100 })),
  baseUnit: fc.constantFrom('个', '米', '公斤', '升'),
  purchasePrice: fc.float({ min: 0.01, max: 10000 }).map(n => new Decimal(n.toFixed(2))),
  retailPrice: fc.float({ min: 0.01, max: 10000 }).map(n => new Decimal(n.toFixed(2))),
  supplier: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  storageLocation: fc.option(fc.string({ maxLength: 50 })),
  minStockThreshold: fc.float({ min: 0, max: 1000 }).map(n => new Decimal(n.toFixed(2)))
})

// 包装单位生成器
const packageUnitArbitrary = fc.record({
  name: fc.constantFrom('箱', '盒', '包', '捆'),
  conversionRate: fc.float({ min: 0.01, max: 1000 }).map(n => new Decimal(n.toFixed(2)))
})

// 数量生成器（支持小数）
const quantityArbitrary = fc.float({ min: 0.01, max: 10000 })
  .map(n => new Decimal(n.toFixed(2)))
```

### 示例属性测试

```typescript
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Decimal } from 'decimal.js'
import { convertToBaseUnit, convertFromBaseUnit } from '@/server/services/inventory-service'
import { createProduct, addPackageUnit } from '@/server/services/product-service'

describe('Property-Based Tests', () => {
  it('Property 4: 单位换算一致性', async () => {
    // Feature: hardware-store-management, Property 4: 单位换算一致性
    // 对于任意商品、数量和单位，换算为基本单位再换算回来应该得到原值
    
    await fc.assert(
      fc.asyncProperty(
        productArbitrary,
        quantityArbitrary,
        fc.constantFrom('个', '箱', '盒'),
        async (productData, quantity, unit) => {
          // 创建商品
          const product = await createProduct(productData)
          
          // 添加包装单位
          if (unit !== product.baseUnit) {
            await addPackageUnit(product.id, unit, new Decimal('10'))
          }
          
          // 换算为基本单位
          const baseQuantity = await convertToBaseUnit(product.id, quantity, unit)
          
          // 换算回原单位
          const convertedBack = await convertFromBaseUnit(product.id, baseQuantity, unit)
          
          // 验证往返一致性（允许小的浮点误差）
          expect(convertedBack.sub(quantity).abs().toNumber()).toBeLessThan(0.001)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 10: 进货增加库存', async () => {
    // Feature: hardware-store-management, Property 10: 进货增加库存
    // 对于任意进货单，确认后库存应该增加对应数量
    
    await fc.assert(
      fc.asyncProperty(
        productArbitrary,
        quantityArbitrary,
        fc.string({ minLength: 1, maxLength: 10 }),
        async (productData, purchaseQuantity, unit) => {
          // 创建商品
          const product = await createProduct(productData)
          
          // 记录初始库存
          const initialInventory = await getInventory(product.id)
          const initialQuantity = initialInventory?.quantity ?? new Decimal(0)
          
          // 创建并确认进货单
          const order = await createPurchaseOrder({
            supplier: 'Test Supplier',
            orderDate: new Date(),
            items: [{
              productId: product.id,
              quantity: purchaseQuantity,
              unit: unit,
              unitPrice: new Decimal('10.00')
            }]
          })
          
          await confirmPurchaseOrder(order.id)
          
          // 验证库存增加
          const finalInventory = await getInventory(product.id)
          const expectedIncrease = await convertToBaseUnit(
            product.id,
            purchaseQuantity,
            unit
          )
          
          expect(finalInventory!.quantity.toNumber()).toBeCloseTo(
            initialQuantity.add(expectedIncrease).toNumber(),
            2
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### 测试执行指南

1. **运行所有测试**: `pnpm test`
2. **运行属性测试**: `pnpm test --grep "Property"`
3. **运行单元测试**: `pnpm test --grep -v "Property"`
4. **生成覆盖率报告**: `pnpm test --coverage`
5. **E2E 测试**: `pnpm test:e2e`

### 持续集成

- 每次代码提交自动运行所有测试
- 属性测试失败时保存反例用于调试
- 维护测试覆盖率不低于 80%
- 使用 GitHub Actions 或类似 CI/CD 工具
