'use client'

import { toast } from 'sonner'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  title: string
  description?: string
  duration?: number
}

export function useToast() {
  const showToast = (type: ToastType, options: ToastOptions) => {
    const { title, description, duration } = options

    switch (type) {
      case 'success':
        toast.success(title, { description, duration })
        break
      case 'error':
        toast.error(title, { description, duration })
        break
      case 'warning':
        toast.warning(title, { description, duration })
        break
      case 'info':
        toast.info(title, { description, duration })
        break
    }
  }

  return {
    success: (title: string, description?: string) =>
      showToast('success', { title, description }),
    error: (title: string, description?: string) =>
      showToast('error', { title, description }),
    warning: (title: string, description?: string) =>
      showToast('warning', { title, description }),
    info: (title: string, description?: string) =>
      showToast('info', { title, description }),
    show: showToast,
  }
}

// 预设的 Toast 消息
export const toastMessages = {
  // 通用操作
  saveSuccess: () => ({ title: '保存成功', description: '数据已保存' }),
  saveFailed: (error?: string) => ({ title: '保存失败', description: error || '请稍后重试' }),
  deleteSuccess: () => ({ title: '删除成功' }),
  deleteFailed: (error?: string) => ({ title: '删除失败', description: error || '请稍后重试' }),

  // 商品相关
  productCreated: (name: string) => ({ title: '商品已创建', description: `"${name}" 已添加到商品列表` }),
  productUpdated: (name: string) => ({ title: '商品已更新', description: `"${name}" 的信息已更新` }),
  productDeleted: (name: string) => ({ title: '商品已删除', description: `"${name}" 已从商品列表移除` }),

  // 订单相关
  orderCreated: (orderNumber: string) => ({ title: '订单已创建', description: `订单号: ${orderNumber}` }),
  orderConfirmed: (orderNumber: string) => ({ title: '订单已确认', description: `订单 ${orderNumber} 已确认，库存已更新` }),
  orderCancelled: (orderNumber: string) => ({ title: '订单已取消', description: `订单 ${orderNumber} 已取消` }),

  // 库存相关
  stockUpdated: () => ({ title: '库存已更新' }),
  stockTakingCompleted: () => ({ title: '盘点已完成', description: '库存数量已根据盘点结果调整' }),

  // 验证错误
  validationError: (message: string) => ({ title: '输入错误', description: message }),
  insufficientStock: (productName: string) => ({ title: '库存不足', description: `"${productName}" 库存不足` }),

  // 网络错误
  networkError: () => ({ title: '网络错误', description: '请检查网络连接后重试' }),
  serverError: () => ({ title: '服务器错误', description: '服务器暂时不可用，请稍后重试' }),
}
