# 实现计划 - 五金店管理系统

## 概述

本实现计划将五金店管理系统的设计分解为可执行的编码任务。采用增量开发方式，每个任务都建立在前一个任务的基础上，确保代码始终可运行。

## 任务列表

- [x] 1. 项目初始化和基础设施搭建
  - [x] 1.1 创建 Next.js 15 项目并配置 TypeScript、Tailwind CSS
    - 使用 `pnpm create next-app` 创建项目
    - 配置 Turbopack 开发服务器
    - 安装 HeroUI 组件库
    - _需求: 7.1_

  - [x] 1.2 配置 Drizzle ORM 和 SQLite 数据库
    - 安装 drizzle-orm、better-sqlite3、drizzle-kit
    - 创建 `drizzle.config.ts` 配置文件
    - 创建 `src/server/db/index.ts` 数据库客户端
    - _需求: 6.3, 6.4_

  - [x] 1.3 创建核心数据库 Schema
    - 创建 `src/server/db/schema.ts`
    - 定义 products、storageLocations、productStorageLocations 表
    - 定义 packageUnits、inventoryRecords、inventoryTransactions 表
    - 运行 `drizzle-kit generate` 生成迁移文件
    - _需求: 1.1, 1.8, 1.9, 2.1_

  - [x] 1.4 创建订单相关数据库 Schema
    - 定义 purchaseOrders、purchaseOrderItems 表
    - 定义 salesOrders、salesOrderItems 表
    - 定义 returnOrders、returnOrderItems 表
    - 定义 stockTakings、stockTakingItems 表
    - 创建表关系定义 `src/server/db/relations.ts`
    - _需求: 3.1, 4.1, 3.1.1, 4.1.1, 2.5_

  - [x] 1.5 配置测试框架
    - 安装 Vitest、fast-check、@testing-library/react
    - 创建 `vitest.config.ts` 配置文件
    - 创建测试辅助工具和数据生成器
    - _需求: 测试策略_

- [x] 2. 商品管理模块
  - [x] 2.1 实现商品服务层
    - 创建 `src/server/services/product-service.ts`
    - 实现 createProduct、updateProduct、getProduct、searchProducts
    - 实现商品编码生成逻辑 generateProductCode
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 编写商品编码唯一性属性测试
    - **属性 1: 商品编码唯一性**
    - **验证需求: 1.5**

  - [x] 2.3 编写必填字段验证属性测试
    - **属性 2: 必填字段验证**
    - **验证需求: 1.2**

  - [x] 2.4 实现包装单位管理
    - 实现 addPackageUnit、removePackageUnit
    - 实现包装单位价格计算逻辑
    - _需求: 1.6, 1.7, 1.1.1, 1.1.2, 1.1.3_

  - [x] 2.5 编写换算比例有效性属性测试
    - **属性 3: 换算比例有效性**
    - **验证需求: 1.7**

  - [x] 2.6 实现存放位置管理
    - 创建 `src/server/services/storage-location-service.ts`
    - 实现位置的增删改查
    - 实现商品与位置的关联管理
    - _需求: 1.8, 1.9, 1.10_

  - [x] 2.7 实现商品管理 Server Actions
    - 创建 `src/server/actions/product-actions.ts`
    - 实现 createProductAction、updateProductAction、searchProductsAction
    - 使用 Zod 进行输入验证
    - _需求: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.8 创建商品管理页面
    - 创建 `src/app/products/page.tsx` 商品列表页
    - 创建 `src/app/products/new/page.tsx` 新增商品页
    - 创建 `src/app/products/[id]/page.tsx` 商品详情/编辑页
    - 使用 HeroUI 组件构建表单和表格
    - _需求: 7.1, 7.2, 7.3_

- [x] 3. 检查点 - 商品管理模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 库存管理模块
  - [x] 4.1 实现库存服务层
    - 创建 `src/server/services/inventory-service.ts`
    - 实现 getInventory、getLowStockProducts、adjustInventory
    - 实现 getInventoryTransactions 库存变动历史查询
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.8_

  - [x] 4.2 实现单位换算逻辑
    - 实现 convertToBaseUnit、convertFromBaseUnit
    - 实现 checkStockAvailability 库存充足性检查
    - _需求: 1.1.4, 1.1.5_

  - [x] 4.3 编写单位换算一致性属性测试
    - **属性 4: 单位换算一致性**
    - **验证需求: 1.1.4, 1.1.5**

  - [x] 4.4 编写小数精度支持属性测试
    - **属性 5: 小数精度支持**
    - **验证需求: 1.1.7, 1.1.8**

  - [x] 4.5 编写库存预警触发属性测试
    - **属性 6: 库存预警触发**
    - **验证需求: 2.3**

  - [x] 4.6 实现库存管理 Server Actions
    - 创建 `src/server/actions/inventory-actions.ts`
    - 实现库存查询、预警列表、变动历史等 Actions
    - _需求: 2.1, 2.3, 2.4, 2.8_

  - [x] 4.7 创建库存管理页面
    - 创建 `src/app/inventory/page.tsx` 库存列表页
    - 实现库存预警高亮显示
    - 创建库存变动历史查看组件
    - _需求: 7.1, 2.4_

- [x] 5. 检查点 - 库存管理模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 6. 进货管理模块
  - [x] 6.1 实现进货服务层
    - 创建 `src/server/services/purchase-service.ts`
    - 实现 createPurchaseOrder、confirmPurchaseOrder
    - 实现 getPurchaseOrder、searchPurchaseOrders
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 6.2 编写进货单验证属性测试
    - **属性 11: 进货单验证**
    - **验证需求: 3.2**

  - [x] 6.3 编写进货增加库存属性测试
    - **属性 10: 进货增加库存**
    - **验证需求: 3.4**

  - [x] 6.4 编写进货单金额计算属性测试
    - **属性 9: 进货单金额计算**
    - **验证需求: 3.5**

  - [x] 6.5 实现进货退货功能
    - 实现 createPurchaseReturn、confirmPurchaseReturn
    - _需求: 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5, 3.1.6, 3.1.7_

  - [x] 6.6 编写退货数量限制属性测试
    - **属性 12: 退货数量限制**
    - **验证需求: 3.1.4, 4.1.4**

  - [x] 6.7 编写进货退货减少库存属性测试
    - **属性 13: 进货退货减少库存**
    - **验证需求: 3.1.5**

  - [x] 6.8 实现进货管理 Server Actions
    - 创建 `src/server/actions/purchase-actions.ts`
    - 实现进货单创建、确认、查询等 Actions
    - _需求: 3.1, 3.6, 3.7_

  - [x] 6.9 创建进货管理页面
    - 创建 `src/app/purchase/page.tsx` 进货单列表页
    - 创建 `src/app/purchase/new/page.tsx` 新建进货单页
    - 创建 `src/app/purchase/[id]/page.tsx` 进货单详情页
    - 实现商品选择器组件
    - _需求: 7.1, 7.2, 7.5_

- [x] 7. 检查点 - 进货管理模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 8. 销售管理模块
  - [x] 8.1 实现销售服务层
    - 创建 `src/server/services/sales-service.ts`
    - 实现 createSalesOrder、addItemToOrder、confirmSalesOrder
    - 实现 getSalesOrder、searchSalesOrders
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10_

  - [x] 8.2 编写库存充足性验证属性测试
    - **属性 15: 库存充足性验证**
    - **验证需求: 4.4, 4.5**

  - [x] 8.3 编写销售单自动填充价格属性测试
    - **属性 16: 销售单自动填充价格**
    - **验证需求: 4.3**

  - [x] 8.4 编写销售减少库存属性测试
    - **属性 18: 销售减少库存**
    - **验证需求: 4.10**

  - [x] 8.5 实现折扣和抹零功能
    - 实现 applyDiscount、applyRounding
    - 实现 adjustItemPrice 改价功能
    - _需求: 4.7, 4.8, 4.9_

  - [x] 8.6 编写销售单金额计算属性测试
    - **属性 17: 销售单金额计算**
    - **验证需求: 4.6, 4.7, 4.8**

  - [x] 8.7 编写改价功能正确性属性测试
    - **属性 25: 改价功能正确性**
    - **验证需求: 4.9**

  - [x] 8.8 实现销售退货功能
    - 实现 createSalesReturn、confirmSalesReturn
    - _需求: 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5, 4.1.6, 4.1.7_

  - [x] 8.9 编写销售退货增加库存属性测试
    - **属性 14: 销售退货增加库存**
    - **验证需求: 4.1.5**

  - [x] 8.10 实现销售管理 Server Actions
    - 创建 `src/server/actions/sales-actions.ts`
    - 实现销售单创建、确认、查询等 Actions
    - _需求: 4.1, 4.6, 4.10_

  - [x] 8.11 创建销售管理页面
    - 创建 `src/app/sales/page.tsx` 销售单列表页
    - 创建 `src/app/sales/new/page.tsx` 新建销售单页（快速开单）
    - 创建 `src/app/sales/[id]/page.tsx` 销售单详情页
    - 实现快速商品搜索和添加
    - _需求: 7.1, 7.2, 7.4, 7.5_

  - [x] 8.12 实现销售单打印功能
    - 创建打印模板组件
    - 实现浏览器打印功能
    - _需求: 4.11_

- [x] 9. 检查点 - 销售管理模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 盘点管理模块
  - [x] 10.1 实现盘点服务层
    - 创建 `src/server/services/stock-taking-service.ts`
    - 实现 createStockTaking、recordActualQuantity、completeStockTaking
    - 实现 getStockTaking
    - _需求: 2.5, 2.6, 2.7_

  - [x] 10.2 编写盘点差异计算属性测试
    - **属性 7: 盘点差异计算**
    - **验证需求: 2.6**

  - [x] 10.3 编写盘点更新库存属性测试
    - **属性 8: 盘点更新库存**
    - **验证需求: 2.7**

  - [x] 10.4 实现盘点管理 Server Actions
    - 创建 `src/server/actions/stock-taking-actions.ts`
    - 实现盘点创建、录入、完成等 Actions
    - _需求: 2.5, 2.6, 2.7_

  - [x] 10.5 创建盘点管理页面
    - 创建 `src/app/stock-taking/page.tsx` 盘点列表页
    - 创建 `src/app/stock-taking/new/page.tsx` 新建盘点页
    - 创建 `src/app/stock-taking/[id]/page.tsx` 盘点录入页
    - 实现盘点差异高亮显示
    - _需求: 7.1, 7.2_

- [x] 11. 检查点 - 盘点管理模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 12. 统计报表模块
  - [x] 12.1 实现统计服务层
    - 创建 `src/server/services/statistics-service.ts`
    - 实现 getSalesSummary、getDailySales
    - 实现 getTopSellingProducts、calculateGrossProfit
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 12.2 编写毛利润计算属性测试
    - **属性 19: 毛利润计算**
    - **验证需求: 5.6**

  - [x] 12.3 实现统计报表 Server Actions
    - 创建 `src/server/actions/statistics-actions.ts`
    - 实现各类统计查询 Actions
    - _需求: 5.3, 5.4, 5.5, 5.6_

  - [x] 12.4 创建统计报表页面
    - 创建 `src/app/statistics/page.tsx` 统计概览页
    - 实现销售趋势图表
    - 实现商品销售排行
    - 实现日销售汇总表格
    - _需求: 7.1_

- [x] 13. 检查点 - 统计报表模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 14. 数据持久化和完整性
  - [x] 14.1 编写数据持久化往返属性测试
    - **属性 20: 数据持久化往返**
    - **验证需求: 6.1, 6.2, 6.4**

  - [x] 14.2 编写包装单位使用保护属性测试
    - **属性 21: 包装单位使用保护**
    - **验证需求: 1.1.6**

  - [x] 14.3 编写库存变动记录完整性属性测试
    - **属性 22: 库存变动记录完整性**
    - **验证需求: 2.8**

  - [x] 14.4 编写搜索结果相关性属性测试
    - **属性 23: 搜索结果相关性**
    - **验证需求: 1.4**

  - [x] 14.5 编写位置搜索准确性属性测试
    - **属性 24: 位置搜索准确性**
    - **验证需求: 1.10**

  - [x] 14.6 编写无效输入错误处理属性测试
    - **属性 26: 无效输入错误处理**
    - **验证需求: 7.3**

- [x] 15. 用户界面优化
  - [x] 15.1 创建应用布局和导航
    - 创建 `src/app/layout.tsx` 根布局
    - 实现侧边栏导航菜单
    - 实现响应式布局
    - _需求: 7.1_

  - [x] 15.2 实现键盘快捷操作
    - 实现常用操作的快捷键
    - 实现表单快速提交
    - _需求: 7.4_

  - [x] 15.3 实现确认对话框
    - 创建通用确认对话框组件
    - 在删除、确认订单等操作前显示确认
    - _需求: 7.5_

  - [x] 15.4 实现操作反馈
    - 创建 Toast 通知组件
    - 在操作成功/失败后显示反馈
    - _需求: 7.2_

- [x] 16. 最终检查点
  - 确保所有测试通过
  - 验证所有功能模块正常工作
  - 如有问题请询问用户

## 备注

- 每个任务都引用了具体的需求编号以便追溯
- 检查点用于确保增量开发的质量
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
