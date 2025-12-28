import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import * as relations from './relations'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const DB_PATH = './data/hardware-store.db'

// 确保数据目录存在
const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(DB_PATH)

// 启用外键约束
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { 
  schema: { ...schema, ...relations } 
})

export * from './schema'
