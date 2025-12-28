/**
 * 测试数据库辅助工具
 * 用于测试环境的数据库操作
 */
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '@/server/db/schema'
import * as relations from '@/server/db/relations'
import { sql } from 'drizzle-orm'

/**
 * 创建内存数据库用于测试
 */
export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  
  const db = drizzle(sqlite, { 
    schema: { ...schema, ...relations } 
  })
  
  return { db, sqlite }
}

/**
 * 初始化测试数据库表结构
 */
export function initTestDbSchema(sqlite: Database.Database) {
  // 创建所有表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specification TEXT,
      base_unit TEXT NOT NULL,
      purchase_price REAL NOT NULL,
      retail_price REAL NOT NULL,
      supplier TEXT,
      min_stock_threshold REAL DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS storage_locations (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS product_storage_locations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      location_id TEXT NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
      note TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at INTEGER,
      UNIQUE(product_id, location_id)
    );

    CREATE TABLE IF NOT EXISTS package_units (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      conversion_rate REAL NOT NULL,
      purchase_price REAL,
      retail_price REAL,
      UNIQUE(product_id, name)
    );

    CREATE TABLE IF NOT EXISTS inventory_records (
      id TEXT PRIMARY KEY,
      product_id TEXT UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      last_updated INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      transaction_type TEXT NOT NULL,
      quantity_change REAL NOT NULL,
      unit TEXT NOT NULL,
      reference_id TEXT,
      timestamp INTEGER NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      supplier TEXT NOT NULL,
      order_date INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      order_date INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0 NOT NULL,
      rounding_amount REAL DEFAULT 0 NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sales_order_items (
      id TEXT PRIMARY KEY,
      sales_order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      original_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS return_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      original_order_id TEXT NOT NULL,
      order_type TEXT NOT NULL,
      return_date INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS return_order_items (
      id TEXT PRIMARY KEY,
      return_order_id TEXT NOT NULL REFERENCES return_orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_takings (
      id TEXT PRIMARY KEY,
      taking_date INTEGER NOT NULL,
      status TEXT DEFAULT 'IN_PROGRESS' NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS stock_taking_items (
      id TEXT PRIMARY KEY,
      stock_taking_id TEXT NOT NULL REFERENCES stock_takings(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      system_quantity REAL NOT NULL,
      actual_quantity REAL NOT NULL,
      difference REAL NOT NULL,
      unit TEXT NOT NULL
    );
  `)
}

/**
 * 清空测试数据库所有数据
 */
export function clearTestDb(db: ReturnType<typeof drizzle>) {
  db.run(sql`DELETE FROM stock_taking_items`)
  db.run(sql`DELETE FROM stock_takings`)
  db.run(sql`DELETE FROM return_order_items`)
  db.run(sql`DELETE FROM return_orders`)
  db.run(sql`DELETE FROM sales_order_items`)
  db.run(sql`DELETE FROM sales_orders`)
  db.run(sql`DELETE FROM purchase_order_items`)
  db.run(sql`DELETE FROM purchase_orders`)
  db.run(sql`DELETE FROM inventory_transactions`)
  db.run(sql`DELETE FROM inventory_records`)
  db.run(sql`DELETE FROM package_units`)
  db.run(sql`DELETE FROM product_storage_locations`)
  db.run(sql`DELETE FROM storage_locations`)
  db.run(sql`DELETE FROM products`)
}
