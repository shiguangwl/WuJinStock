'use client'

/**
 * 商品详情/编辑页面
 * 需求: 1.3 - 允许修改已存在商品的信息
 * 需求: 1.6 - 允许为商品配置多个包装单位
 * 需求: 1.8 - 允许为商品设置存放位置信息
 */
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  getProductAction,
  updateProductAction,
  addPackageUnitAction,
  removePackageUnitAction,
} from '@/server/actions/product-actions'
import type { ProductWithRelations } from '@/server/services/product-service'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ProductDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    specification: '',
    baseUnit: '',
    purchasePrice: '',
    retailPrice: '',
    supplier: '',
    minStockThreshold: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 包装单位弹窗
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false)
  const [unitForm, setUnitForm] = useState({
    name: '',
    conversionRate: '',
    purchasePrice: '',
    retailPrice: '',
  })
  const [unitErrors, setUnitErrors] = useState<Record<string, string>>({})
  const [addingUnit, setAddingUnit] = useState(false)

  const loadProduct = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getProductAction(id)
      if (result.success && result.data) {
        setProduct(result.data)
        setFormData({
          name: result.data.name,
          specification: result.data.specification || '',
          baseUnit: result.data.baseUnit,
          purchasePrice: result.data.purchasePrice.toString(),
          retailPrice: result.data.retailPrice.toString(),
          supplier: result.data.supplier || '',
          minStockThreshold: result.data.minStockThreshold?.toString() || '',
        })
      } else {
        toast.error('加载失败', {
          description: !result.success ? result.error : '商品不存在',
        })
        router.push('/products')
      }
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = '商品名称不能为空'
    }
    if (!formData.baseUnit.trim()) {
      newErrors.baseUnit = '基本单位不能为空'
    }
    if (!formData.retailPrice.trim()) {
      newErrors.retailPrice = '零售价不能为空'
    } else if (isNaN(Number(formData.retailPrice)) || Number(formData.retailPrice) < 0) {
      newErrors.retailPrice = '请输入有效的零售价'
    }
    if (formData.purchasePrice && (isNaN(Number(formData.purchasePrice)) || Number(formData.purchasePrice) < 0)) {
      newErrors.purchasePrice = '请输入有效的进货价'
    }
    if (formData.minStockThreshold && (isNaN(Number(formData.minStockThreshold)) || Number(formData.minStockThreshold) < 0)) {
      newErrors.minStockThreshold = '请输入有效的库存阈值'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    try {
      const result = await updateProductAction(id, {
        name: formData.name.trim(),
        specification: formData.specification.trim() || undefined,
        baseUnit: formData.baseUnit.trim(),
        purchasePrice: Number(formData.purchasePrice) || 0,
        retailPrice: Number(formData.retailPrice),
        supplier: formData.supplier.trim() || undefined,
        minStockThreshold: formData.minStockThreshold ? Number(formData.minStockThreshold) : undefined,
      })

      if (result.success) {
        toast.success('保存成功')
        loadProduct()
      } else {
        toast.error('保存失败', {
          description: result.error,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // 包装单位相关
  const validateUnitForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!unitForm.name.trim()) {
      newErrors.name = '单位名称不能为空'
    }
    if (!unitForm.conversionRate.trim()) {
      newErrors.conversionRate = '换算比例不能为空'
    } else if (isNaN(Number(unitForm.conversionRate)) || Number(unitForm.conversionRate) <= 0) {
      newErrors.conversionRate = '换算比例必须大于零'
    }
    if (unitForm.purchasePrice && (isNaN(Number(unitForm.purchasePrice)) || Number(unitForm.purchasePrice) < 0)) {
      newErrors.purchasePrice = '请输入有效的进货价'
    }
    if (unitForm.retailPrice && (isNaN(Number(unitForm.retailPrice)) || Number(unitForm.retailPrice) < 0)) {
      newErrors.retailPrice = '请输入有效的零售价'
    }

    setUnitErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddUnit = async () => {
    if (!validateUnitForm()) return

    setAddingUnit(true)
    try {
      const result = await addPackageUnitAction({
        productId: id,
        unitName: unitForm.name.trim(),
        conversionRate: Number(unitForm.conversionRate),
        purchasePrice: unitForm.purchasePrice ? Number(unitForm.purchasePrice) : undefined,
        retailPrice: unitForm.retailPrice ? Number(unitForm.retailPrice) : undefined,
      })

      if (result.success) {
        toast.success('添加成功')
        setIsUnitDialogOpen(false)
        setUnitForm({ name: '', conversionRate: '', purchasePrice: '', retailPrice: '' })
        loadProduct()
      } else {
        toast.error('添加失败', {
          description: result.error,
        })
      }
    } finally {
      setAddingUnit(false)
    }
  }

  const handleRemoveUnit = async (unitName: string) => {
    const result = await removePackageUnitAction(id, unitName)
    if (result.success) {
      toast.success('删除成功')
      loadProduct()
    } else {
      toast.error('删除失败', {
        description: result.error,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-3">
        <Spinner size="lg" />
        <p className="text-slate-600">加载中...</p>
      </div>
    )
  }

  if (!product) {
    return null
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" onClick={() => router.push('/products')} size="sm">
            ← 返回
          </Button>
          <Badge variant="secondary">
            {product.code}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
        <p className="text-slate-600 mt-1">编辑商品信息、包装单位和存放位置</p>
      </div>

      {/* 基本信息 */}
      <Card className="mb-6 shadow-sm border-0">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-800">基本信息</h2>
        </CardHeader>
        <Separator />
        <CardContent className="gap-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                商品名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="specification">规格型号</Label>
              <Input
                id="specification"
                value={formData.specification}
                onChange={(e) => updateField('specification', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUnit">
                基本单位 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="baseUnit"
                value={formData.baseUnit}
                onChange={(e) => updateField('baseUnit', e.target.value)}
                className={errors.baseUnit ? 'border-red-500' : ''}
              />
              {errors.baseUnit && <p className="text-sm text-red-500">{errors.baseUnit}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">供应商</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => updateField('supplier', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">进货价</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchasePrice}
                  onChange={(e) => updateField('purchasePrice', e.target.value)}
                  className={`pl-8 ${errors.purchasePrice ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.purchasePrice && <p className="text-sm text-red-500">{errors.purchasePrice}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="retailPrice">
                零售价 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <Input
                  id="retailPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.retailPrice}
                  onChange={(e) => updateField('retailPrice', e.target.value)}
                  className={`pl-8 ${errors.retailPrice ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.retailPrice && <p className="text-sm text-red-500">{errors.retailPrice}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStockThreshold">最低库存阈值</Label>
              <Input
                id="minStockThreshold"
                type="number"
                step="1"
                min="0"
                value={formData.minStockThreshold}
                onChange={(e) => updateField('minStockThreshold', e.target.value)}
                className={errors.minStockThreshold ? 'border-red-500' : ''}
              />
              {errors.minStockThreshold && <p className="text-sm text-red-500">{errors.minStockThreshold}</p>}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-md"
            >
              {saving ? '保存中...' : '保存修改'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 包装单位 */}
      <Card className="mb-6 shadow-sm border-0">
        <CardHeader className="flex flex-row justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">包装单位</h2>
          <Button
            size="sm"
            onClick={() => setIsUnitDialogOpen(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 shadow-md"
          >
            添加单位
          </Button>
        </CardHeader>
        <Separator />
        <CardContent>
          {product.packageUnits.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-slate-700">单位名称</TableHead>
                  <TableHead className="text-slate-700">换算比例</TableHead>
                  <TableHead className="text-slate-700">进货价</TableHead>
                  <TableHead className="text-slate-700">零售价</TableHead>
                  <TableHead className="text-slate-700">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.packageUnits.map((unit) => (
                  <TableRow key={unit.id} className="hover:bg-slate-50">
                    <TableCell>{unit.name}</TableCell>
                    <TableCell>
                      1{unit.name} = {unit.conversionRate}{product.baseUnit}
                    </TableCell>
                    <TableCell>
                      {unit.purchasePrice !== null ? `¥${unit.purchasePrice.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {unit.retailPrice !== null ? `¥${unit.retailPrice.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveUnit(unit.name)}
                      >
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-slate-400 text-center py-4">暂无包装单位</p>
          )}
        </CardContent>
      </Card>

      {/* 存放位置 */}
      <Card className="shadow-sm border-0">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-800">存放位置</h2>
        </CardHeader>
        <Separator />
        <CardContent>
          {product.storageLocations.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {product.storageLocations.map((sl) => (
                <Badge
                  key={sl.id}
                  variant={sl.isPrimary ? 'default' : 'secondary'}
                  className={sl.isPrimary ? 'bg-blue-100 text-blue-700' : ''}
                >
                  {sl.location?.name ?? '未知位置'}
                  {sl.note && ` (${sl.note})`}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">暂无存放位置信息</p>
          )}
        </CardContent>
      </Card>

      {/* 添加包装单位弹窗 */}
      <Dialog open={isUnitDialogOpen} onOpenChange={setIsUnitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加包装单位</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">
                单位名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unit-name"
                placeholder="如：箱、盒、包"
                value={unitForm.name}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, name: e.target.value }))}
                className={unitErrors.name ? 'border-red-500' : ''}
              />
              {unitErrors.name && <p className="text-sm text-red-500">{unitErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-conversion">
                换算比例 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unit-conversion"
                placeholder={`1单位 = ?${product.baseUnit}`}
                type="number"
                step="0.01"
                min="0.01"
                value={unitForm.conversionRate}
                onChange={(e) => setUnitForm((prev) => ({ ...prev, conversionRate: e.target.value }))}
                className={unitErrors.conversionRate ? 'border-red-500' : ''}
              />
              {unitErrors.conversionRate && <p className="text-sm text-red-500">{unitErrors.conversionRate}</p>}
              <p className="text-sm text-slate-500">1个新单位等于多少{product.baseUnit}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-purchase-price">进货价（可选）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <Input
                  id="unit-purchase-price"
                  placeholder="留空则按基础价格计算"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitForm.purchasePrice}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                  className={`pl-8 ${unitErrors.purchasePrice ? 'border-red-500' : ''}`}
                />
              </div>
              {unitErrors.purchasePrice && <p className="text-sm text-red-500">{unitErrors.purchasePrice}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-retail-price">零售价（可选）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <Input
                  id="unit-retail-price"
                  placeholder="留空则按基础价格计算"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitForm.retailPrice}
                  onChange={(e) => setUnitForm((prev) => ({ ...prev, retailPrice: e.target.value }))}
                  className={`pl-8 ${unitErrors.retailPrice ? 'border-red-500' : ''}`}
                />
              </div>
              {unitErrors.retailPrice && <p className="text-sm text-red-500">{unitErrors.retailPrice}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUnitDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddUnit} disabled={addingUnit}>
              {addingUnit ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
