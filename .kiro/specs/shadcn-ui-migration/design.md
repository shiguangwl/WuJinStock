# Design Document: shadcn/ui Migration

## Overview

本设计文档描述将五金店管理系统从 HeroUI (@heroui/react) 迁移到 shadcn/ui 的技术方案。shadcn/ui 是一个基于 Radix UI 和 Tailwind CSS 的组件库，采用"复制粘贴"模式，组件代码直接存放在项目中，便于定制和维护。

## Architecture

### 迁移策略

采用**渐进式迁移**策略：
1. 先安装和配置 shadcn/ui 基础设施
2. 创建 shadcn/ui 组件（按需添加）
3. 逐个迁移共享组件
4. 逐个迁移页面组件
5. 清理旧依赖

### 目录结构

```
src/
├── components/
│   └── ui/                    # shadcn/ui 组件目录
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── table.tsx
│       ├── dialog.tsx
│       ├── alert-dialog.tsx
│       ├── tabs.tsx
│       ├── badge.tsx
│       ├── select.tsx
│       ├── command.tsx
│       ├── popover.tsx
│       ├── calendar.tsx
│       ├── separator.tsx
│       ├── sonner.tsx
│       └── spinner.tsx        # 自定义 Spinner 组件
├── lib/
│   └── utils.ts               # cn() 工具函数
└── app/
    └── components/            # 业务组件（保持原位置）
```

## Components and Interfaces

### 组件映射详细设计

#### 1. Button 组件

**HeroUI API:**
```tsx
<Button color="primary" variant="flat" size="sm" isLoading={loading} onPress={handler}>
  文本
</Button>
```

**shadcn/ui API:**
```tsx
<Button variant="default" size="sm" disabled={loading} onClick={handler}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  文本
</Button>
```

**映射规则:**
| HeroUI | shadcn/ui |
|--------|-----------|
| `color="primary"` | `variant="default"` |
| `color="danger"` | `variant="destructive"` |
| `variant="flat"` | `variant="secondary"` |
| `variant="light"` | `variant="ghost"` |
| `isLoading` | 手动添加 Spinner + disabled |
| `onPress` | `onClick` |
| `isIconOnly` | `size="icon"` |
| `startContent` | 直接放在 children 前 |

#### 2. Input 组件

**HeroUI API:**
```tsx
<Input
  label="标签"
  placeholder="占位符"
  value={value}
  onValueChange={setValue}
  isRequired
  isInvalid={!!error}
  errorMessage={error}
  startContent={<Icon />}
/>
```

**shadcn/ui API:**
```tsx
<div className="space-y-2">
  <Label htmlFor="input-id">标签 *</Label>
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      id="input-id"
      placeholder="占位符"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={cn("pl-10", error && "border-destructive")}
    />
  </div>
  {error && <p className="text-sm text-destructive">{error}</p>}
</div>
```

#### 3. Card 组件

**HeroUI API:**
```tsx
<Card className="shadow-sm">
  <CardHeader>标题</CardHeader>
  <CardBody>内容</CardBody>
</Card>
```

**shadcn/ui API:**
```tsx
<Card className="shadow-sm">
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <CardContent>内容</CardContent>
</Card>
```

#### 4. Table 组件

**HeroUI API:**
```tsx
<Table aria-label="表格">
  <TableHeader>
    <TableColumn>列1</TableColumn>
  </TableHeader>
  <TableBody isLoading={loading} emptyContent={<Empty />}>
    {items.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.value}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**shadcn/ui API:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>列1</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {loading ? (
      <TableRow>
        <TableCell colSpan={columns} className="text-center">
          <Spinner />
        </TableCell>
      </TableRow>
    ) : items.length === 0 ? (
      <TableRow>
        <TableCell colSpan={columns} className="text-center">
          <Empty />
        </TableCell>
      </TableRow>
    ) : (
      items.map(item => (
        <TableRow key={item.id}>
          <TableCell>{item.value}</TableCell>
        </TableRow>
      ))
    )}
  </TableBody>
</Table>
```

#### 5. Modal/Dialog 组件

**HeroUI API:**
```tsx
const { isOpen, onOpen, onClose } = useDisclosure()

<Modal isOpen={isOpen} onOpenChange={onClose}>
  <ModalContent>
    <ModalHeader>标题</ModalHeader>
    <ModalBody>内容</ModalBody>
    <ModalFooter>
      <Button onPress={onClose}>取消</Button>
      <Button color="primary" onPress={handleConfirm}>确认</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

**shadcn/ui API:**
```tsx
const [open, setOpen] = useState(false)

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
    </DialogHeader>
    <div>内容</div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
      <Button onClick={handleConfirm}>确认</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### 6. AlertDialog 组件（确认对话框）

**shadcn/ui API:**
```tsx
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认删除</AlertDialogTitle>
      <AlertDialogDescription>
        此操作不可撤销。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

#### 7. Chip → Badge 组件

**HeroUI API:**
```tsx
<Chip color="success" size="sm" variant="flat">已完成</Chip>
```

**shadcn/ui API:**
```tsx
<Badge variant="default" className="bg-emerald-100 text-emerald-700">已完成</Badge>
```

#### 8. Tabs 组件

**HeroUI API:**
```tsx
<Tabs selectedKey={activeTab} onSelectionChange={setActiveTab}>
  <Tab key="tab1" title="标签1">内容1</Tab>
  <Tab key="tab2" title="标签2">内容2</Tab>
</Tabs>
```

**shadcn/ui API:**
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="tab1">标签1</TabsTrigger>
    <TabsTrigger value="tab2">标签2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">内容1</TabsContent>
  <TabsContent value="tab2">内容2</TabsContent>
</Tabs>
```

#### 9. DatePicker 组件

**HeroUI API:**
```tsx
import { CalendarDate } from '@internationalized/date'
<DatePicker label="日期" value={date} onChange={setDate} />
```

**shadcn/ui API (Popover + Calendar):**
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
      <CalendarIcon className="mr-2 h-4 w-4" />
      {date ? format(date, "PPP", { locale: zhCN }) : "选择日期"}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <Calendar mode="single" selected={date} onSelect={setDate} />
  </PopoverContent>
</Popover>
```

#### 10. Autocomplete → Command (Combobox)

**HeroUI API:**
```tsx
<Autocomplete
  label="搜索商品"
  inputValue={keyword}
  onInputChange={setKeyword}
  onSelectionChange={handleSelect}
>
  {items.map(item => (
    <AutocompleteItem key={item.id}>{item.name}</AutocompleteItem>
  ))}
</Autocomplete>
```

**shadcn/ui API (Command + Popover):**
```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" aria-expanded={open}>
      {selected ? selected.name : "搜索商品..."}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[300px] p-0">
    <Command>
      <CommandInput placeholder="搜索商品..." value={keyword} onValueChange={setKeyword} />
      <CommandList>
        <CommandEmpty>未找到商品</CommandEmpty>
        <CommandGroup>
          {items.map(item => (
            <CommandItem key={item.id} value={item.name} onSelect={() => handleSelect(item)}>
              <Check className={cn("mr-2 h-4 w-4", selected?.id === item.id ? "opacity-100" : "opacity-0")} />
              {item.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

#### 11. Select 组件

**HeroUI API:**
```tsx
<Select label="单位" selectedKeys={[unit]} onSelectionChange={keys => setUnit(Array.from(keys)[0])}>
  {units.map(u => <SelectItem key={u.key}>{u.label}</SelectItem>)}
</Select>
```

**shadcn/ui API:**
```tsx
<div className="space-y-2">
  <Label>单位</Label>
  <Select value={unit} onValueChange={setUnit}>
    <SelectTrigger>
      <SelectValue placeholder="选择单位" />
    </SelectTrigger>
    <SelectContent>
      {units.map(u => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}
    </SelectContent>
  </Select>
</div>
```

#### 12. Toast 通知

**HeroUI API:**
```tsx
import { addToast } from '@heroui/react'
addToast({ title: '成功', description: '操作完成', color: 'success' })
```

**shadcn/ui API (Sonner):**
```tsx
import { toast } from 'sonner'
toast.success('操作完成', { description: '成功' })
// 或
toast('操作完成')
toast.error('操作失败')
toast.warning('警告')
```

#### 13. Spinner 组件

**自定义 Spinner 组件:**
```tsx
// src/components/ui/spinner.tsx
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  return <Loader2 className={cn("animate-spin", sizeClasses[size], className)} />
}
```

### 共享组件迁移设计

#### Providers.tsx
```tsx
'use client'

import { Toaster } from "@/components/ui/sonner"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  )
}
```

#### ConfirmDialog.tsx
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={variant === 'danger' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

## Data Models

本次迁移不涉及数据模型变更，所有业务逻辑和数据结构保持不变。



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

由于本次迁移是 UI 库替换任务，主要涉及组件 API 的转换，大部分验收标准属于"示例测试"类型（检查特定文件是否正确迁移），而非"属性测试"类型（需要对大量输入进行验证）。

经过分析，本次迁移任务的验收标准主要通过以下方式验证：

1. **代码审查**: 检查组件是否正确使用 shadcn/ui API
2. **构建验证**: 确保项目能够成功构建，无 TypeScript 错误
3. **运行时验证**: 手动测试各页面功能是否正常

### 可自动化验证的属性

**Property 1: 无 HeroUI 导入残留**
*For any* TypeScript/TSX 文件，不应包含 `@heroui/react` 的导入语句
**Validates: Requirements 11.3, 11.5**

**Property 2: 无 @internationalized/date 导入残留**
*For any* TypeScript/TSX 文件，不应包含 `@internationalized/date` 的导入语句
**Validates: Requirements 11.2**

**Property 3: 构建成功**
*For any* 代码变更，项目应能成功通过 `pnpm build` 构建
**Validates: Requirements 1-12**

## Error Handling

### 迁移过程中的错误处理

1. **类型错误**: shadcn/ui 组件的 props 类型与 HeroUI 不同，需要逐一调整
2. **样式差异**: 部分样式类名需要调整以匹配 shadcn/ui 的设计系统
3. **事件处理**: `onPress` → `onClick`，`onValueChange` → `onChange` 等

### 运行时错误处理

保持现有的错误处理逻辑不变，仅替换 UI 组件。

## Testing Strategy

### 测试方法

由于本次迁移是 UI 库替换，主要采用以下测试策略：

1. **静态分析**
   - TypeScript 类型检查
   - ESLint 代码检查
   - 确保无 HeroUI 导入残留

2. **构建验证**
   - `pnpm build` 成功
   - 无编译错误

3. **手动测试**
   - 逐页面验证功能正常
   - 验证 Toast 通知正常显示
   - 验证对话框正常打开/关闭
   - 验证表单提交正常

4. **回归测试**
   - 现有的 property-based tests 应继续通过
   - 业务逻辑未变更，服务层测试应保持通过

### 测试命令

```bash
# 类型检查
pnpm tsc --noEmit

# 构建验证
pnpm build

# 运行现有测试
pnpm test
```
