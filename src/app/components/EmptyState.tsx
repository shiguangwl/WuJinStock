import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { PackageOpen, Plus } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

/**
 * 统一的空状态组件
 * 用于表格、列表等无数据时的展示
 */
export default function EmptyState({
  icon,
  title = '暂无数据',
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <div className="text-slate-400">
          {icon || <PackageOpen size={40} strokeWidth={1.5} />}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-slate-600 text-center max-w-md mb-6">
          {description}
        </p>
      )}

      {action && (
        <Button
          onClick={action.onClick}
          className="font-medium shadow-md"
        >
          <Plus size={18} />
          {action.label}
        </Button>
      )}
    </div>
  )
}

