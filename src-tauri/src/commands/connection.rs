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
    
    let info: ConnectionInfo = config.clone().into();
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
        use_ssl: config.use_ssl,
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
        use_ssl: config.use_ssl,
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

    // Also remove the connection pool
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
    
    // This is a placeholder - in a real implementation, you'd store the full config including password
    // For now, we return a simplified version
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
            use_ssl: info.use_ssl,
            ssl_ca: None,
            ssl_cert: None,
            ssl_key: None,
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
