import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PageHeaderProps {
  title: string
  description?: string
  icon?: ReactNode
  showBack?: boolean
  backUrl?: string
  actions?: ReactNode
  className?: string
}

/**
 * 统一的页面头部组件
 * 提供标题、描述、返回按钮和操作区域
 */
export default function PageHeader({
  title,
  description,
  icon,
  showBack = false,
  backUrl,
  actions,
  className = '',
}: PageHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl)
    } else {
      router.back()
    }
  }

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl px-6 py-5 mb-6 border border-blue-100/50 shadow-sm ${className}`}>
      {showBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mb-4 text-slate-600 hover:text-slate-900 -ml-2"
        >
          <ArrowLeft size={16} />
          返回
        </Button>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {icon && (
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

