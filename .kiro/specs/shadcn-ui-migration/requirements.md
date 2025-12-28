# Requirements Document

## Introduction

将五金店管理系统的 UI 库从 HeroUI (@heroui/react) 迁移到 shadcn/ui。此次重构涉及所有页面和共享组件，需要保持现有功能不变的同时，采用 shadcn/ui 的设计系统和组件。

## Glossary

- **System**: 五金店管理系统前端应用
- **HeroUI**: 当前使用的 UI 组件库 (@heroui/react)
- **shadcn/ui**: 目标 UI 组件库，基于 Radix UI 和 Tailwind CSS
- **Component**: 可复用的 UI 组件
- **Page**: Next.js 路由对应的页面组件
- **Migration**: 从一个 UI 库迁移到另一个 UI 库的过程

## Requirements

### Requirement 1: 安装和配置 shadcn/ui

**User Story:** As a 开发者, I want to 正确配置 shadcn/ui, so that 可以在项目中使用其组件。

#### Acceptance Criteria

1. THE System SHALL 安装 shadcn/ui 及其依赖项
2. THE System SHALL 配置 Tailwind CSS 以支持 shadcn/ui 的设计令牌
3. THE System SHALL 创建 components.json 配置文件
4. THE System SHALL 配置 cn() 工具函数用于类名合并

### Requirement 2: 迁移共享组件

**User Story:** As a 开发者, I want to 将共享组件迁移到 shadcn/ui, so that 所有页面可以使用统一的组件。

#### Acceptance Criteria

1. WHEN 迁移 Providers 组件, THE System SHALL 移除 HeroUIProvider 并配置 Toaster 组件
2. WHEN 迁移 Sidebar 组件, THE System SHALL 使用 shadcn/ui 的 Button 和 Sheet 组件替换 HeroUI 组件
3. WHEN 迁移 AppLayout 组件, THE System SHALL 保持现有布局逻辑不变
4. WHEN 迁移 PageHeader 组件, THE System SHALL 使用 shadcn/ui 的 Button 组件
5. WHEN 迁移 ConfirmDialog 组件, THE System SHALL 使用 shadcn/ui 的 AlertDialog 组件
6. WHEN 迁移 EmptyState 组件, THE System SHALL 使用 shadcn/ui 的 Button 组件
7. WHEN 迁移 LoadingState 组件, THE System SHALL 创建自定义 Spinner 组件或使用 Loader2 图标
8. WHEN 迁移 StatCard 组件, THE System SHALL 使用 shadcn/ui 的 Card 组件
9. WHEN 迁移 useConfirmDialog hook, THE System SHALL 适配 AlertDialog 组件的 API
10. WHEN 迁移 useToast hook, THE System SHALL 使用 sonner 的 toast API

### Requirement 3: 迁移首页

**User Story:** As a 用户, I want to 首页正常显示, so that 可以快速访问各功能模块。

#### Acceptance Criteria

1. WHEN 访问首页, THE System SHALL 使用 shadcn/ui 的 Card 组件显示快捷操作
2. WHEN 访问首页, THE System SHALL 保持现有的视觉设计和交互效果

### Requirement 4: 迁移商品管理页面

**User Story:** As a 用户, I want to 商品管理功能正常工作, so that 可以管理店铺商品。

#### Acceptance Criteria

1. WHEN 访问商品列表页, THE System SHALL 使用 shadcn/ui 的 Table 组件显示商品数据
2. WHEN 搜索商品, THE System SHALL 使用 shadcn/ui 的 Input 组件
3. WHEN 删除商品, THE System SHALL 使用 shadcn/ui 的 AlertDialog 组件确认
4. WHEN 访问商品详情页, THE System SHALL 使用 shadcn/ui 的表单组件（Input、Select、Dialog）
5. WHEN 新增商品, THE System SHALL 使用 shadcn/ui 的表单组件
6. WHEN 管理包装单位, THE System SHALL 使用 shadcn/ui 的 Dialog 和 Table 组件

### Requirement 5: 迁移库存管理页面

**User Story:** As a 用户, I want to 库存管理功能正常工作, so that 可以查看库存状态。

#### Acceptance Criteria

1. WHEN 访问库存页面, THE System SHALL 使用 shadcn/ui 的 Tabs 组件切换视图
2. WHEN 显示库存列表, THE System SHALL 使用 shadcn/ui 的 Table 组件
3. WHEN 显示库存预警, THE System SHALL 使用 shadcn/ui 的 Badge 组件标识状态
4. WHEN 查看变动历史, THE System SHALL 使用 shadcn/ui 的 Dialog 组件显示详情

### Requirement 6: 迁移进货管理页面

**User Story:** As a 用户, I want to 进货管理功能正常工作, so that 可以管理进货订单。

#### Acceptance Criteria

1. WHEN 访问进货列表页, THE System SHALL 使用 shadcn/ui 的 Table 组件显示订单
2. WHEN 筛选进货单, THE System SHALL 使用 shadcn/ui 的 DatePicker 组件（Popover + Calendar）
3. WHEN 确认入库, THE System SHALL 使用 shadcn/ui 的 AlertDialog 组件
4. WHEN 新建进货单, THE System SHALL 使用 shadcn/ui 的 Command 组件实现商品搜索自动完成
5. WHEN 选择商品单位, THE System SHALL 使用 shadcn/ui 的 Select 组件
6. WHEN 查看进货详情, THE System SHALL 使用 shadcn/ui 的 Card 和 Table 组件
7. WHEN 创建退货单, THE System SHALL 使用 shadcn/ui 的 Dialog 和 Table 组件

### Requirement 7: 迁移销售管理页面

**User Story:** As a 用户, I want to 销售管理功能正常工作, so that 可以管理销售订单。

#### Acceptance Criteria

1. WHEN 访问销售列表页, THE System SHALL 使用 shadcn/ui 的 Table 组件显示订单
2. WHEN 筛选销售单, THE System SHALL 使用 shadcn/ui 的 DatePicker 组件（Popover + Calendar）
3. WHEN 确认销售, THE System SHALL 使用 shadcn/ui 的 AlertDialog 组件
4. WHEN 新建销售单, THE System SHALL 使用 shadcn/ui 的 Command 组件实现商品搜索自动完成
5. WHEN 选择商品单位, THE System SHALL 使用 shadcn/ui 的 Select 组件
6. WHEN 输入数量和价格, THE System SHALL 使用 shadcn/ui 的 Input 组件（type=number）
7. WHEN 查看销售详情, THE System SHALL 使用 shadcn/ui 的 Card 和 Table 组件
8. WHEN 创建退货单, THE System SHALL 使用 shadcn/ui 的 Dialog 和 Table 组件
9. WHEN 打印销售单, THE System SHALL 保持现有打印样式逻辑

### Requirement 8: 迁移盘点管理页面

**User Story:** As a 用户, I want to 盘点管理功能正常工作, so that 可以进行库存盘点。

#### Acceptance Criteria

1. WHEN 访问盘点列表页, THE System SHALL 使用 shadcn/ui 的 Table 组件显示记录
2. WHEN 删除盘点, THE System SHALL 使用 shadcn/ui 的 AlertDialog 组件确认
3. WHEN 新建盘点, THE System SHALL 使用 shadcn/ui 的 Card 和 Button 组件
4. WHEN 查看盘点详情, THE System SHALL 使用 shadcn/ui 的 Card 和 Table 组件
5. WHEN 编辑实际数量, THE System SHALL 使用 shadcn/ui 的 Input 组件（内联编辑）
6. WHEN 完成盘点, THE System SHALL 使用 shadcn/ui 的 AlertDialog 组件确认

### Requirement 9: 迁移统计报表页面

**User Story:** As a 用户, I want to 统计报表功能正常工作, so that 可以查看销售数据。

#### Acceptance Criteria

1. WHEN 访问统计页面, THE System SHALL 使用 shadcn/ui 的 Tabs 组件切换视图
2. WHEN 选择日期范围, THE System SHALL 使用 shadcn/ui 的 DatePicker 组件
3. WHEN 显示统计卡片, THE System SHALL 使用 shadcn/ui 的 Card 组件
4. WHEN 显示数据表格, THE System SHALL 使用 shadcn/ui 的 Table 组件

### Requirement 10: Toast 通知系统

**User Story:** As a 用户, I want to 收到操作反馈通知, so that 知道操作是否成功。

#### Acceptance Criteria

1. WHEN 操作成功, THE System SHALL 使用 shadcn/ui 的 Toast 组件显示成功消息
2. WHEN 操作失败, THE System SHALL 使用 shadcn/ui 的 Toast 组件显示错误消息
3. THE System SHALL 配置 Toaster 组件在应用根级别

### Requirement 11: 清理旧代码

**User Story:** As a 开发者, I want to 移除旧的 UI 库代码, so that 项目保持整洁。

#### Acceptance Criteria

1. THE System SHALL 从 package.json 移除 @heroui/react 依赖
2. THE System SHALL 从 package.json 移除 @internationalized/date 依赖
3. THE System SHALL 移除所有 HeroUI 相关的导入语句
4. THE System SHALL 移除未使用的 framer-motion 依赖（如果不再需要）
5. THE System SHALL 确保没有残留的 HeroUI 组件引用

### Requirement 12: 组件映射关系

**User Story:** As a 开发者, I want to 了解组件映射关系, so that 可以正确迁移。

#### Acceptance Criteria

1. THE System SHALL 将 HeroUI Button 映射到 shadcn/ui Button
2. THE System SHALL 将 HeroUI Input 映射到 shadcn/ui Input
3. THE System SHALL 将 HeroUI Card/CardBody/CardHeader 映射到 shadcn/ui Card/CardContent/CardHeader
4. THE System SHALL 将 HeroUI Table 系列组件映射到 shadcn/ui Table 系列组件
5. THE System SHALL 将 HeroUI Modal 系列组件映射到 shadcn/ui Dialog 系列组件
6. THE System SHALL 将 HeroUI Chip 映射到 shadcn/ui Badge
7. THE System SHALL 将 HeroUI Spinner 映射到自定义 Spinner 组件（使用 Loader2 图标）
8. THE System SHALL 将 HeroUI Tabs/Tab 映射到 shadcn/ui Tabs/TabsList/TabsTrigger/TabsContent
9. THE System SHALL 将 HeroUI DatePicker 映射到 shadcn/ui Popover + Calendar 组合
10. THE System SHALL 将 HeroUI Autocomplete/AutocompleteItem 映射到 shadcn/ui Command 组件（Combobox 模式）
11. THE System SHALL 将 HeroUI Select/SelectItem 映射到 shadcn/ui Select 系列组件
12. THE System SHALL 将 HeroUI Divider 映射到 shadcn/ui Separator
13. THE System SHALL 将 HeroUI useDisclosure 映射到 React useState 管理 Dialog 状态
14. THE System SHALL 将 HeroUI addToast/ToastProvider 映射到 shadcn/ui Sonner (toast/Toaster)
15. THE System SHALL 将 HeroUI NumberInput 映射到 shadcn/ui Input (type="number")
16. THE System SHALL 将 HeroUI HeroUIProvider 移除（shadcn/ui 不需要全局 Provider）
