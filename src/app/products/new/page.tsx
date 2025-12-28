'use client'

/**
 * 新增商品页面
 * 需求: 1.1 - 允许添加新商品
 * 需求: 1.2 - 验证必填字段
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { createProductAction } from '@/server/actions/product-actions'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const result = await createProductAction({
        name: formData.name.trim(),
        specification: formData.specification.trim() || undefined,
        baseUnit: formData.baseUnit.trim(),
        purchasePrice: Number(formData.purchasePrice) || 0,
        retailPrice: Number(formData.retailPrice),
        supplier: formData.supplier.trim() || undefined,
        minStockThreshold: formData.minStockThreshold ? Number(formData.minStockThreshold) : undefined,
      })

      if (result.success) {
        toast.success('创建成功', {
          description: `商品编码: ${result.data.code}`,
        })
        router.push(`/products/${result.data.id}`)
      } else {
        toast.error('创建失败', {
          description: result.error,
        })
      }
    } finally {
      setLoading(false)
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

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            ← 返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">新增商品</h1>
        <p className="text-slate-600 mt-1">填写商品基本信息</p>
      </div>

      <Card className="shadow-sm border-0">
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
                placeholder="请输入商品名称"
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
                placeholder="请输入规格型号"
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
                placeholder="如：个、米、盒"
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
                placeholder="请输入供应商名称"
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
                  placeholder="0.00"
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
                  placeholder="0.00"
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
                placeholder="低于此数量将预警"
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

          <Separator className="my-4" />

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-md"
            >
              {loading ? '创建中...' : '创建商品'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
