use crate::models::connection::{ConnectionConfig, ConnectionInfo, ConnectionTestResult};
use crate::AppState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn test_connection(
    state: State<'_, Arc<AppState>>,
    config: ConnectionConfig,
) -> Result<ConnectionTestResult, String> {
    match state.pool.test_connection(&config).await {
        Ok(version) => Ok(ConnectionTestResult {
            success: true,
            message: format!("Connected successfully! MySQL version: {}", version),
            server_version: Some(version),
        }),
        Err(e) => Ok(ConnectionTestResult {
            success: false,
            message: format!("Connection failed: {}", e),
            server_version: None,
        }),
    }
}

#[tauri::command]
pub async fn save_connection(
    state: State<'_, Arc<AppState>>,
    config: ConnectionConfig,
) -> Result<ConnectionInfo, String> {
    // Save to store
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;
    
    let id = config.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    
    // Update or add connection
    let mut updated = connections
        .into_iter()
        .filter(|c| c.id != id)
        .collect::<Vec<_>>();
    updated.push(ConnectionInfo {
        id: id.clone(),
        name: config.name.clone(),
        host: config.host.clone(),
        port: config.port,
        username: config.username.clone(),
        password: config.password.clone(),
        database: config.database.clone(),
        color: config.color.clone(),
        connection_type: config.connection_type.clone(),
        ssh_config: config.ssh_config.clone(),
        ssl_config: config.ssl_config.clone(),
        http_config: config.http_config.clone(),
    });

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock.insert("connections".to_string(), serde_json::json!(updated)).map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(ConnectionInfo {
        id,
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
    })
}

#[tauri::command]
pub async fn get_connections(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<ConnectionInfo>, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    get_connections_from_store(&store)
}

#[tauri::command]
pub async fn delete_connection(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<(), String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;
    let filtered: Vec<ConnectionInfo> = connections
        .into_iter()
        .filter(|c| c.id != connection_id)
        .collect();

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock.insert("connections".to_string(), serde_json::json!(filtered)).map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    // Also remove the connection pool and SSH tunnel
    state.pool.remove_pool(&connection_id).await;

    Ok(())
}

#[tauri::command]
pub async fn get_connection_detail(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<ConnectionConfig, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;
    
    // Find the connection and return full config
    connections
        .into_iter()
        .find(|c| c.id == connection_id)
        .map(|info| ConnectionConfig {
            id: Some(info.id),
            name: info.name,
            host: info.host,
            port: info.port,
            username: info.username,
            password: info.password,
            database: info.database,
            color: info.color,
            connection_type: info.connection_type,
            ssh_config: info.ssh_config,
            ssl_config: info.ssl_config,
            http_config: info.http_config,
        })
        .ok_or_else(|| "Connection not found".to_string())
}

fn get_connections_from_store(
    store: &std::sync::Mutex<tauri_plugin_store::Store<tauri::Wry>>,
) -> Result<Vec<ConnectionInfo>, String> {
    let store_lock = store.lock().map_err(|e| e.to_string())?;
    match store_lock.get("connections") {
        Some(value) => {
            let connections: Vec<ConnectionInfo> = serde_json::from_value::<Vec<ConnectionInfo>>(value.clone())
                .map_err(|e| format!("Failed to parse connections: {}", e))?;
            Ok(connections)
        }
        None => Ok(vec![]),
    }
}
