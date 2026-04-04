use crate::models::connection::{
    ConnectionConfig, ConnectionFilter, ConnectionGroup, ConnectionInfo, ConnectionTestResult,
    QuickConnectTemplate,
};
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

    let id = config
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

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
        group: config.group.clone(),
        is_favorite: config.is_favorite,
        sort_order: config.sort_order,
        tags: config.tags.clone(),
        last_connected_at: config.last_connected_at.clone(),
    });

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert("connections".to_string(), serde_json::json!(updated))
            .map_err(|e| e.to_string())?;
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
        group: config.group,
        is_favorite: config.is_favorite,
        sort_order: config.sort_order,
        tags: config.tags,
        last_connected_at: config.last_connected_at,
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
        store_lock
            .insert("connections".to_string(), serde_json::json!(filtered))
            .map_err(|e| e.to_string())?;
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
            group: info.group,
            is_favorite: info.is_favorite,
            sort_order: info.sort_order,
            tags: info.tags,
            last_connected_at: info.last_connected_at,
        })
        .ok_or_else(|| "Connection not found".to_string())
}

// Phase 4.1: Toggle favorite status
#[tauri::command]
pub async fn toggle_connection_favorite(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<ConnectionInfo, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;

    let mut connection = connections
        .clone()
        .into_iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| "Connection not found".to_string())?;

    connection.is_favorite = !connection.is_favorite;

    // Save back
    let updated: Vec<ConnectionInfo> = connections
        .into_iter()
        .map(|c| {
            if c.id == connection_id {
                connection.clone()
            } else {
                c
            }
        })
        .collect();

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert("connections".to_string(), serde_json::json!(updated))
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(connection)
}

// Phase 4.1: Update connection group
#[tauri::command]
pub async fn update_connection_group(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    group: Option<String>,
) -> Result<ConnectionInfo, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;

    let mut connection = connections
        .clone()
        .into_iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| "Connection not found".to_string())?;

    connection.group = group;

    // Save back
    let updated: Vec<ConnectionInfo> = connections
        .into_iter()
        .map(|c| {
            if c.id == connection_id {
                connection.clone()
            } else {
                c
            }
        })
        .collect();

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert("connections".to_string(), serde_json::json!(updated))
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(connection)
}

// Phase 4.1: Update last connected timestamp
#[tauri::command]
pub async fn update_connection_last_connected(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<(), String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;
    let now = chrono::Utc::now().to_rfc3339();

    let updated: Vec<ConnectionInfo> = connections
        .into_iter()
        .map(|mut c| {
            if c.id == connection_id {
                c.last_connected_at = Some(now.clone());
            }
            c
        })
        .collect();

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert("connections".to_string(), serde_json::json!(updated))
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Phase 4.1: Connection groups management
#[tauri::command]
pub async fn get_connection_groups(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<ConnectionGroup>, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let store_lock = store.lock().map_err(|e| e.to_string())?;
    match store_lock.get("connection_groups") {
        Some(value) => {
            let groups: Vec<ConnectionGroup> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse groups: {}", e))?;
            Ok(groups)
        }
        None => Ok(vec![]),
    }
}

#[tauri::command]
pub async fn save_connection_group(
    state: State<'_, Arc<AppState>>,
    group: ConnectionGroup,
) -> Result<ConnectionGroup, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut groups = get_connection_groups_internal(&store)?;

    // Update or add
    groups.retain(|g| g.id != group.id);
    groups.push(group.clone());

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert("connection_groups".to_string(), serde_json::json!(groups))
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(group)
}

#[tauri::command]
pub async fn delete_connection_group(
    state: State<'_, Arc<AppState>>,
    group_id: String,
) -> Result<(), String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut groups = get_connection_groups_internal(&store)?;
    groups.retain(|g| g.id != group_id);

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert("connection_groups".to_string(), serde_json::json!(groups))
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    // Also clear group from connections
    let connections = get_connections_from_store(&store)?;
    let updated_connections: Vec<ConnectionInfo> = connections
        .into_iter()
        .map(|mut c| {
            if c.group.as_ref() == Some(&group_id) {
                c.group = None;
            }
            c
        })
        .collect();

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert(
                "connections".to_string(),
                serde_json::json!(updated_connections),
            )
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Phase 4.1: Quick connect templates
#[tauri::command]
pub async fn get_quick_connect_templates(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<QuickConnectTemplate>, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let store_lock = store.lock().map_err(|e| e.to_string())?;
    match store_lock.get("quick_connect_templates") {
        Some(value) => {
            let templates: Vec<QuickConnectTemplate> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse templates: {}", e))?;
            Ok(templates)
        }
        None => Ok(vec![]),
    }
}

#[tauri::command]
pub async fn save_quick_connect_template(
    state: State<'_, Arc<AppState>>,
    template: QuickConnectTemplate,
) -> Result<QuickConnectTemplate, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut templates = get_quick_connect_templates_internal(&store)?;

    // Update or add
    templates.retain(|t| t.id != template.id);
    templates.push(template.clone());

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert(
                "quick_connect_templates".to_string(),
                serde_json::json!(templates),
            )
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(template)
}

#[tauri::command]
pub async fn delete_quick_connect_template(
    state: State<'_, Arc<AppState>>,
    template_id: String,
) -> Result<(), String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut templates = get_quick_connect_templates_internal(&store)?;
    templates.retain(|t| t.id != template_id);

    {
        let mut store_lock = store.lock().map_err(|e| e.to_string())?;
        store_lock
            .insert(
                "quick_connect_templates".to_string(),
                serde_json::json!(templates),
            )
            .map_err(|e| e.to_string())?;
        store_lock.save().map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Phase 4.1: Filter and sort connections
#[tauri::command]
pub async fn filter_connections(
    state: State<'_, Arc<AppState>>,
    filter: ConnectionFilter,
) -> Result<Vec<ConnectionInfo>, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;

    // Apply filters
    let mut filtered: Vec<ConnectionInfo> = connections
        .into_iter()
        .filter(|c| {
            // Search filter
            if let Some(ref search) = filter.search {
                let search_lower = search.to_lowercase();
                if !c.name.to_lowercase().contains(&search_lower)
                    && !c.host.to_lowercase().contains(&search_lower)
                    && !c.username.to_lowercase().contains(&search_lower)
                {
                    return false;
                }
            }

            // Group filter
            if let Some(ref group_id) = filter.group_id {
                if c.group.as_ref() != Some(group_id) {
                    return false;
                }
            }

            // Tags filter
            if !filter.tags.is_empty() {
                if !filter.tags.iter().all(|tag| c.tags.contains(tag)) {
                    return false;
                }
            }

            // Favorite filter
            if let Some(is_fav) = filter.is_favorite {
                if c.is_favorite != is_fav {
                    return false;
                }
            }

            true
        })
        .collect();

    // Apply sorting
    match filter.sort_by {
        crate::models::connection::ConnectionSortBy::Name => {
            filtered.sort_by(|a, b| a.name.cmp(&b.name));
        }
        crate::models::connection::ConnectionSortBy::LastConnected => {
            filtered.sort_by(|a, b| b.last_connected_at.cmp(&a.last_connected_at));
        }
        crate::models::connection::ConnectionSortBy::CreatedAt => {
            // Sort by ID (UUID contains timestamp)
            filtered.sort_by(|a, b| a.id.cmp(&b.id));
        }
        crate::models::connection::ConnectionSortBy::Host => {
            filtered.sort_by(|a, b| a.host.cmp(&b.host));
        }
    }

    if !filter.sort_ascending {
        filtered.reverse();
    }

    Ok(filtered)
}

fn get_connections_from_store(
    store: &std::sync::Mutex<tauri_plugin_store::Store<tauri::Wry>>,
) -> Result<Vec<ConnectionInfo>, String> {
    let store_lock = store.lock().map_err(|e| e.to_string())?;
    match store_lock.get("connections") {
        Some(value) => {
            let connections: Vec<ConnectionInfo> =
                serde_json::from_value::<Vec<ConnectionInfo>>(value.clone())
                    .map_err(|e| format!("Failed to parse connections: {}", e))?;
            Ok(connections)
        }
        None => Ok(vec![]),
    }
}

fn get_connection_groups_internal(
    store: &std::sync::Mutex<tauri_plugin_store::Store<tauri::Wry>>,
) -> Result<Vec<ConnectionGroup>, String> {
    let store_lock = store.lock().map_err(|e| e.to_string())?;
    match store_lock.get("connection_groups") {
        Some(value) => {
            let groups: Vec<ConnectionGroup> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse groups: {}", e))?;
            Ok(groups)
        }
        None => Ok(vec![]),
    }
}

fn get_quick_connect_templates_internal(
    store: &std::sync::Mutex<tauri_plugin_store::Store<tauri::Wry>>,
) -> Result<Vec<QuickConnectTemplate>, String> {
    let store_lock = store.lock().map_err(|e| e.to_string())?;
    match store_lock.get("quick_connect_templates") {
        Some(value) => {
            let templates: Vec<QuickConnectTemplate> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse templates: {}", e))?;
            Ok(templates)
        }
        None => Ok(vec![]),
    }
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE")) // Fallback for Windows
        .map_err(|_| "Failed to get home directory".to_string())
}
