'use server'

/**
 * 商品管理 Server Actions
 * 提供商品的增删改查操作
 */
import { z } from 'zod'
import { db } from '@/server/db'
import { ProductService, createProductService, ProductValidationError, ProductNotFoundError, PackageUnitValidationError, PackageUnitNotFoundError } from '@/server/services/product-service'
import { StorageLocationService, createStorageLocationService, StorageLocationValidationError, StorageLocationNotFoundError } from '@/server/services/storage-location-service'

// ==================== Zod 验证 Schema ====================

const createProductSchema = z.object({
  name: z.string().min(1, '商品名称不能为空'),
  specification: z.string().optional(),
  baseUnit: z.string().min(1, '基本单位不能为空'),
  purchasePrice: z.number().min(0, '进货价不能为负数'),
  retailPrice: z.number().min(0, '零售价不能为负数'),
  supplier: z.string().optional(),
  minStockThreshold: z.number().min(0, '最低库存阈值不能为负数').optional(),
})

const updateProductSchema = z.object({
  name: z.string().min(1, '商品名称不能为空').optional(),
  specification: z.string().optional(),
  baseUnit: z.string().min(1, '基本单位不能为空').optional(),
  purchasePrice: z.number().min(0, '进货价不能为负数').optional(),
  retailPrice: z.number().min(0, '零售价不能为负数').optional(),
  supplier: z.string().optional(),
  minStockThreshold: z.number().min(0, '最低库存阈值不能为负数').optional(),
})

const searchProductsSchema = z.object({
  keyword: z.string().optional(),
  location: z.string().optional(),
})

const addPackageUnitSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  unitName: z.string().min(1, '单位名称不能为空'),
  conversionRate: z.number().positive('换算比例必须大于零'),
  purchasePrice: z.number().min(0).optional(),
  retailPrice: z.number().min(0).optional(),
})

const linkProductLocationSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  locationId: z.string().min(1, '位置ID不能为空'),
  note: z.string().optional(),
  isPrimary: z.boolean().optional(),
})

// ==================== 类型定义 ====================

type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string }

// ==================== 辅助函数 ====================

function getZodErrorMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0]
  return firstIssue?.message ?? '验证失败'
}

// ==================== 服务实例 ====================

function getProductService(): ProductService {
  return createProductService(db)
}

function getStorageLocationService(): StorageLocationService {
  return createStorageLocationService(db)
}

// ==================== 商品 Actions ====================

/**
 * 创建商品
 * 需求: 1.1, 1.2
 */
export async function createProductAction(
  input: z.infer<typeof createProductSchema>
): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const validated = createProductSchema.parse(input)
    const service = getProductService()
    const product = service.createProduct(validated)
    
    return {
      success: true,
      data: { id: product.id, code: product.code },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof ProductValidationError) {
      return { success: false, error: error.message }
    }
    console.error('创建商品失败:', error)
    return { success: false, error: '创建商品失败' }
  }
}

/**
 * 更新商品
 * 需求: 1.3
 */
export async function updateProductAction(
  productId: string,
  input: z.infer<typeof updateProductSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = updateProductSchema.parse(input)
    const service = getProductService()
    const product = service.updateProduct(productId, validated)
    
    return {
      success: true,
      data: { id: product.id },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof ProductValidationError || error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('更新商品失败:', error)
    return { success: false, error: '更新商品失败' }
  }
}

/**
 * 获取商品详情
 * 需求: 1.4
 */
export async function getProductAction(productId: string): Promise<ActionResult<ReturnType<ProductService['getProduct']>>> {
  try {
    const service = getProductService()
    const product = service.getProduct(productId)
    
    if (!product) {
      return { success: false, error: '商品不存在' }
    }
    
    return { success: true, data: product }
  } catch (error) {
    console.error('获取商品失败:', error)
    return { success: false, error: '获取商品失败' }
  }
}

/**
 * 搜索商品
 * 需求: 1.4
 */
export async function searchProductsAction(
  params: z.infer<typeof searchProductsSchema> = {}
): Promise<ActionResult<ReturnType<ProductService['searchProducts']>>> {
  try {
    const validated = searchProductsSchema.parse(params)
    const service = getProductService()
    const products = service.searchProducts(validated)
    
    return { success: true, data: products }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    console.error('搜索商品失败:', error)
    return { success: false, error: '搜索商品失败' }
  }
}

/**
 * 删除商品
 */
export async function deleteProductAction(productId: string): Promise<ActionResult<void>> {
  try {
    const service = getProductService()
    service.deleteProduct(productId)
    
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('删除商品失败:', error)
    return { success: false, error: '删除商品失败' }
  }
}

// ==================== 包装单位 Actions ====================

/**
 * 添加包装单位
 * 需求: 1.6, 1.7
 */
export async function addPackageUnitAction(
  input: z.infer<typeof addPackageUnitSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = addPackageUnitSchema.parse(input)
    const service = getProductService()
    const unit = service.addPackageUnit(
      validated.productId,
      validated.unitName,
      validated.conversionRate,
      {
        purchasePrice: validated.purchasePrice,
        retailPrice: validated.retailPrice,
      }
    )
    
    return { success: true, data: { id: unit.id } }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof PackageUnitValidationError || error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('添加包装单位失败:', error)
    return { success: false, error: '添加包装单位失败' }
  }
}

/**
 * 删除包装单位
 */
export async function removePackageUnitAction(
  productId: string,
  unitName: string
): Promise<ActionResult<void>> {
  try {
    const service = getProductService()
    service.removePackageUnit(productId, unitName)
    
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof PackageUnitNotFoundError || error instanceof ProductNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('删除包装单位失败:', error)
    return { success: false, error: '删除包装单位失败' }
  }
}

/**
 * 获取商品的包装单位列表
 */
export async function getPackageUnitsAction(
  productId: string
): Promise<ActionResult<ReturnType<ProductService['getPackageUnits']>>> {
  try {
    const service = getProductService()
    const units = service.getPackageUnits(productId)
    
    return { success: true, data: units }
  } catch (error) {
    console.error('获取包装单位失败:', error)
    return { success: false, error: '获取包装单位失败' }
  }
}

// ==================== 存放位置关联 Actions ====================

/**
 * 将商品关联到存放位置
 * 需求: 1.8
 */
export async function linkProductToLocationAction(
  input: z.infer<typeof linkProductLocationSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = linkProductLocationSchema.parse(input)
    const service = getStorageLocationService()
    const link = service.linkProductToLocation(
      validated.productId,
      validated.locationId,
      {
        note: validated.note,
        isPrimary: validated.isPrimary,
      }
    )
    
    return { success: true, data: { id: link.id } }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: getZodErrorMessage(error) }
    }
    if (error instanceof StorageLocationValidationError || error instanceof StorageLocationNotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('关联商品位置失败:', error)
    return { success: false, error: '关联商品位置失败' }
  }
}

/**
 * 取消商品与位置的关联
 */
export async function unlinkProductFromLocationAction(
  productId: string,
  locationId: string
): Promise<ActionResult<void>> {
  try {
    const service = getStorageLocationService()
    service.unlinkProductFromLocation(productId, locationId)
    
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof StorageLocationValidationError) {
      return { success: false, error: error.message }
    }
    console.error('取消关联失败:', error)
    return { success: false, error: '取消关联失败' }
  }
}

/**
 * 获取商品的存放位置
 * 需求: 1.9
 */
export async function getProductLocationsAction(
  productId: string
): Promise<ActionResult<ReturnType<StorageLocationService['getProductLocations']>>> {
  try {
    const service = getStorageLocationService()
    const locations = service.getProductLocations(productId)
    
    return { success: true, data: locations }
  } catch (error) {
    console.error('获取商品位置失败:', error)
    return { success: false, error: '获取商品位置失败' }
  }
}
