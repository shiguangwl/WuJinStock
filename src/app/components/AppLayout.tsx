'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(256)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarWidth(0)
      } else {
        const sidebar = document.querySelector('aside')
        if (sidebar) {
          setSidebarWidth(sidebar.offsetWidth)
        }
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    const observer = new MutationObserver(handleResize)
    const sidebar = document.querySelector('aside')
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] })
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Sidebar />
      <main
        className="transition-all duration-300 min-h-screen"
        style={{ marginLeft: sidebarWidth > 0 ? sidebarWidth : 0 }}
      >
        <div className="p-4 md:p-6 lg:p-8 pt-16 md:pt-6">
          {children}
        </div>
      </main>
    </div>
  )
}
