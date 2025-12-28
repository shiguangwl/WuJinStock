import type { Metadata } from 'next'
import Providers from './components/Providers'
import AppLayout from './components/AppLayout'
import './globals.css'

export const metadata: Metadata = {
  title: '五金店管理系统',
  description: '五金店库存、进货、销售管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  )
}
