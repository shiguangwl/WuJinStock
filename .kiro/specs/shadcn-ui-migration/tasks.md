# Implementation Plan: shadcn/ui Migration

## Overview

将五金店管理系统从 HeroUI 迁移到 shadcn/ui，采用渐进式迁移策略：先配置基础设施，再迁移共享组件，然后逐页面迁移，最后清理旧依赖。

## Tasks

- [x] 1. 安装和配置 shadcn/ui 基础设施
  - [x] 1.1 初始化 shadcn/ui 配置
    - 运行 `npx shadcn@latest init` 初始化项目
    - 创建 `components.json` 配置文件
    - 创建 `src/lib/utils.ts` 包含 cn() 工具函数
    - 安装 `date-fns`: `pnpm add date-fns`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 添加所需的 shadcn/ui 组件
    - 运行 shadcn add 命令添加: button, input, card, table, dialog, alert-dialog, tabs, badge, select, command, popover, calendar, separator, sonner, label, sheet, dropdown-menu, form
    - _Requirements: 1.1_
  - [x] 1.3 创建自定义 Spinner 组件
    - 在 `src/components/ui/spinner.tsx` 创建基于 Loader2 的 Spinner 组件
    - _Requirements: 12.7_

- [x] 2. 迁移共享组件和 Hooks
  - [x] 2.1 迁移 Providers 组件
    - 移除 HeroUIProvider
    - 添加 Toaster 组件 (sonner)
    - _Requirements: 2.1, 10.3_
  - [x] 2.2 迁移 useToast hook
    - 使用 sonner 的 toast API 替换 HeroUI addToast
    - _Requirements: 2.10, 10.1, 10.2_
  - [x] 2.3 迁移 ConfirmDialog 组件
    - 使用 AlertDialog 替换 Modal
    - _Requirements: 2.5, 2.9_
  - [x] 2.4 迁移 useConfirmDialog hook
    - 适配 AlertDialog 组件的 API
    - _Requirements: 2.9_
  - [x] 2.5 迁移 PageHeader 组件
    - 使用 shadcn/ui Button 替换 HeroUI Button
    - _Requirements: 2.4_
  - [x] 2.6 迁移 EmptyState 组件
    - 使用 shadcn/ui Button 替换 HeroUI Button
    - _Requirements: 2.6_
  - [x] 2.7 迁移 LoadingState 组件
    - 使用自定义 Spinner 组件
    - _Requirements: 2.7_
  - [x] 2.8 迁移 StatCard 组件
    - 使用 shadcn/ui Card 替换 HeroUI Card
    - _Requirements: 2.8_
  - [x] 2.9 迁移 Sidebar 组件
    - 使用 shadcn/ui Button 替换 HeroUI Button
    - _Requirements: 2.2_
  - [x] 2.10 迁移 AppLayout 组件
    - 确保布局逻辑保持不变
    - _Requirements: 2.3_

- [x] 3. Checkpoint - 验证共享组件迁移
  - 运行 `pnpm tsc --noEmit` 确保无类型错误
  - 确保所有共享组件正确导出

- [x] 4. 迁移首页
  - [x] 4.1 迁移 src/app/page.tsx
    - 使用 shadcn/ui Card 组件
    - _Requirements: 3.1, 3.2_

- [x] 5. 迁移商品管理页面
  - [x] 5.1 迁移商品列表页 src/app/products/page.tsx
    - 使用 Table, Input, AlertDialog 组件
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 迁移商品详情页 src/app/products/[id]/page.tsx
    - 使用 Input, Select, Dialog, Table 组件
    - _Requirements: 4.4, 4.6_
  - [x] 5.3 迁移新增商品页 src/app/products/new/page.tsx
    - 使用 Input, Select, Dialog, Table 组件
    - _Requirements: 4.5, 4.6_

- [x] 6. 迁移库存管理页面
  - [x] 6.1 迁移库存页面 src/app/inventory/page.tsx
    - 使用 Tabs, Table, Badge, Dialog 组件
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. 迁移进货管理页面
  - [x] 7.1 迁移进货列表页 src/app/purchase/page.tsx
    - 使用 Table, DatePicker (Popover+Calendar), AlertDialog 组件
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 7.2 迁移新建进货页 src/app/purchase/new/page.tsx
    - 使用 Command (Combobox), Select, Input, Table 组件
    - _Requirements: 6.4, 6.5_
  - [x] 7.3 迁移进货详情页 src/app/purchase/[id]/page.tsx
    - 使用 Card, Table, Dialog 组件
    - _Requirements: 6.6, 6.7_

- [x] 8. 迁移销售管理页面
  - [x] 8.1 迁移销售列表页 src/app/sales/page.tsx
    - 使用 Table, DatePicker (Popover+Calendar), AlertDialog 组件
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 8.2 迁移新建销售页 src/app/sales/new/page.tsx
    - 使用 Command (Combobox), Select, Input, Table 组件
    - _Requirements: 7.4, 7.5, 7.6_
  - [x] 8.3 迁移销售详情页 src/app/sales/[id]/page.tsx
    - 使用 Card, Table, Dialog 组件
    - 保持打印样式逻辑
    - _Requirements: 7.7, 7.8, 7.9_

- [x] 9. 迁移盘点管理页面
  - [x] 9.1 迁移盘点列表页 src/app/stock-taking/page.tsx
    - 使用 Table, AlertDialog 组件
    - _Requirements: 8.1, 8.2_
  - [x] 9.2 迁移新建盘点页 src/app/stock-taking/new/page.tsx
    - 使用 Card, Button 组件
    - _Requirements: 8.3_
  - [x] 9.3 迁移盘点详情页 src/app/stock-taking/[id]/page.tsx
    - 使用 Card, Table, Input, AlertDialog 组件
    - _Requirements: 8.4, 8.5, 8.6_

- [x] 10. 迁移统计报表页面
  - [x] 10.1 迁移统计页面 src/app/statistics/page.tsx
    - 使用 Tabs, DatePicker (Popover+Calendar), Card, Table 组件
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. Checkpoint - 验证页面迁移
  - 运行 `pnpm tsc --noEmit` 确保无类型错误
  - 运行 `pnpm build` 确保构建成功

- [x] 12. 清理旧依赖和代码
  - [x] 12.1 移除 HeroUI 相关依赖
    - 从 package.json 移除 @heroui/react
    - 从 package.json 移除 @internationalized/date
    - 检查 framer-motion 是否仍需要，如不需要则移除
    - _Requirements: 11.1, 11.2, 11.4_
  - [x] 12.2 验证无残留导入
    - 搜索并确认无 @heroui/react 导入
    - 搜索并确认无 @internationalized/date 导入
    - _Requirements: 11.3, 11.5_
  - [x] 12.3 清理 design-tokens.ts 和 icons.ts
    - 检查是否有未使用的 HeroUI 相关代码
    - 确保所有图标统一使用 `lucide-react`
    - _Requirements: 11.3_

- [x] 13. Final Checkpoint - 最终验证
  - 运行 `pnpm tsc --noEmit` 确保无类型错误
  - 运行 `pnpm build` 确保构建成功
  - 运行 `pnpm test` 确保现有测试通过

## Notes

- 迁移过程中保持业务逻辑不变，仅替换 UI 组件
- 每个页面迁移后建议手动测试功能是否正常
- shadcn/ui 组件代码直接存放在项目中，便于后续定制
- 使用 date-fns 替代 @internationalized/date 处理日期
