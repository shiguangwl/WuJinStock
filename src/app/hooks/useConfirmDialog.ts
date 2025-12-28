'use client'

import { useState, useCallback } from 'react'
import type { ConfirmDialogVariant } from '../components/ConfirmDialog'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmDialogVariant
}

interface ConfirmDialogState extends ConfirmOptions {
  isOpen: boolean
  isLoading: boolean
  resolve: ((value: boolean) => void) | null
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    isLoading: false,
    title: '',
    message: '',
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        isLoading: false,
        ...options,
        resolve,
      })
    })
  }, [])

  const handleClose = useCallback(() => {
    if (state.resolve) {
      state.resolve(false)
    }
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [state.resolve])

  const handleConfirm = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))
    if (state.resolve) {
      state.resolve(true)
    }
    setState((prev) => ({ ...prev, isOpen: false, isLoading: false, resolve: null }))
  }, [state.resolve])

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }))
  }, [])

  return {
    confirm,
    dialogProps: {
      isOpen: state.isOpen,
      onClose: handleClose,
      onConfirm: handleConfirm,
      title: state.title,
      message: state.message,
      confirmText: state.confirmText,
      cancelText: state.cancelText,
      variant: state.variant,
      isLoading: state.isLoading,
    },
    setLoading,
  }
}

// 预设的确认对话框配置
export const confirmPresets = {
  delete: (itemName: string): ConfirmOptions => ({
    title: '确认删除',
    message: `确定要删除"${itemName}"吗？此操作无法撤销。`,
    confirmText: '删除',
    cancelText: '取消',
    variant: 'danger',
  }),

  confirmOrder: (orderNumber: string): ConfirmOptions => ({
    title: '确认订单',
    message: `确定要确认订单"${orderNumber}"吗？确认后将更新库存。`,
    confirmText: '确认',
    cancelText: '取消',
    variant: 'warning',
  }),

  cancelOrder: (orderNumber: string): ConfirmOptions => ({
    title: '取消订单',
    message: `确定要取消订单"${orderNumber}"吗？`,
    confirmText: '取消订单',
    cancelText: '返回',
    variant: 'danger',
  }),

  completeStockTaking: (): ConfirmOptions => ({
    title: '完成盘点',
    message: '确定要完成盘点吗？系统将根据盘点结果调整库存数量。',
    confirmText: '完成盘点',
    cancelText: '取消',
    variant: 'warning',
  }),

  unsavedChanges: (): ConfirmOptions => ({
    title: '未保存的更改',
    message: '您有未保存的更改，确定要离开吗？',
    confirmText: '离开',
    cancelText: '留下',
    variant: 'warning',
  }),
}
