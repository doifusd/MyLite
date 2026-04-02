# SQL 查询保存功能

## 功能说明

用户现在可以轻松保存 SQL 查询到本地文件。

## 使用方法

### 方法 1：点击 Save 按钮
- 在 SQL 编辑器工具栏中点击 **Save** 按钮
- 查询会被保存到 `~/.mylite/saved_queries/` 目录
- 文件名格式：`query_YYYY-MM-DD_HHMMSS.sql`

### 方法 2：使用键盘快捷键
- 按 **Ctrl+S** (Windows/Linux) 或 **Cmd+S** (Mac)
- 查询会被自动保存

## 实现细节

### 后端（Rust）

**新增 Tauri 命令**：
```rust
#[tauri::command]
pub async fn save_query_to_file(
    _state: State<'_, Arc<AppState>>,
    sql: String,
    filename: Option<String>,
) -> Result<String, String>
```

**功能**：
- 在 `~/.mylite/saved_queries/` 目录中创建 SQL 文件
- 如果目录不存在，自动创建
- 如果没有提供文件名，使用时间戳自动生成
- 返回保存的文件完整路径

**依赖**：
- 添加了 `dirs` crate (v5.0) 用于跨平台获取主目录

### 前端（React）

**新增函数**：
```typescript
const saveSql = async () => {
  // 调用后端的 save_query_to_file 命令
  // 生成带时间戳的文件名
  // 显示保存状态
}
```

**快捷键绑定**：
- `Ctrl+S / Cmd+S`：保存查询
- `Ctrl+Enter / Cmd+Enter`：执行查询（原有）
- `Shift+Alt+F`：格式化查询（原有）

**UI 改进**：
- Save 按钮添加了 `title` 属性提示快捷键
- 当没有输入内容时，Save 按钮被禁用

## 文件保存位置

所有保存的 SQL 查询都存储在：
```
~/.mylite/saved_queries/
```

例如：
```
~/.mylite/saved_queries/query_2026-04-02_105230.sql
```

## 技术栈

- **后端**：Rust + Tauri + `dirs` crate
- **前端**：React + TypeScript
- **文件操作**：标准 Rust 文件系统 API

## 未来改进方向

- [ ] 实现打开保存的查询文件
- [ ] 添加查询历史记录的导出功能
- [ ] 支持自定义保存位置选择
- [ ] 添加自动保存功能
- [ ] 添加保存成功的 toast 通知
- [ ] 在界面中显示最近保存的文件列表
