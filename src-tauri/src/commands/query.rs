use crate::models::connection::{ConnectionConfig, ConnectionInfo};
use crate::models::query::{ColumnInfo, QueryResult};
use crate::AppState;
use serde_json::Value;
use sqlx::{Column, Executor};
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
    database: Option<String>,
    sql: String,
) -> Result<QueryResult, String> {
    let pool_id = if let Some(ref db) = database {
        format!("{}_{}", connection_id, db)
    } else {
        connection_id.clone()
    };
    
    let mut config = get_connection_config(&state, &connection_id).await?;
    if let Some(ref db) = database {
        config.database = Some(db.clone());
    }

    let pool = state
        .pool
        .get_or_create_pool(
            &pool_id,
            &config,
        )
        .await
        .map_err(|e| e.to_string())?;

    let start_time = std::time::Instant::now();

    // Helper to check if a query is a SELECT query ignoring leading comments and whitespace
    fn is_select_query(sql: &str) -> bool {
        let mut chars = sql.chars().peekable();
        while let Some(&c) = chars.peek() {
            if c.is_whitespace() {
                chars.next();
            } else if c == '-' {
                chars.next();
                if chars.peek() == Some(&'-') {
                    while let Some(c) = chars.next() {
                        if c == '\n' { break; }
                    }
                } else {
                    return false;
                }
            } else if c == '/' {
                chars.next();
                if chars.peek() == Some(&'*') {
                    chars.next();
                    let mut prev = ' ';
                    while let Some(curr) = chars.next() {
                        if prev == '*' && curr == '/' { break; }
                        prev = curr;
                    }
                } else {
                    return false;
                }
            } else {
                break;
            }
        }
        
        let mut first_word = String::new();
        while let Some(c) = chars.next() {
            if c.is_alphabetic() {
                first_word.push(c.to_ascii_uppercase());
            } else if c.is_whitespace() && !first_word.is_empty() {
                break;
            } else if !c.is_whitespace() {
                break;
            }
        }
        
        matches!(first_word.as_str(), "SELECT" | "SHOW" | "DESCRIBE" | "EXPLAIN" | "DESC" | "WITH")
    }

    let is_select = is_select_query(&sql);

    if is_select {
        // Execute SELECT query
        let rows = sqlx::query(&sql)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;



        // Get column info
        let columns: Vec<ColumnInfo> = if !rows.is_empty() {
            // Get from first row
            rows[0]
                .columns()
                .iter()
                .map(|col| ColumnInfo {
                    name: col.name().to_string(),
                    data_type: col.type_info().to_string(),
                    is_nullable: None,
                    max_length: None,
                })
                .collect()
        } else {
            // Try to describe the query to get columns even if no rows
            match pool.describe(&sql).await {
                Ok(describe) => {
                    let describe: sqlx::Describe<sqlx::MySql> = describe;
                    describe
                        .columns
                        .iter()
                        .map(|col| ColumnInfo {
                            name: col.name().to_string(),
                            data_type: col.type_info().to_string(),
                            is_nullable: None,
                            max_length: None,
                        })
                        .collect::<Vec<ColumnInfo>>()
                }
                Err(_) => vec![], // Fallback to empty if describe fails
            }
        };

        // Convert rows to Vec<Value>
        let query_rows: Vec<Vec<Value>> = rows
            .iter()
            .map(|row| {
                columns
                    .iter()
                    .enumerate()
                    .map(|(idx, _)| {
                        use sqlx::ValueRef;
                        let is_null = row.try_get_raw(idx).map(|v| v.is_null()).unwrap_or(true);
                        if is_null {
                            Value::Null
                        } else if let Ok(val) = row.try_get::<String, _>(idx) {
                            Value::String(val)
                        } else if let Ok(val) = row.try_get::<i64, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<u64, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<i32, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<u32, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<i16, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<u16, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<i8, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<u8, _>(idx) {
                            Value::Number(val.into())
                        } else if let Ok(val) = row.try_get::<f64, _>(idx) {
                            serde_json::Number::from_f64(val)
                                .map(Value::Number)
                                .unwrap_or(Value::Null)
                        } else if let Ok(val) = row.try_get::<f32, _>(idx) {
                            serde_json::Number::from_f64(val as f64)
                                .map(Value::Number)
                                .unwrap_or(Value::Null)
                        } else if let Ok(val) = row.try_get::<bool, _>(idx) {
                            Value::Bool(val)
                        } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(idx) {
                            Value::String(val.to_string())
                        } else if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(idx) {
                            Value::String(val.to_string())
                        } else if let Ok(val) = row.try_get::<chrono::NaiveTime, _>(idx) {
                            Value::String(val.to_string())
                        } else if let Ok(val) = row.try_get::<serde_json::Value, _>(idx) {
                            val
                        } else if let Ok(val) = row.try_get::<Vec<u8>, _>(idx) {
                            if let Ok(s) = String::from_utf8(val) {
                                Value::String(s)
                            } else {
                                Value::Null
                            }
                        } else {
                            Value::Null
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
            use sqlx::ValueRef;
            let is_null = row.try_get_raw(idx).map(|v| v.is_null()).unwrap_or(true);
            let value = if is_null {
                Value::Null
            } else if let Ok(val) = row.try_get::<String, _>(idx) {
                Value::String(val)
            } else if let Ok(val) = row.try_get::<i64, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<u64, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<i32, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<u32, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<i16, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<u16, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<i8, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<u8, _>(idx) {
                Value::Number(val.into())
            } else if let Ok(val) = row.try_get::<f64, _>(idx) {
                serde_json::Number::from_f64(val)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            } else if let Ok(val) = row.try_get::<f32, _>(idx) {
                serde_json::Number::from_f64(val as f64)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            } else if let Ok(val) = row.try_get::<bool, _>(idx) {
                Value::Bool(val)
            } else if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(idx) {
                Value::String(val.to_string())
            } else if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(idx) {
                Value::String(val.to_string())
            } else if let Ok(val) = row.try_get::<chrono::NaiveTime, _>(idx) {
                Value::String(val.to_string())
            } else if let Ok(val) = row.try_get::<serde_json::Value, _>(idx) {
                val
            } else if let Ok(val) = row.try_get::<Vec<u8>, _>(idx) {
                if let Ok(s) = String::from_utf8(val) {
                    Value::String(s)
                } else {
                    Value::Null
                }
            } else {
                Value::Null
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
    execute_query(state, connection_id, Some(database), sql).await
}
