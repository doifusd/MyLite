use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionType {
    #[default]
    Direct,
    SshTunnel,
    Ssl,
    Http,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    pub ssh_host: String,
    pub ssh_port: u16,
    pub ssh_username: String,
    pub ssh_password: Option<String>,
    pub ssh_private_key: Option<String>,
    pub ssh_private_key_passphrase: Option<String>,
    pub local_bind_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SslConfig {
    pub ssl_mode: String, // disabled, preferred, required, verify_ca, verify_identity
    pub ssl_ca: Option<String>,
    pub ssl_cert: Option<String>,
    pub ssl_key: Option<String>,
    pub ssl_cipher: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpConfig {
    pub http_url: String,
    pub http_auth_type: String, // none, basic, bearer
    pub http_username: Option<String>,
    pub http_password: Option<String>,
    pub http_bearer_token: Option<String>,
    pub http_headers: Option<Vec<(String, String)>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionColor {
    #[default]
    Blue,
    Green,
    Purple,
    Orange,
    Red,
    Cyan,
    Pink,
    Indigo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
    #[serde(default)]
    pub color: Option<ConnectionColor>,
    #[serde(default)]
    pub connection_type: ConnectionType,
    #[serde(default)]
    pub ssh_config: Option<SshConfig>,
    #[serde(default)]
    pub ssl_config: Option<SslConfig>,
    #[serde(default)]
    pub http_config: Option<HttpConfig>,
    // Phase 4.1: Connection grouping and favorites
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub is_favorite: bool,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub last_connected_at: Option<String>,
}

impl ConnectionConfig {
    pub fn new(name: String, host: String, port: u16, username: String, password: String) -> Self {
        Self {
            id: Some(Uuid::new_v4().to_string()),
            name,
            host,
            port,
            username,
            password,
            database: None,
            color: Some(ConnectionColor::Blue),
            connection_type: ConnectionType::Direct,
            ssh_config: None,
            ssl_config: None,
            http_config: None,
            group: None,
            is_favorite: false,
            sort_order: 0,
            tags: vec![],
            last_connected_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
    #[serde(default)]
    pub color: Option<ConnectionColor>,
    #[serde(default)]
    pub connection_type: ConnectionType,
    #[serde(default)]
    pub ssh_config: Option<SshConfig>,
    #[serde(default)]
    pub ssl_config: Option<SslConfig>,
    #[serde(default)]
    pub http_config: Option<HttpConfig>,
    // Phase 4.1: Connection grouping and favorites
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub is_favorite: bool,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub last_connected_at: Option<String>,
}

impl From<ConnectionConfig> for ConnectionInfo {
    fn from(config: ConnectionConfig) -> Self {
        Self {
            id: config.id.unwrap_or_default(),
            name: config.name,
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            database: config.database,
            color: config.color,
            connection_type: config.connection_type,
            ssh_config: config.ssh_config,
            ssl_config: config.ssl_config,
            http_config: config.http_config,
            group: config.group,
            is_favorite: config.is_favorite,
            sort_order: config.sort_order,
            tags: config.tags,
            last_connected_at: config.last_connected_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub server_version: Option<String>,
}

// Phase 4.1: Connection group model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionGroup {
    pub id: String,
    pub name: String,
    pub color: Option<ConnectionColor>,
    pub sort_order: i32,
    #[serde(default)]
    pub is_expanded: bool,
}

// Phase 4.1: Quick connect template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickConnectTemplate {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub database: Option<String>,
    pub color: Option<ConnectionColor>,
    pub tags: Vec<String>,
}

// Phase 4.1: Connection filter/sort options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionSortBy {
    #[default]
    Name,
    LastConnected,
    CreatedAt,
    Host,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionFilter {
    pub search: Option<String>,
    pub group_id: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: Option<bool>,
    pub sort_by: ConnectionSortBy,
    pub sort_ascending: bool,
}
