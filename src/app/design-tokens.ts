/**
 * 设计系统 - Design Tokens
 * 统一管理色彩、间距、字体、圆角等设计变量
 */

export const designTokens = {
  // 色彩系统
  colors: {
    // 主色调 - 蓝色系
    primary: {
      50: 'rgb(239, 246, 255)',
      100: 'rgb(219, 234, 254)',
      200: 'rgb(191, 219, 254)',
      300: 'rgb(147, 197, 253)',
      400: 'rgb(96, 165, 250)',
      500: 'rgb(59, 130, 246)', // 主色
      600: 'rgb(37, 99, 235)',
      700: 'rgb(29, 78, 216)',
      800: 'rgb(30, 64, 175)',
      900: 'rgb(30, 58, 138)',
    },
    // 辅助色 - 绿色系（成功）
    success: {
      500: 'rgb(34, 197, 94)',
      600: 'rgb(22, 163, 74)',
    },
    // 警告色 - 黄色系
    warning: {
      500: 'rgb(234, 179, 8)',
      600: 'rgb(202, 138, 4)',
    },
    // 危险色 - 红色系
    danger: {
      500: 'rgb(239, 68, 68)',
      600: 'rgb(220, 38, 38)',
    },
    // 中性色
    neutral: {
      50: 'rgb(248, 250, 252)',
      100: 'rgb(241, 245, 249)',
      200: 'rgb(226, 232, 240)',
      300: 'rgb(203, 213, 225)',
      400: 'rgb(148, 163, 184)',
      500: 'rgb(100, 116, 139)',
      600: 'rgb(71, 85, 105)',
      700: 'rgb(51, 65, 85)',
      800: 'rgb(30, 41, 59)',
      900: 'rgb(15, 23, 42)',
    },
  },

  // 间距系统
  spacing: {
    xs: '0.5rem',    // 8px
    sm: '0.75rem',   // 12px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '2.5rem', // 40px
    '3xl': '3rem',   // 48px
  },

  // 圆角系统
  borderRadius: {
    sm: '0.375rem',  // 6px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
  },

  // 字体系统
  typography: {
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  // 阴影系统
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },

  // 过渡动画
  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const

// Tailwind 类名映射（方便使用）
export const tw = {
  // 主要按钮
  button: {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium transition-all',
    danger: 'bg-red-600 hover:bg-red-700 text-white font-medium shadow-md hover:shadow-lg transition-all',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 transition-all',
  },
  
  // 卡片
  card: {
    base: 'bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden',
    hover: 'bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow',
  },

  // 输入框
  input: {
    base: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all',
  },

  // 页面容器
  page: {
    container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6',
    header: 'mb-6',
  },

  // 表格
  table: {
    wrapper: 'border border-slate-200 rounded-xl overflow-hidden',
    header: 'bg-slate-50 border-b border-slate-200',
  },
} as const

