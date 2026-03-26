use crate::models::query::{QueryHistoryFilter, QueryHistoryItem};
use crate::AppState;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

pub const QUERY_HISTORY_KEY: &str = "query_history";
pub const MAX_HISTORY_ITEMS: usize = 1000;

/// Get query history from store
pub fn get_history_from_store(
    store: &std::sync::Mutex<tauri_plugin_store::Store<tauri::Wry>>,
) -> Result<Vec<QueryHistoryItem>, String> {
    let store_lock = store.lock().map_err(|e| e.to_string())?;
    match store_lock.get(QUERY_HISTORY_KEY) {
        Some(value) => {
            let history: Vec<QueryHistoryItem> = serde_json::from_value::<Vec<QueryHistoryItem>>(value.clone())
                .map_err(|e| format!("Failed to parse query history: {}", e))?;
            Ok(history)
        }
        None => Ok(vec![]),
    }
}

/// Save query history to store
pub fn save_history_to_store(
    store: &std::sync::Mutex<tauri_plugin_store::Store<tauri::Wry>>,
    history: &[QueryHistoryItem],
) -> Result<(), String> {
    let mut store_lock = store.lock().map_err(|e| e.to_string())?;
    let value = serde_json::to_value(history).map_err(|e| e.to_string())?;
    let _ = store_lock.insert(QUERY_HISTORY_KEY.to_string(), value);
    store_lock.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Internal function to add query to history (for use within the crate)
pub async fn add_query_to_history_internal(
    state: &State<'_, Arc<AppState>>,
    connection_id: String,
    database: Option<String>,
    sql: String,
    execution_time_ms: u64,
    row_count: usize,
    affected_rows: Option<u64>,
    success: bool,
    error_message: Option<String>,
) -> Result<QueryHistoryItem, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut history = get_history_from_store(&store)?;

    let item = QueryHistoryItem {
        id: Uuid::new_v4().to_string(),
        connection_id,
        database,
        sql: sql.trim().to_string(),
        executed_at: chrono::Local::now().to_rfc3339(),
        execution_time_ms,
        row_count,
        affected_rows,
        success,
        error_message,
        is_favorite: false,
        tags: vec![],
    };

    // Add to beginning (most recent first)
    history.insert(0, item.clone());

    // Keep only the latest MAX_HISTORY_ITEMS
    if history.len() > MAX_HISTORY_ITEMS {
        history.truncate(MAX_HISTORY_ITEMS);
    }

    save_history_to_store(&store, &history)?;

    Ok(item)
}

/// Add a query to history (Tauri command)
#[tauri::command]
pub async fn add_query_to_history(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: Option<String>,
    sql: String,
    execution_time_ms: u64,
    row_count: usize,
    affected_rows: Option<u64>,
    success: bool,
    error_message: Option<String>,
) -> Result<QueryHistoryItem, String> {
    add_query_to_history_internal(
        &state,
        connection_id,
        database,
        sql,
        execution_time_ms,
        row_count,
        affected_rows,
        success,
        error_message,
    ).await
}

/// Get query history with optional filtering
#[tauri::command]
pub async fn get_query_history(
    state: State<'_, Arc<AppState>>,
    filter: Option<QueryHistoryFilter>,
    limit: Option<usize>,
) -> Result<Vec<QueryHistoryItem>, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let history = get_history_from_store(&store)?;

    let filtered = if let Some(filter) = filter {
        let from_date = filter.from_date.clone();
        let to_date = filter.to_date.clone();
        history
            .into_iter()
            .filter(|item| {
                // Filter by connection_id
                if let Some(ref conn_id) = filter.connection_id {
                    if item.connection_id != *conn_id {
                        return false;
                    }
                }

                // Filter by database
                if let Some(ref db) = filter.database {
                    if item.database.as_ref() != Some(db) {
                        return false;
                    }
                }

                // Filter by search query (matches SQL content)
                if let Some(ref search) = filter.search_query {
                    let search_lower = search.to_lowercase();
                    if !item.sql.to_lowercase().contains(&search_lower) {
                        return false;
                    }
                }

                // Filter by success status
                if let Some(success_only) = filter.success_only {
                    if success_only && !item.success {
                        return false;
                    }
                }

                // Filter by favorites
                if let Some(favorites_only) = filter.favorites_only {
                    if favorites_only && !item.is_favorite {
                        return false;
                    }
                }

                // Filter by tags
                if let Some(ref tags) = filter.tags {
                    if !tags.iter().all(|tag| item.tags.contains(tag)) {
                        return false;
                    }
                }

                // Filter by date range
                if let (Some(ref from), Some(ref to)) = (&from_date, &to_date) {
                    if item.executed_at < *from || item.executed_at > *to {
                        return false;
                    }
                } else if let Some(ref from) = &from_date {
                    if item.executed_at < *from {
                        return false;
                    }
                } else if let Some(ref to) = &to_date {
                    if item.executed_at > *to {
                        return false;
                    }
                }

                true
            })
            .collect()
    } else {
        history
    };

    // Apply limit
    let limit = limit.unwrap_or(100);
    let result: Vec<QueryHistoryItem> = filtered.into_iter().take(limit).collect();

    Ok(result)
}

/// Delete a query history item
#[tauri::command]
pub async fn delete_query_history_item(
    state: State<'_, Arc<AppState>>,
    item_id: String,
) -> Result<(), String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut history = get_history_from_store(&store)?;
    history.retain(|item| item.id != item_id);

    save_history_to_store(&store, &history)?;
    Ok(())
}

/// Clear all query history
#[tauri::command]
pub async fn clear_query_history(
    state: State<'_, Arc<AppState>>,
    connection_id: Option<String>,
) -> Result<(), String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    if let Some(conn_id) = connection_id {
        // Clear only for specific connection
        let mut history = get_history_from_store(&store)?;
        history.retain(|item| item.connection_id != conn_id);
        save_history_to_store(&store, &history)?;
    } else {
        // Clear all history
        save_history_to_store(&store, &[])?;
    }

    Ok(())
}

/// Toggle favorite status for a query history item
#[tauri::command]
pub async fn toggle_query_history_favorite(
    state: State<'_, Arc<AppState>>,
    item_id: String,
) -> Result<QueryHistoryItem, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut history = get_history_from_store(&store)?;

    if let Some(item) = history.iter_mut().find(|i| i.id == item_id) {
        item.is_favorite = !item.is_favorite;
        let updated_item = item.clone();
        save_history_to_store(&store, &history)?;
        Ok(updated_item)
    } else {
        Err("Query history item not found".to_string())
    }
}

/// Add tags to a query history item
#[tauri::command]
pub async fn add_query_history_tags(
    state: State<'_, Arc<AppState>>,
    item_id: String,
    tags: Vec<String>,
) -> Result<QueryHistoryItem, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut history = get_history_from_store(&store)?;

    if let Some(item) = history.iter_mut().find(|i| i.id == item_id) {
        for tag in tags {
            if !item.tags.contains(&tag) {
                item.tags.push(tag);
            }
        }
        let updated_item = item.clone();
        save_history_to_store(&store, &history)?;
        Ok(updated_item)
    } else {
        Err("Query history item not found".to_string())
    }
}

/// Remove tags from a query history item
#[tauri::command]
pub async fn remove_query_history_tags(
    state: State<'_, Arc<AppState>>,
    item_id: String,
    tags: Vec<String>,
) -> Result<QueryHistoryItem, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let mut history = get_history_from_store(&store)?;

    if let Some(item) = history.iter_mut().find(|i| i.id == item_id) {
        item.tags.retain(|t| !tags.contains(t));
        let updated_item = item.clone();
        save_history_to_store(&store, &history)?;
        Ok(updated_item)
    } else {
        Err("Query history item not found".to_string())
    }
}

/// Get all unique tags from query history
#[tauri::command]
pub async fn get_query_history_tags(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let history = get_history_from_store(&store)?;

    let mut tags: Vec<String> = history
        .iter()
        .flat_map(|item| item.tags.clone())
        .collect();

    tags.sort();
    tags.dedup();

    Ok(tags)
}

/// Get query statistics
#[tauri::command]
pub async fn get_query_history_stats(
    state: State<'_, Arc<AppState>>,
    connection_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let history = get_history_from_store(&store)?;

    let filtered: Vec<_> = if let Some(conn_id) = connection_id {
        history.into_iter().filter(|i| i.connection_id == conn_id).collect()
    } else {
        history
    };

    let total_queries = filtered.len();
    let successful_queries = filtered.iter().filter(|i| i.success).count();
    let failed_queries = total_queries - successful_queries;
    let favorite_queries = filtered.iter().filter(|i| i.is_favorite).count();

    let avg_execution_time = if total_queries > 0 {
        filtered.iter().map(|i| i.execution_time_ms).sum::<u64>() / total_queries as u64
    } else {
        0
    };

    let stats = serde_json::json!({
        "total_queries": total_queries,
        "successful_queries": successful_queries,
        "failed_queries": failed_queries,
        "favorite_queries": favorite_queries,
        "average_execution_time_ms": avg_execution_time,
    });

    Ok(stats)
}
