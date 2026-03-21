use crate::models::connection::{ConnectionConfig, ConnectionInfo};
use crate::models::query::{ColumnInfo, QueryResult};
use crate::AppState;
use serde_json::Value;
use sqlx::Column;
use sqlx::Row;
use std::sync::Arc;
use tauri::State;

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

// Helper function to get connection config from store
async fn get_connection_config(
    state: &State<'_, Arc<AppState>>,
    connection_id: &str,
) -> Result<ConnectionConfig, String> {
    let store = state
        .get_store()
        .map_err(|e| format!("Failed to get store: {}", e))?;

    let connections = get_connections_from_store(&store)?;
    
    let info = connections
        .into_iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| "Connection not found".to_string())?;

    // For now, we construct a basic config without password
    // In production, password should be retrieved from secure storage
    Ok(ConnectionConfig {
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
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    sql: String,
) -> Result<QueryResult, String> {
    let pool = state
        .pool
        .get_or_create_pool(
            &connection_id,
            &get_connection_config(&state, &connection_id).await?,
        )
        .await
        .map_err(|e| e.to_string())?;

    let start_time = std::time::Instant::now();

    // Check if it's a SELECT query or other type
    let trimmed_sql = sql.trim().to_uppercase();
    let is_select = trimmed_sql.starts_with("SELECT")
        || trimmed_sql.starts_with("SHOW")
        || trimmed_sql.starts_with("DESCRIBE")
        || trimmed_sql.starts_with("EXPLAIN")
        || trimmed_sql.starts_with("DESC");

    if is_select {
        // Execute SELECT query
        let rows = sqlx::query(&sql)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;

        if rows.is_empty() {
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                row_count: 0,
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                affected_rows: None,
                last_insert_id: None,
            });
        }

        // Get column info from first row
        let first_row = &rows[0];
        let columns: Vec<ColumnInfo> = first_row
            .columns()
            .iter()
            .map(|col| ColumnInfo {
                name: col.name().to_string(),
                data_type: col.type_info().to_string(),
                is_nullable: None,
                max_length: None,
            })
            .collect();

        // Convert rows to Vec<Value>
        let query_rows: Vec<Vec<Value>> = rows
            .iter()
            .map(|row| {
                columns
                    .iter()
                    .enumerate()
                    .map(|(idx, _)| {
                        // Try to get value as different types
                        if let Ok(val) = row.try_get::<String, _>(idx) {
                            Value::String(val)
                        } else if let Ok(val) = row.try_get::<i64, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<f64, _>(idx) {
                            serde_json::Number::from_f64(val)
                                .map(Value::Number)
                                .unwrap_or(Value::Null)
                        } else if let Ok(val) = row.try_get::<bool, _>(idx) {
                            Value::Bool(val)
                        } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(idx) {
                            Value::String(val.to_string())
                        } else if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(idx) {
                            Value::String(val.to_string())
                        } else if row.try_get::<Option<String>, _>(idx).unwrap_or(None).is_none() {
                            Value::Null
                        } else {
                            // Try as string as fallback
                            row.try_get::<String, _>(idx)
                                .map(Value::String)
                                .unwrap_or(Value::Null)
                        }
                    })
                    .collect()
            })
            .collect();

        let row_count = query_rows.len();
        Ok(QueryResult {
            columns,
            rows: query_rows,
            row_count,
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            affected_rows: None,
            last_insert_id: None,
        })
    } else {
        // Execute non-SELECT query (INSERT, UPDATE, DELETE, etc.)
        let result = sqlx::query(&sql)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            affected_rows: Some(result.rows_affected()),
            last_insert_id: Some(result.last_insert_id()),
        })
    }
}

#[tauri::command]
pub async fn execute_raw_query(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    sql: String,
) -> Result<Vec<Value>, String> {
    let pool = state
        .pool
        .get_or_create_pool(
            &connection_id,
            &get_connection_config(&state, &connection_id).await?,
        )
        .await
        .map_err(|e| e.to_string())?;

    let rows = sqlx::query(&sql)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for row in rows {
        let mut obj = serde_json::Map::new();

        for (idx, column) in row.columns().iter().enumerate() {
            let col_name = column.name();
            let value = if let Ok(val) = row.try_get::<String, _>(idx) {
                Value::String(val)
            } else if let Ok(val) = row.try_get::<i64, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<f64, _>(idx) {
                serde_json::Number::from_f64(val)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            } else if let Ok(val) = row.try_get::<bool, _>(idx) {
                Value::Bool(val)
            } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(idx) {
                Value::String(val.to_string())
            } else if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(idx) {
                Value::String(val.to_string())
            } else if row.try_get::<Option<String>, _>(idx).unwrap_or(None).is_none() {
                Value::Null
            } else {
                row.try_get::<String, _>(idx)
                    .map(Value::String)
                    .unwrap_or(Value::Null)
            };
            obj.insert(col_name.to_string(), value);
        }

        result.push(Value::Object(obj));
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_table_preview(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: String,
    table: String,
    limit: Option<u32>,
) -> Result<QueryResult, String> {
    let limit = limit.unwrap_or(100);
    let sql = format!("SELECT * FROM `{}`.`{}` LIMIT {}", database, table, limit);
    execute_query(state, connection_id, sql).await
}
