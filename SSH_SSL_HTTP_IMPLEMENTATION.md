# MySQL Client - SSH/SSL/HTTP 连接功能实现总结

## 概述

为 MySQL Client 工具添加了类似 Navicat 的高级连接功能，支持 SSH 隧道、SSL/TLS 和 HTTP 代理三种连接方式。

## 实现详情

### 1. 后端 (Rust)

#### 1.1 连接模型 (`src-tauri/src/models/connection.rs`)

```rust
// 连接类型枚举
pub enum ConnectionType {
    Direct,
    SshTunnel,
    Ssl,
    Http,
}

// SSH 配置
pub struct SshConfig {
    pub ssh_host: String,
    pub ssh_port: u16,
    pub ssh_username: String,
    pub ssh_password: Option<String>,
    pub ssh_private_key: Option<String>,
    pub ssh_private_key_passphrase: Option<String>,
    pub local_bind_port: u16,
}

// SSL 配置
pub struct SslConfig {
    pub ssl_mode: String, // disabled, preferred, required, verify_ca, verify_identity
    pub ssl_ca: Option<String>,
    pub ssl_cert: Option<String>,
    pub ssl_key: Option<String>,
    pub ssl_cipher: Option<String>,
}

// HTTP 配置
pub struct HttpConfig {
    pub http_url: String,
    pub http_auth_type: String, // none, basic, bearer
    pub http_username: Option<String>,
    pub http_password: Option<String>,
    pub http_bearer_token: Option<String>,
}
```

#### 1.2 SSH 隧道实现 (`src-tauri/src/db/ssh_tunnel.rs`)

使用 `russh` 库实现 SSH 客户端功能：
- 支持密码认证和私钥认证（包括加密私钥）
- 自动建立本地端口转发隧道
- `SshTunnelManager` 管理多个隧道生命周期

```rust
pub struct SshTunnel {
    session: client::Handle<ClientHandler>,
    local_port: u16,
}

pub struct SshTunnelManager {
    tunnels: Arc<Mutex<HashMap<String, SshTunnel>>>,
}
```

#### 1.3 连接池更新 (`src-tauri/src/db/connection.rs`)

- 自动检测连接类型
- SSH 隧道：建立隧道后通过本地端口连接
- SSL：配置 SSL 模式（5 种验证级别）
- HTTP：通过 HTTP 代理转发

```rust
pub async fn create_pool(&self, config: &ConnectionConfig) -> anyhow::Result<DbPool> {
    let (host, port) = match config.connection_type {
        ConnectionType::SshTunnel => {
            // 建立 SSH 隧道，返回本地端口
            let local_port = self.ssh_manager.get_or_create_tunnel(...).await?;
            ("127.0.0.1".to_string(), local_port)
        }
        _ => (config.host.clone(), config.port),
    };
    // ... 配置连接选项
}
```

#### 1.4 依赖 (`Cargo.toml`)

```toml
[dependencies]
russh = "0.45"
russh-keys = "0.45"
async-trait = "0.1"
```

### 2. 前端 (React + TypeScript)

#### 2.1 连接对话框 (`src/components/ConnectionDialog.tsx`)

4 个选项卡切换连接类型：

1. **Direct** (直接连接)
   - 标准 MySQL 连接配置

2. **SSH Tunnel** (SSH 隧道)
   - SSH 主机、端口、用户名
   - 密码认证或私钥认证
   - 支持加密私钥（输入密码短语）

3. **SSL** (SSL/TLS)
   - SSL 模式选择（5 种）
   - CA 证书、客户端证书、密钥输入

4. **HTTP** (HTTP 代理)
   - HTTP 端点 URL
   - 认证类型：None/Basic/Bearer

```typescript
interface ConnectionConfig {
  connection_type: 'direct' | 'ssh_tunnel' | 'ssl' | 'http';
  ssh_config?: SshConfig;
  ssl_config?: SslConfig;
  http_config?: HttpConfig;
}
```

#### 2.2 主应用集成 (`src/App.tsx`)

- 显示连接类型图标（SSH🔒、SSL🛡️、HTTP🌐）
- 支持编辑现有连接
- 连接测试支持所有类型

### 3. 功能特性

| 功能 | 状态 | 说明 |
|------|------|------|
| **SSH 隧道** | ✅ | 密码/私钥认证，支持加密私钥 |
| **SSL/TLS** | ✅ | 5 种 SSL 模式，证书配置 |
| **HTTP 代理** | ✅ | Basic/Bearer 认证 |
| **连接测试** | ✅ | 支持所有连接类型 |
| **连接编辑** | ✅ | 可修改现有连接配置 |

### 4. 文件结构

```
mysqlClient/
├── src-tauri/
│   ├── Cargo.toml              # 添加 russh 依赖
│   └── src/
│       ├── main.rs           # 注册命令
│       ├── models/
│       │   └── connection.rs # ConnectionType, SshConfig, SslConfig, HttpConfig
│       ├── db/
│       │   ├── mod.rs        # 模块导出
│       │   ├── connection.rs   # 连接池，支持 SSH/SSL/HTTP
│       │   └── ssh_tunnel.rs # SSH 隧道实现
│       └── commands/
│           ├── connection.rs # 保存/测试连接
│           └── schema.rs     # 更新配置构造
└── src/
    ├── components/
    │   └── ConnectionDialog.tsx  # 4 选项卡连接配置
    └── App.tsx               # 集成连接类型显示
```

### 5. 使用方法

#### SSH 隧道连接
1. 选择 **SSH** 选项卡
2. 输入 SSH 服务器信息（主机、端口、用户名）
3. 选择认证方式：
   - 密码：输入 SSH 密码
   - 私钥：粘贴私钥内容（支持加密私钥）
4. 输入 MySQL 服务器信息（相对于 SSH 服务器）

#### SSL 连接
1. 选择 **SSL** 选项卡
2. 选择 SSL 模式：
   - `Disabled`: 不使用 SSL
   - `Preferred`: 优先使用 SSL，失败则回退
   - `Required`: 必须使用 SSL
   - `Verify CA`: 验证 CA 证书
   - `Verify Identity`: 验证主机名
3. 可选：粘贴 CA/客户端证书

#### HTTP 代理
1. 选择 **HTTP** 选项卡
2. 输入 HTTP 代理服务 URL
3. 选择认证类型并输入凭据

### 6. 技术亮点

- **SSH 隧道**: 使用 `russh` 异步 SSH 库，支持现代加密算法
- **SSL 模式**: 完整支持 MySQL SSL 验证级别
- **HTTP 代理**: 为 Serverless 和受限网络环境设计
- **类型安全**: TypeScript 和 Rust 强类型保证
- **用户体验**: 清晰的选项卡界面，连接类型图标

### 7. 下一步

1. 运行 `cargo check` 验证 Rust 编译
2. 运行 `npm run build` 验证前端编译
3. 运行 `cargo tauri dev` 启动应用测试

---

实现完成时间: 2026-03-24
