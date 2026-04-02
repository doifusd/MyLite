use crate::commands::query_history::add_query_to_history_internal;
use crate::models::connection::{ConnectionConfig, ConnectionInfo};
use crate::models::query::{ColumnInfo, QueryResult};
use crate::AppState;
use rust_decimal::Decimal;
use serde_json::Value;
use sqlx::mysql::MySqlRow;
use sqlx::{Column, Executor, Row, TypeInfo, ValueRef};
use std::sync::Arc;
use tauri::State;

/// Helper function to convert a MySQL row value to JSON Value
/// Supports all MySQL 8.0+ data types
fn mysql_value_to_json(row: &MySqlRow, idx: usize) -> Value {
    // Get the value reference
    let value_ref = row.try_get_raw(idx).ok();

    // Check if value is null first
    if value_ref.as_ref().map(|v| v.is_null()).unwrap_or(true) {
        return Value::Null;
    }

    let value_ref = value_ref.unwrap();
    let type_info = value_ref.type_info();
    let type_name = type_info.name();

    // Try to decode based on type name
    match type_name {
        // Tiny integers (TINYINT)
        "TINYINT" => {
            if let Ok(val) = row.try_get::<i8, _>(idx) {
                return Value::Number(val.into());
            }
            if let Ok(val) = row.try_get::<u8, _>(idx) {
                return Value::Number(val.into());
            }
        }
        // Small integers (SMALLINT)
        "SMALLINT" => {
            if let Ok(val) = row.try_get::<i16, _>(idx) {
                return Value::Number(val.into());
            }
            if let Ok(val) = row.try_get::<u16, _>(idx) {
                return Value::Number(val.into());
            }
        }
        // Medium integers (MEDIUMINT)
        "MEDIUMINT" => {
            if let Ok(val) = row.try_get::<i32, _>(idx) {
                return Value::Number(val.into());
            }
        }
        // Regular integers (INT)
        "INT" | "INTEGER" => {
            if let Ok(val) = row.try_get::<i32, _>(idx) {
                return Value::Number(val.into());
            }
            if let Ok(val) = row.try_get::<u32, _>(idx) {
                return Value::Number(val.into());
            }
        }
        // Big integers (BIGINT)
        "BIGINT" => {
            if let Ok(val) = row.try_get::<i64, _>(idx) {
                return Value::Number(val.into());
            }
            if let Ok(val) = row.try_get::<u64, _>(idx) {
                // u64 may not fit in i64, convert to string
                return Value::String(val.to_string());
            }
        }
        // Floating point
        "FLOAT" => {
            if let Ok(val) = row.try_get::<f32, _>(idx) {
                return serde_json::Number::from_f64(val as f64)
                    .map(Value::Number)
                    .unwrap_or(Value::Null);
            }
        }
        "DOUBLE" => {
            if let Ok(val) = row.try_get::<f64, _>(idx) {
                return serde_json::Number::from_f64(val)
                    .map(Value::Number)
                    .unwrap_or(Value::Null);
            }
        }
        // Decimal - MySQL sends DECIMAL as ASCII text over the wire
        "DECIMAL" | "NUMERIC" => {
            // Try to decode as Decimal first (most accurate)
            if let Ok(val) = row.try_get::<Decimal, _>(idx) {
                return Value::String(val.to_string());
            }
            // MySQL sends DECIMAL as ASCII text, preserve exact decimal representation
            if let Ok(bytes) = row.try_get::<Vec<u8>, _>(idx) {
                if let Ok(s) = String::from_utf8(bytes) {
                    return Value::String(s);
                }
            }
            // Fallback: try as string
            if let Ok(val) = row.try_get::<String, _>(idx) {
                return Value::String(val);
            }
            // Last resort: convert to string from f64 (lossy)
            if let Ok(val) = row.try_get::<f64, _>(idx) {
                return Value::String(val.to_string());
            }
        }
        // Decimal unsigned variants
        "DECIMAL UNSIGNED" | "NUMERIC UNSIGNED" => {
            // Try to decode as Decimal first (most accurate)
            if let Ok(val) = row.try_get::<Decimal, _>(idx) {
                return Value::String(val.to_string());
            }
            // MySQL sends DECIMAL as ASCII text, preserve exact decimal representation
            if let Ok(bytes) = row.try_get::<Vec<u8>, _>(idx) {
                if let Ok(s) = String::from_utf8(bytes) {
                    return Value::String(s);
                }
            }
            // Fallback: try as string
            if let Ok(val) = row.try_get::<String, _>(idx) {
                return Value::String(val);
            }
            // Last resort: convert to string from f64 (lossy)
            if let Ok(val) = row.try_get::<f64, _>(idx) {
                return Value::String(val.to_string());
            }
        }
        // Boolean (TINYINT(1) in MySQL)
        "BOOLEAN" | "BOOL" => {
            if let Ok(val) = row.try_get::<bool, _>(idx) {
                return Value::Bool(val);
            }
        }
        // Date and time types
        "DATETIME" | "TIMESTAMP" => {
            if let Ok(val) = row.try_get::<chrono::NaiveDateTime, _>(idx) {
                return Value::String(val.to_string());
            }
        }
        "DATE" => {
            if let Ok(val) = row.try_get::<chrono::NaiveDate, _>(idx) {
                return Value::String(val.to_string());
            }
        }
        "TIME" => {
            if let Ok(val) = row.try_get::<chrono::NaiveTime, _>(idx) {
                return Value::String(val.to_string());
            }
        }
        "YEAR" => {
            if let Ok(val) = row.try_get::<i32, _>(idx) {
                return Value::Number(val.into());
            }
        }
        // JSON type
        "JSON" => {
            if let Ok(val) = row.try_get::<serde_json::Value, _>(idx) {
                return val;
            }
        }
        // Spatial types (MySQL 8.0+)
        "GEOMETRY" | "POINT" | "LINESTRING" | "POLYGON" | "MULTIPOINT" | "MULTILINESTRING"
        | "MULTIPOLYGON" | "GEOMETRYCOLLECTION" => {
            // Spatial data is stored as binary, convert to WKT or hex
            if let Ok(val) = row.try_get::<Vec<u8>, _>(idx) {
                return Value::String(format!("0x{}", hex::encode(&val)));
            }
        }
        // Binary types
        "BINARY" | "VARBINARY" | "TINYBLOB" | "BLOB" | "MEDIUMBLOB" | "LONGBLOB" | "BIT" => {
            if let Ok(val) = row.try_get::<Vec<u8>, _>(idx) {
                // Convert to hex string for binary data
                return Value::String(format!("0x{}", hex::encode(&val)));
            }
        }
        // String types (CHAR, VARCHAR, TEXT, ENUM, SET)
        "CHAR" | "VARCHAR" | "TINYTEXT" | "TEXT" | "MEDIUMTEXT" | "LONGTEXT" => {
            if let Ok(val) = row.try_get::<String, _>(idx) {
                return Value::String(val);
            }
        }
        // ENUM and SET types
        "ENUM" | "SET" => {
            if let Ok(val) = row.try_get::<String, _>(idx) {
                return Value::String(val);
            }
        }
        // Unsigned integer variants (MySQL returns these as specific type names)
        "TINYINT UNSIGNED" => {
            if let Ok(val) = row.try_get::<u8, _>(idx) {
                return Value::Number(val.into());
            }
        }
        "SMALLINT UNSIGNED" => {
            if let Ok(val) = row.try_get::<u16, _>(idx) {
                return Value::Number(val.into());
            }
        }
        "MEDIUMINT UNSIGNED" => {
            if let Ok(val) = row.try_get::<u32, _>(idx) {
                return Value::Number(val.into());
            }
        }
        "INT UNSIGNED" | "INTEGER UNSIGNED" => {
            if let Ok(val) = row.try_get::<u32, _>(idx) {
                return Value::Number(val.into());
            }
        }
        "BIGINT UNSIGNED" => {
            if let Ok(val) = row.try_get::<u64, _>(idx) {
                return Value::String(val.to_string());
            }
        }
        _ => {}
    }

    // Fallback: First try binary types (important for VARBINARY, BLOB, etc.)
    // This must come before string fallback to avoid type mismatch errors
    if let Ok(val) = row.try_get::<Vec<u8>, _>(idx) {
        if let Ok(s) = String::from_utf8(val.clone()) {
            // Only return as string if it's valid UTF-8
            // Check if the column name or type hints suggest it should be binary
            if type_name.to_uppercase().contains("BINARY")
                || type_name.to_uppercase().contains("BLOB")
                || type_name.to_uppercase().contains("BIT")
            {
                // Return as hex for binary types
                return Value::String(format!("0x{}", hex::encode(&val)));
            }
            // For TEXT types that happen to be bytes, return as string
            return Value::String(s);
        }
        // Non-UTF8 binary data
        return Value::String(format!("0x{}", hex::encode(&val)));
    }

    // Fallback: try as string for any remaining types
    if let Ok(val) = row.try_get::<String, _>(idx) {
        return Value::String(val);
    }

    Value::Null
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

// Helper function to get connection config from store
pub async fn get_connection_config(
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

    Ok(ConnectionConfig {
        id: Some(info.id),
        name: info.name,
        host: info.host,
        port: info.port,
        username: info.username,
        password: info.password,
        database: info.database,
        color: info.color.clone(),
        connection_type: info.connection_type.clone(),
        ssh_config: info.ssh_config.clone(),
        ssl_config: info.ssl_config.clone(),
        http_config: info.http_config.clone(),
        group: info.group,
        is_favorite: info.is_favorite,
        sort_order: info.sort_order,
        tags: info.tags,
        last_connected_at: info.last_connected_at,
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
        .get_or_create_pool(&pool_id, &config)
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
                        if c == '\n' {
                            break;
                        }
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
                        if prev == '*' && curr == '/' {
                            break;
                        }
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

        matches!(
            first_word.as_str(),
            "SELECT" | "SHOW" | "DESCRIBE" | "EXPLAIN" | "DESC" | "WITH"
        )
    }

    let is_select = is_select_query(&sql);
    let sql_clone = sql.clone();
    let database_clone = database.clone();
    let connection_id_clone = connection_id.clone();

    let result = if is_select {
        // Execute SELECT query
        match sqlx::query(&sql).fetch_all(&pool).await {
            Ok(rows) => {
                // Get column info
                let columns: Vec<ColumnInfo> = if !rows.is_empty() {
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
                        Err(_) => vec![],
                    }
                };

                let query_rows: Vec<Vec<Value>> = rows
                    .iter()
                    .map(|row| {
                        columns
                            .iter()
                            .enumerate()
                            .map(|(idx, _)| mysql_value_to_json(row, idx))
                            .collect()
                    })
                    .collect();

                let row_count = query_rows.len();
                let execution_time_ms = start_time.elapsed().as_millis() as u64;

                // Add to history
                let _ = add_query_to_history_internal(
                    &state,
                    connection_id_clone,
                    database_clone,
                    sql_clone,
                    execution_time_ms,
                    row_count,
                    None,
                    true,
                    None,
                )
                .await;

                Ok(QueryResult {
                    columns,
                    rows: query_rows,
                    row_count,
                    execution_time_ms,
                    affected_rows: None,
                    last_insert_id: None,
                })
            }
            Err(e) => {
                let execution_time_ms = start_time.elapsed().as_millis() as u64;
                let error_msg = e.to_string();

                // Add to history (failed)
                let _ = add_query_to_history_internal(
                    &state,
                    connection_id_clone,
                    database_clone,
                    sql_clone,
                    execution_time_ms,
                    0,
                    None,
                    false,
                    Some(error_msg.clone()),
                )
                .await;

                Err(error_msg)
            }
        }
    } else {
        // Execute non-SELECT query
        match pool.execute(sql.as_str()).await {
            Ok(result) => {
                let execution_time_ms = start_time.elapsed().as_millis() as u64;

                // Add to history
                let _ = add_query_to_history_internal(
                    &state,
                    connection_id_clone,
                    database_clone,
                    sql_clone,
                    execution_time_ms,
                    0,
                    Some(result.rows_affected()),
                    true,
                    None,
                )
                .await;

                Ok(QueryResult {
                    columns: vec![],
                    rows: vec![],
                    row_count: 0,
                    execution_time_ms,
                    affected_rows: Some(result.rows_affected()),
                    last_insert_id: Some(result.last_insert_id()),
                })
            }
            Err(e) => {
                let execution_time_ms = start_time.elapsed().as_millis() as u64;
                let error_msg = e.to_string();

                // Add to history (failed)
                let _ = add_query_to_history_internal(
                    &state,
                    connection_id_clone,
                    database_clone,
                    sql_clone,
                    execution_time_ms,
                    0,
                    None,
                    false,
                    Some(error_msg.clone()),
                )
                .await;

                Err(error_msg)
            }
        }
    };

    result
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
            let value = mysql_value_to_json(&row, idx);
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

/// Execute paginated query for large result sets
#[tauri::command]
pub async fn execute_paginated_query(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: Option<String>,
    sql: String,
    page: u32,
    page_size: u32,
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
        .get_or_create_pool(&pool_id, &config)
        .await
        .map_err(|e| e.to_string())?;

    let start_time = std::time::Instant::now();

    // Calculate offset
    let offset = (page - 1) * page_size;

    // Wrap the query with pagination
    let paginated_sql = format!("{} LIMIT {} OFFSET {}", sql.trim(), page_size, offset);

    let sql_clone = sql.clone();
    let database_clone = database.clone();
    let connection_id_clone = connection_id.clone();

    match sqlx::query(&paginated_sql).fetch_all(&pool).await {
        Ok(rows) => {
            // Get column info
            let columns: Vec<ColumnInfo> = if !rows.is_empty() {
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
                vec![]
            };

            let query_rows: Vec<Vec<Value>> = rows
                .iter()
                .map(|row| {
                    columns
                        .iter()
                        .enumerate()
                        .map(|(idx, _)| mysql_value_to_json(row, idx))
                        .collect()
                })
                .collect();

            let row_count = query_rows.len();
            let execution_time_ms = start_time.elapsed().as_millis() as u64;

            // Add to history
            let _ = add_query_to_history_internal(
                &state,
                connection_id_clone,
                database_clone,
                sql_clone,
                execution_time_ms,
                row_count,
                None,
                true,
                None,
            )
            .await;

            Ok(QueryResult {
                columns,
                rows: query_rows,
                row_count,
                execution_time_ms,
                affected_rows: None,
                last_insert_id: None,
            })
        }
        Err(e) => {
            let execution_time_ms = start_time.elapsed().as_millis() as u64;
            let error_msg = e.to_string();

            // Add to history (failed)
            let _ = add_query_to_history_internal(
                &state,
                connection_id_clone,
                database_clone,
                sql_clone,
                execution_time_ms,
                0,
                None,
                false,
                Some(error_msg.clone()),
            )
            .await;

            Err(error_msg)
        }
    }
}

/// Get total count for paginated queries
#[tauri::command]
pub async fn get_query_count(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: Option<String>,
    sql: String,
) -> Result<u64, String> {
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
        .get_or_create_pool(&pool_id, &config)
        .await
        .map_err(|e| e.to_string())?;

    // Wrap query in COUNT
    let count_sql = format!("SELECT COUNT(*) FROM ({})", sql.trim());

    match sqlx::query_scalar::<_, i64>(&count_sql)
        .fetch_one(&pool)
        .await
    {
        Ok(count) => Ok(count as u64),
        Err(e) => Err(e.to_string()),
    }
}

/// Save SQL query to a file
#[tauri::command]
pub async fn save_query_to_file(
    _state: State<'_, Arc<AppState>>,
    sql: String,
    filename: Option<String>,
) -> Result<String, String> {
    use chrono::Local;
    use std::fs;

    // Create default filename if not provided
    let filename = filename.unwrap_or_else(|| {
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        format!("query_{}.sql", timestamp)
    });

    // Get home directory for saved queries
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let queries_dir = home.join(".mylite").join("saved_queries");

    // Create directory if it doesn't exist
    fs::create_dir_all(&queries_dir)
        .map_err(|e| format!("Failed to create queries directory: {}", e))?;

    let file_path = queries_dir.join(&filename);

    // Write SQL to file
    fs::write(&file_path, &sql).map_err(|e| format!("Failed to write query to file: {}", e))?;

    Ok(file_path.to_string_lossy().into_owned())
}
