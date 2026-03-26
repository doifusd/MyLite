use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions, MySqlSslMode};
use sqlx::{MySql, Pool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::connection::{ConnectionConfig, ConnectionType, SslConfig};
use crate::db::ssh_tunnel::SshTunnelManager;

pub type DbPool = Pool<MySql>;

#[derive(Clone)]
pub struct ConnectionPool {
    pools: Arc<RwLock<HashMap<String, DbPool>>>,
    ssh_manager: Arc<SshTunnelManager>,
}

impl ConnectionPool {
    pub async fn new() -> anyhow::Result<Self> {
        Ok(Self {
            pools: Arc::new(RwLock::new(HashMap::new())),
            ssh_manager: Arc::new(SshTunnelManager::new()),
        })
    }

    pub async fn create_pool(&self, config: &ConnectionConfig) -> anyhow::Result<DbPool> {
        let (host, port) = match config.connection_type {
            ConnectionType::SshTunnel => {
                if let Some(ref ssh_config) = config.ssh_config {
                    // Establish SSH tunnel
                    let local_port = self.ssh_manager
                        .get_or_create_tunnel(
                            config.id.as_deref().unwrap_or("temp"),
                            ssh_config,
                            config.host.clone(),
                            config.port,
                        )
                        .await?;
                    ("127.0.0.1".to_string(), local_port)
                } else {
                    return Err(anyhow::anyhow!("SSH configuration missing"));
                }
            }
            _ => (config.host.clone(), config.port),
        };

        let mut options = MySqlConnectOptions::new()
            .host(&host)
            .port(port)
            .username(&config.username)
            .password(&config.password);

        if let Some(ref database) = config.database {
            options = options.database(database);
        }

        // Set character set and collation for the connection
        options = options.charset("utf8mb4").collation("utf8mb4_unicode_ci");

        // Configure SSL if needed
        match config.connection_type {
            ConnectionType::Ssl => {
                if let Some(ref ssl_config) = config.ssl_config {
                    options = configure_ssl(options, ssl_config)?;
                }
            }
            ConnectionType::Direct => {
                // Check if SSL config exists even for direct connections
                if let Some(ref ssl_config) = config.ssl_config {
                    if ssl_config.ssl_mode != "disabled" {
                        options = configure_ssl(options, ssl_config)?;
                    }
                }
            }
            _ => {}
        }

        let pool = MySqlPoolOptions::new()
            .max_connections(20)
            .min_connections(2)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(std::time::Duration::from_secs(300))
            .max_lifetime(std::time::Duration::from_secs(1800))
            .test_before_acquire(true)
            .connect_with(options)
            .await?;

        Ok(pool)
    }

    pub async fn get_or_create_pool(
        &self,
        connection_id: &str,
        config: &ConnectionConfig,
    ) -> anyhow::Result<DbPool> {
        let pools = self.pools.read().await;
        if let Some(pool) = pools.get(connection_id) {
            // Test if pool is still valid
            if sqlx::query("SELECT 1").fetch_optional(pool).await.is_ok() {
                return Ok(pool.clone());
            }
        }
        drop(pools);

        // Create new pool
        let pool = self.create_pool(config).await?;
        let mut pools = self.pools.write().await;
        pools.insert(connection_id.to_string(), pool.clone());

        Ok(pool)
    }

    pub async fn remove_pool(&self, connection_id: &str) {
        let mut pools = self.pools.write().await;
        if let Some(pool) = pools.remove(connection_id) {
            let _ = pool.close().await;
        }
        
        // Also close SSH tunnel if exists
        let _ = self.ssh_manager.close_tunnel(connection_id).await;
    }

    pub async fn test_connection(&self, config: &ConnectionConfig) -> anyhow::Result<String> {
        let pool = self.create_pool(config).await?;
        let row: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&pool)
            .await?;
        pool.close().await;
        
        // Clean up temporary SSH tunnel if created
        if config.connection_type == ConnectionType::SshTunnel {
            if let Some(ref id) = config.id {
                let _ = self.ssh_manager.close_tunnel(id).await;
            }
        }
        
        Ok(row.0)
    }

    pub async fn get_pool_stats(&self, connection_id: &str) -> Option<PoolStats> {
        let pools = self.pools.read().await;
        pools.get(connection_id).map(|pool| PoolStats {
            size: pool.size(),
            idle_connections: pool.num_idle() as u32,
            is_closed: pool.is_closed(),
        })
    }

    pub async fn close_all_pools(&self) {
        let mut pools = self.pools.write().await;
        for (_, pool) in pools.drain() {
            let _ = pool.close().await;
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PoolStats {
    pub size: u32,
    pub idle_connections: u32,
    pub is_closed: bool,
}

fn configure_ssl(
    options: MySqlConnectOptions,
    ssl_config: &SslConfig,
) -> anyhow::Result<MySqlConnectOptions> {
    let ssl_mode = match ssl_config.ssl_mode.as_str() {
        "disabled" => MySqlSslMode::Disabled,
        "preferred" => MySqlSslMode::Preferred,
        "required" => MySqlSslMode::Required,
        "verify_ca" => MySqlSslMode::VerifyCa,
        "verify_identity" => MySqlSslMode::VerifyIdentity,
        _ => MySqlSslMode::Preferred,
    };

        let options = options.ssl_mode(ssl_mode);

    // Note: sqlx doesn't directly support setting CA/Cert/Key files in the same way as native drivers
    // In a production app, you might need to use native-tls or rustls directly
    // For now, we set the SSL mode which enables basic SSL encryption
    
    if let Some(ref cipher) = ssl_config.ssl_cipher {
        // Cipher configuration would require lower-level SSL context manipulation
        // This is a placeholder for future implementation
        println!("SSL Cipher requested: {}", cipher);
    }

    Ok(options)
}
