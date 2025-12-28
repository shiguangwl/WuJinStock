import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  trend?: {
    value: string
    isPositive: boolean
  }
  className?: string
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    lightBg: 'bg-blue-50',
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    lightBg: 'bg-green-50',
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    lightBg: 'bg-yellow-50',
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    lightBg: 'bg-red-50',
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-purple-600',
    lightBg: 'bg-purple-50',
  },
}

/**
 * 统计卡片组件
 * 用于展示关键数据指标
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  trend,
  className = '',
}: StatCardProps) {
  const colors = colorClasses[color]

  return (
    <Card className={`shadow-sm border-slate-200 ${className}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mb-2">{value}</p>
            {trend && (
              <p className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl ${colors.lightBg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={24} className={colors.text} strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

