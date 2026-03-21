use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
    pub use_ssl: bool,
    #[serde(default)]
    pub ssl_ca: Option<String>,
    #[serde(default)]
    pub ssl_cert: Option<String>,
    #[serde(default)]
    pub ssl_key: Option<String>,
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
            use_ssl: false,
            ssl_ca: None,
            ssl_cert: None,
            ssl_key: None,
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
    pub use_ssl: bool,
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
            use_ssl: config.use_ssl,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub server_version: Option<String>,
}
