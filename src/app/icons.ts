import { 
  Home, 
  Package, 
  BarChart3, 
  Truck, 
  ShoppingCart, 
  ClipboardList, 
  TrendingUp,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  ArrowLeft,
  Filter,
  Download,
  Upload,
  Save,
  X,
  Check,
  AlertCircle,
  Info,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Settings,
  RefreshCw,
  FileText,
  DollarSign,
  Users,
  TrendingDown,
  Package2,
  Wrench,
} from 'lucide-react'

/**
 * 图标映射表
 * 统一管理系统中使用的所有图标
 */
export const icons = {
  // 导航图标
  nav: {
    home: Home,
    products: Package,
    inventory: BarChart3,
    purchase: Truck,
    sales: ShoppingCart,
    stockTaking: ClipboardList,
    statistics: TrendingUp,
  },

  // 操作图标
  action: {
    add: Plus,
    search: Search,
    edit: Edit,
    delete: Trash2,
    view: Eye,
    back: ArrowLeft,
    filter: Filter,
    download: Download,
    upload: Upload,
    save: Save,
    close: X,
    check: Check,
    refresh: RefreshCw,
  },

  // 状态图标
  status: {
    alert: AlertCircle,
    info: Info,
    success: Check,
    error: X,
  },

  // 界面元素
  ui: {
    calendar: Calendar,
    chevronDown: ChevronDown,
    chevronUp: ChevronUp,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    moreVertical: MoreVertical,
    settings: Settings,
  },

  // 业务图标
  business: {
    file: FileText,
    money: DollarSign,
    users: Users,
    trendUp: TrendingUp,
    trendDown: TrendingDown,
    package: Package2,
    wrench: Wrench,
  },
} as const

// 图标尺寸预设
export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
} as const

// 导出常用图标以便直接使用
export {
  Home,
  Package,
  BarChart3,
  Truck,
  ShoppingCart,
  ClipboardList,
  TrendingUp,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  ArrowLeft,
  Filter,
  Download,
  Upload,
  Save,
  X,
  Check,
  AlertCircle,
  Info,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Settings,
  RefreshCw,
  FileText,
  DollarSign,
  Users,
  TrendingDown,
  Package2,
  Wrench,
}

