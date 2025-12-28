'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { icons } from '@/app/icons'
import { Menu, X, ChevronLeft, ChevronRight, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/', label: '首页', icon: icons.nav.home },
  { href: '/products', label: '商品管理', icon: icons.nav.products },
  { href: '/inventory', label: '库存管理', icon: icons.nav.inventory },
  { href: '/purchase', label: '进货管理', icon: icons.nav.purchase },
  { href: '/sales', label: '销售管理', icon: icons.nav.sales },
  { href: '/stock-taking', label: '盘点管理', icon: icons.nav.stockTaking },
  { href: '/statistics', label: '统计报表', icon: icons.nav.statistics },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* 移动端菜单按钮 */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? '关闭菜单' : '打开菜单'}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </Button>

      {/* 移动端遮罩 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-gradient-to-b from-slate-900 to-slate-800
          shadow-xl transition-all duration-300 z-40
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo 区域 */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50">
          {!isCollapsed && (
            <h1 className="text-lg font-bold text-white truncate flex items-center gap-2">
              <Wrench size={24} className="text-blue-400" />
              五金店管理
            </h1>
          )}
          {isCollapsed && (
            <Wrench size={24} className="text-blue-400 mx-auto" />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:flex text-slate-400 hover:text-white"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>

        {/* 导航菜单 */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const IconComponent = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                  ${isActive(item.href)
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <IconComponent size={20} className="flex-shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* 底部信息 */}
        {!isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 text-center">
              五金店管理系统 v1.0
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
