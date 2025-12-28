import { relations } from 'drizzle-orm'
import { 
  products, 
  packageUnits, 
  inventoryRecords, 
  storageLocations, 
  productStorageLocations,
  inventoryTransactions,
  purchaseOrders,
  purchaseOrderItems,
  salesOrders,
  salesOrderItems,
  returnOrders,
  returnOrderItems,
  stockTakings,
  stockTakingItems,
} from './schema'

export const productsRelations = relations(products, ({ many, one }) => ({
  packageUnits: many(packageUnits),
  inventoryRecord: one(inventoryRecords),
  storageLocations: many(productStorageLocations),
  inventoryTransactions: many(inventoryTransactions),
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

export const inventoryRecordsRelations = relations(inventoryRecords, ({ one }) => ({
  product: one(products, {
    fields: [inventoryRecords.productId],
    references: [products.id],
  }),
}))

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  product: one(products, {
    fields: [inventoryTransactions.productId],
    references: [products.id],
  }),
}))


// ==================== 进货订单关系 ====================

export const purchaseOrdersRelations = relations(purchaseOrders, ({ many }) => ({
  items: many(purchaseOrderItems),
}))

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}))

// ==================== 销售订单关系 ====================

export const salesOrdersRelations = relations(salesOrders, ({ many }) => ({
  items: many(salesOrderItems),
}))

export const salesOrderItemsRelations = relations(salesOrderItems, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesOrderItems.salesOrderId],
    references: [salesOrders.id],
  }),
}))

// ==================== 退货订单关系 ====================

export const returnOrdersRelations = relations(returnOrders, ({ many }) => ({
  items: many(returnOrderItems),
}))

export const returnOrderItemsRelations = relations(returnOrderItems, ({ one }) => ({
  returnOrder: one(returnOrders, {
    fields: [returnOrderItems.returnOrderId],
    references: [returnOrders.id],
  }),
}))

// ==================== 盘点关系 ====================

export const stockTakingsRelations = relations(stockTakings, ({ many }) => ({
  items: many(stockTakingItems),
}))

export const stockTakingItemsRelations = relations(stockTakingItems, ({ one }) => ({
  stockTaking: one(stockTakings, {
    fields: [stockTakingItems.stockTakingId],
    references: [stockTakings.id],
  }),
}))
