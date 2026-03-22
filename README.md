# MyLite - 桌面数据库管理工具

基于 Rust + Tauri + React + TypeScript 开发的现代化 MySQL 客户端，类似于 Navicat。

## 🚀 技术栈

- **后端**: Rust + Tauri + sqlx
- **前端**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **编辑器**: Monaco Editor (VS Code 同款)
- **状态管理**: Zustand

## 📁 项目结构

```
mylite/
├── src/                          # 前端代码
│   ├── App.tsx                   # 主应用组件
│   ├── main.tsx                  # 入口文件
│   ├── index.css                 # 全局样式
│   ├── components/               # 组件目录
│   │   ├── DatabaseWorkspace.tsx # 数据库工作区
│   │   ├── SQLEditor.tsx         # SQL编辑器
│   │   ├── QueryResult.tsx       # 查询结果展示
│   │   ├── SchemaBrowser.tsx     # 结构浏览器
│   │   └── ui/                   # shadcn/ui 组件
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── tabs.tsx
│   │       ├── table.tsx
│   │       ├── badge.tsx
│   │       ├── separator.tsx
│   │       └── resizable.tsx
│   ├── lib/
│   │   └── utils.ts              # 工具函数
│   └── store/
│       └── connectionStore.ts    # 连接状态管理
├── src-tauri/                    # Rust 后端代码
│   ├── src/
│   │   ├── main.rs               # 主入口
│   │   ├── commands/             # 命令处理
│   │   │   ├── connection.rs     # 连接管理
│   │   │   ├── query.rs          # SQL查询
│   │   │   └── schema.rs         # 结构浏览
│   │   ├── db/
│   │   │   └── connection.rs     # 连接池管理
│   │   └── models/               # 数据模型
│   │       ├── connection.rs
│   │       ├── query.rs
│   │       └── schema.rs
│   └── Cargo.toml
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
├── tailwind.config.js            # Tailwind 配置
└── package.json
```

## 🛠️ 安装依赖

```bash
cd mylite
npm install
```

## 🚀 开发运行

```bash
# 启动开发服务器
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

## ✨ 功能特性

### 连接管理
- 保存/编辑/删除数据库连接
- 测试连接
- 连接列表展示

### SQL 编辑器
- Monaco Editor 代码编辑
- SQL 语法高亮
- 查询历史记录
- Ctrl+Enter 快捷执行

### 查询结果
- 表格展示
- 分页浏览
- 数据导出
- 复制功能

### 结构浏览器
- 数据库列表
- 表结构查看
- 字段详情

## 🔧 开发团队

- 项目经理
- 产品经理
- UI设计师
- 开发
- 测试

## 📋 项目阶段

- ✅ Phase 1: 基础架构搭建
- ✅ Phase 2: 核心功能开发
- 🔄 Phase 3: 高级功能 (进行中)
- ⏳ Phase 4: 性能优化与测试
