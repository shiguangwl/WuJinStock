import { Spinner } from '@/components/ui/spinner'

interface LoadingStateProps {
  text?: string
  fullPage?: boolean
  className?: string
}

/**
 * 统一的加载状态组件
 */
export default function LoadingState({
  text = '加载中...',
  fullPage = false,
  className = '',
}: LoadingStateProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <Spinner size="lg" className="text-blue-500" />
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        {content}
      </div>
    )
  }

  return content
}

