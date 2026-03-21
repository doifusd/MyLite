use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions};
use sqlx::{MySql, Pool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::connection::ConnectionConfig;

pub type DbPool = Pool<MySql>;

#[derive(Clone)]
pub struct ConnectionPool {
    pools: Arc<RwLock<HashMap<String, DbPool>>>,
}

impl ConnectionPool {
    pub async fn new() -> anyhow::Result<Self> {
        Ok(Self {
            pools: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn create_pool(&self, config: &ConnectionConfig) -> anyhow::Result<DbPool> {
        let mut options = MySqlConnectOptions::new()
            .host(&config.host)
            .port(config.port)
            .username(&config.username)
            .password(&config.password);

        if let Some(ref database) = config.database {
            options = options.database(database);
        }

        if config.use_ssl {
            // SSL configuration would go here
            // options = options.ssl_mode(sqlx::mysql::MySqlSslMode::Required);
        }

        let pool = MySqlPoolOptions::new()
            .max_connections(10)
            .min_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(std::time::Duration::from_secs(600))
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
    }

    pub async fn test_connection(&self, config: &ConnectionConfig) -> anyhow::Result<String> {
        let pool = self.create_pool(config).await?;
        let row: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&pool)
            .await?;
        pool.close().await;
        Ok(row.0)
    }
}
