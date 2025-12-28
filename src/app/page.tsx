'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Link from 'next/link'
import {
  ShoppingCart,
  Truck,
  Package,
  ClipboardList,
  BarChart3,
  TrendingUp,
  PackageOpen,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface QuickAction {
  href: string
  icon: LucideIcon
  title: string
  desc: string
  bgColor: string
}

interface Module {
  href: string
  icon: LucideIcon
  label: string
  color: string
}

const quickActions: QuickAction[] = [
  {
    href: '/sales/new',
    icon: ShoppingCart,
    title: '快速开单',
    desc: '新建销售单',
    bgColor: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  },
  {
    href: '/purchase/new',
    icon: Truck,
    title: '进货入库',
    desc: '新建进货单',
    bgColor: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  },
  {
    href: '/products/new',
    icon: Package,
    title: '添加商品',
    desc: '新建商品',
    bgColor: 'bg-gradient-to-br from-violet-500 to-purple-600',
  },
  {
    href: '/stock-taking/new',
    icon: ClipboardList,
    title: '库存盘点',
    desc: '新建盘点',
    bgColor: 'bg-gradient-to-br from-amber-500 to-orange-600',
  },
]

const modules: Module[] = [
  { href: '/products', icon: Package, label: '商品管理', color: 'text-violet-600' },
  { href: '/inventory', icon: BarChart3, label: '库存管理', color: 'text-blue-600' },
  { href: '/purchase', icon: Truck, label: '进货管理', color: 'text-indigo-600' },
  { href: '/sales', icon: ShoppingCart, label: '销售管理', color: 'text-emerald-600' },
  { href: '/stock-taking', icon: ClipboardList, label: '盘点管理', color: 'text-amber-600' },
  { href: '/statistics', icon: TrendingUp, label: '统计报表', color: 'text-rose-600' },
]

export default function Home() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 欢迎区域 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">欢迎使用五金店管理系统</h1>
        <p className="text-slate-300 text-lg">库存、进货、销售一站式管理</p>
      </div>

      {/* 快捷操作 */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">快捷操作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const ActionIcon = action.icon
            return (
              <Link key={action.href} href={action.href}>
                <Card
                  className={`h-full ${action.bgColor} text-white shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-200 border-0 cursor-pointer`}
                >
                  <CardContent className="text-center p-6">
                    <div className="flex items-center justify-center mb-3">
                      <ActionIcon size={48} strokeWidth={1.5} className="drop-shadow-md" />
                    </div>
                    <h3 className="font-bold text-lg">{action.title}</h3>
                    <p className="text-sm text-white/80 mt-1">{action.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 功能模块 */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-2 pt-6 px-6">
          <h2 className="text-xl font-semibold text-slate-800">功能模块</h2>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {modules.map((module) => {
              const ModuleIcon = module.icon
              return (
                <Link
                  key={module.href}
                  href={module.href}
                  className="flex flex-col items-center p-5 rounded-xl bg-slate-50 hover:bg-slate-100 hover:shadow-md transition-all duration-200 group"
                >
                  <ModuleIcon size={40} className={`mb-3 group-hover:scale-110 transition-transform ${module.color}`} strokeWidth={1.5} />
                  <span className={`text-sm font-semibold ${module.color}`}>{module.label}</span>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
