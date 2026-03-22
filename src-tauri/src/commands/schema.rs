use crate::models::connection::{ConnectionConfig, ConnectionInfo};
use crate::models::schema::{ColumnDefinition, IndexInfo, SchemaTreeItem, TableInfo};
use crate::AppState;
use sqlx::{Executor, Row};
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
pub async fn get_schema_tree(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<Vec<SchemaTreeItem>, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let mut tree = Vec::new();

    // Get all databases
    let databases: Vec<String> = sqlx::query_scalar("SHOW DATABASES")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    for db_name in databases {

        let db_id = format!("db_{}", db_name);
        let mut db_children = Vec::new();

        // Get tables for this database
        let tables: Vec<String> = sqlx::query_scalar(&format!(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = '{}'",
            db_name
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

        for table_name in tables {
            let table_id = format!("table_{}.{}", db_name, table_name);
            let mut table_children = Vec::new();

        let columns: Vec<SchemaTreeItem> = sqlx::query(&format!(
                "SELECT column_name AS column_name, data_type AS data_type FROM information_schema.columns 
                 WHERE table_schema = '{}' AND table_name = '{}' 
                 ORDER BY ordinal_position",
                db_name, table_name
            ))
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .map(|row| SchemaTreeItem {
                id: format!("col_{}.{}.{}", db_name, table_name, row.get::<String, _>("column_name")),
                name: format!("{} ({})", row.get::<String, _>("column_name"), row.get::<String, _>("data_type")),
                item_type: "column".to_string(),
                parent_id: Some(table_id.clone()),
                children: None,
                metadata: None,
            })
            .collect();

            if !columns.is_empty() {
                let columns_node = SchemaTreeItem {
                    id: format!("{}/columns", table_id),
                    name: "Columns".to_string(),
                    item_type: "folder".to_string(),
                    parent_id: Some(table_id.clone()),
                    children: Some(columns),
                    metadata: None,
                };
                table_children.push(columns_node);
            }

            let indexes: Vec<SchemaTreeItem> = sqlx::query(&format!(
                "SELECT DISTINCT index_name AS index_name FROM information_schema.statistics 
                 WHERE table_schema = '{}' AND table_name = '{}'",
                db_name, table_name
            ))
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .map(|row| SchemaTreeItem {
                id: format!("idx_{}.{}.{}", db_name, table_name, row.get::<String, _>("index_name")),
                name: row.get::<String, _>("index_name"),
                item_type: "index".to_string(),
                parent_id: Some(table_id.clone()),
                children: None,
                metadata: None,
            })
            .collect();

            if !indexes.is_empty() {
                let indexes_node = SchemaTreeItem {
                    id: format!("{}/indexes", table_id),
                    name: "Indexes".to_string(),
                    item_type: "folder".to_string(),
                    parent_id: Some(table_id.clone()),
                    children: Some(indexes),
                    metadata: None,
                };
                table_children.push(indexes_node);
            }

            let table_node = SchemaTreeItem {
                id: table_id,
                name: table_name,
                item_type: "table".to_string(),
                parent_id: Some(db_id.clone()),
                children: if table_children.is_empty() { None } else { Some(table_children) },
                metadata: None,
            };
            db_children.push(table_node);
        }

        let db_node = SchemaTreeItem {
            id: db_id,
            name: db_name,
            item_type: "database".to_string(),
            parent_id: None,
            children: if db_children.is_empty() { None } else { Some(db_children) },
            metadata: None,
        };
        tree.push(db_node);
    }

    Ok(tree)
}

#[tauri::command]
pub async fn get_table_info(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: String,
    table: String,
) -> Result<TableInfo, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    // Get table metadata
    let table_row = sqlx::query(&format!(
        "SELECT engine AS engine, table_rows AS table_rows, data_length AS data_length, 
                index_length AS index_length, table_collation AS table_collation, 
                create_time AS create_time, update_time AS update_time, 
                table_comment AS table_comment 
         FROM information_schema.tables 
         WHERE table_schema = '{}' AND table_name = '{}'",
        database, table
    ))
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    // Get CREATE TABLE SQL
    let create_sql_row: (String, String) = sqlx::query_as(&format!(
        "SHOW CREATE TABLE `{}`.`{}`",
        database, table
    ))
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let columns: Vec<ColumnDefinition> = sqlx::query(&format!(
        "SELECT column_name AS column_name, data_type AS data_type, 
                is_nullable AS is_nullable, column_default AS column_default, 
                column_key AS column_key, extra AS extra, 
                column_comment AS column_comment, ordinal_position AS ordinal_position,
                character_maximum_length AS character_maximum_length, 
                numeric_precision AS numeric_precision, numeric_scale AS numeric_scale,
                character_set_name AS character_set_name, collation_name AS collation_name
         FROM information_schema.columns 
         WHERE table_schema = '{}' AND table_name = '{}' 
         ORDER BY ordinal_position",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|row| ColumnDefinition {
        name: row.get("column_name"),
        data_type: row.get("data_type"),
        is_nullable: row.get::<String, _>("is_nullable") == "YES",
        default_value: row.try_get("column_default").ok(),
        is_primary_key: row.get::<String, _>("column_key") == "PRI",
        is_auto_increment: row.get::<String, _>("extra").contains("auto_increment"),
        comment: row.try_get("column_comment").ok(),
        character_set: row.try_get("character_set_name").ok(),
        collation: row.try_get("collation_name").ok(),
        ordinal_position: row.get("ordinal_position"),
        max_length: row.try_get("character_maximum_length").ok(),
        numeric_precision: row.try_get("numeric_precision").ok(),
        numeric_scale: row.try_get("numeric_scale").ok(),
    })
    .collect();

    let indexes: Vec<IndexInfo> = sqlx::query(&format!(
        "SELECT index_name AS index_name, non_unique AS non_unique, 
                index_type AS index_type, column_name AS column_name 
         FROM information_schema.statistics 
         WHERE table_schema = '{}' AND table_name = '{}' 
         ORDER BY index_name, seq_in_index",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .fold(std::collections::HashMap::new(), |mut acc, row| {
        let name: String = row.get("index_name");
        
        let non_unique = row.try_get::<i64, _>("non_unique")
            .or_else(|_| row.try_get::<i32, _>("non_unique").map(|v| v as i64))
            .or_else(|_| row.try_get::<u32, _>("non_unique").map(|v| v as i64))
            .unwrap_or(0);

        let entry = acc.entry(name.clone()).or_insert_with(|| IndexInfo {
            name: name.clone(),
            is_unique: non_unique == 0,
            is_primary: name == "PRIMARY",
            columns: Vec::new(),
            index_type: row.get("index_type"),
        });
        entry.columns.push(row.get("column_name"));
        acc
    })
    .into_values()
    .collect();

    Ok(TableInfo {
        name: table.clone(),
        schema: database,
        engine: table_row.try_get("engine").ok(),
        row_count: table_row.try_get("table_rows").ok(),
        data_length: table_row.try_get("data_length").ok(),
        index_length: table_row.try_get("index_length").ok(),
        collation: table_row.try_get("table_collation").ok(),
        created_at: table_row.try_get::<chrono::NaiveDateTime, _>("create_time").ok().map(|dt| dt.to_string()),
        updated_at: table_row.try_get::<chrono::NaiveDateTime, _>("update_time").ok().map(|dt| dt.to_string()),
        comment: table_row.try_get("table_comment").ok(),
        create_sql: Some(create_sql_row.1),
        columns,
        indexes,
    })
}

#[tauri::command]
pub async fn alter_table(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: String,
    _table: String,
    sql: String,
) -> Result<(), String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    // Use the specified database
    let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;

    conn.execute(format!("USE `{}`", database).as_str())
        .await
        .map_err(|e| e.to_string())?;

    conn.execute(sql.as_str())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_databases(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<Vec<String>, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let databases: Vec<String> = sqlx::query_scalar("SHOW DATABASES")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(databases)
}

#[tauri::command]
pub async fn get_database_info(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: String,
) -> Result<serde_json::Value, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(&format!(
        "SELECT default_character_set_name, default_collation_name 
         FROM information_schema.schemata 
         WHERE schema_name = '{}'",
        database
    ))
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut map = serde_json::Map::new();
    map.insert("name".to_string(), serde_json::Value::String(database));
    map.insert("charset".to_string(), serde_json::Value::String(row.get("default_character_set_name")));
    map.insert("collation".to_string(), serde_json::Value::String(row.get("default_collation_name")));

    Ok(serde_json::Value::Object(map))
}

#[tauri::command]
pub async fn get_databases_v2(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<Vec<SchemaTreeItem>, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let databases: Vec<String> = sqlx::query_scalar("SHOW DATABASES")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut tree = Vec::new();
    for db_name in databases {
        tree.push(SchemaTreeItem {
            id: format!("db_{}", db_name),
            name: db_name,
            item_type: "database".to_string(),
            parent_id: None,
            children: None,
            metadata: None,
        });
    }

    Ok(tree)
}

#[tauri::command]
pub async fn get_tables(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: String,
) -> Result<Vec<SchemaTreeItem>, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let tables: Vec<String> = sqlx::query_scalar(&format!(
        "SELECT table_name AS table_name FROM information_schema.tables WHERE table_schema = '{}'",
        database
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut tree = Vec::new();
    for table_name in tables {
        tree.push(SchemaTreeItem {
            id: format!("table_{}.{}", database, table_name),
            name: table_name,
            item_type: "table".to_string(),
            parent_id: Some(format!("db_{}", database)),
            children: None,
            metadata: None,
        });
    }

    Ok(tree)
}

#[tauri::command]
pub async fn get_table_schema(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: String,
    table: String,
) -> Result<Vec<SchemaTreeItem>, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let mut children = Vec::new();
    let table_id = format!("table_{}.{}", database, table);

    let columns: Vec<SchemaTreeItem> = sqlx::query(&format!(
        "SELECT column_name AS column_name, data_type AS data_type FROM information_schema.columns 
         WHERE table_schema = '{}' AND table_name = '{}' 
         ORDER BY ordinal_position",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|row| SchemaTreeItem {
        id: format!("col_{}.{}.{}", database, table, row.get::<String, _>("column_name")),
        name: format!("{} ({})", row.get::<String, _>("column_name"), row.get::<String, _>("data_type")),
        item_type: "column".to_string(),
        parent_id: Some(format!("{}/columns", table_id)),
        children: None,
        metadata: None,
    })
    .collect();

    if !columns.is_empty() {
        children.push(SchemaTreeItem {
            id: format!("{}/columns", table_id),
            name: "Columns".to_string(),
            item_type: "folder".to_string(),
            parent_id: Some(table_id.clone()),
            children: Some(columns),
            metadata: None,
        });
    }

    let indexes: Vec<SchemaTreeItem> = sqlx::query(&format!(
        "SELECT DISTINCT index_name AS index_name FROM information_schema.statistics 
         WHERE table_schema = '{}' AND table_name = '{}'",
        database, table
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|row| SchemaTreeItem {
        id: format!("idx_{}.{}.{}", database, table, row.get::<String, _>("index_name")),
        name: row.get::<String, _>("index_name"),
        item_type: "index".to_string(),
        parent_id: Some(format!("{}/indexes", table_id)),
        children: None,
        metadata: None,
    })
    .collect();

    if !indexes.is_empty() {
        children.push(SchemaTreeItem {
            id: format!("{}/indexes", table_id),
            name: "Indexes".to_string(),
            item_type: "folder".to_string(),
            parent_id: Some(table_id.clone()),
            children: Some(indexes),
            metadata: None,
        });
    }

    Ok(children)
}

#[tauri::command]
pub async fn get_charsets(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = sqlx::query("SHOW CHARACTER SET")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|row| {
            let mut map = serde_json::Map::new();
            map.insert("charset".to_string(), serde_json::Value::String(row.get("Charset")));
            map.insert("description".to_string(), serde_json::Value::String(row.get("Description")));
            map.insert("default_collation".to_string(), serde_json::Value::String(row.get("Default collation")));
            
            let maxlen = row.try_get::<i64, _>("Maxlen")
                .or_else(|_| row.try_get::<u32, _>("Maxlen").map(|v| v as i64))
                .or_else(|_| row.try_get::<i32, _>("Maxlen").map(|v| v as i64))
                .or_else(|_| row.try_get::<u64, _>("Maxlen").map(|v| v as i64))
                .unwrap_or(0);
            map.insert("maxlen".to_string(), serde_json::Value::Number(maxlen.into()));
            
            serde_json::Value::Object(map)
        })
        .collect();

    Ok(rows)
}

#[tauri::command]
pub async fn get_collations(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    charset: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let pool = state
        .pool
        .get_or_create_pool(&connection_id, &get_connection_config(&state, &connection_id).await?)
        .await
        .map_err(|e| e.to_string())?;

    let sql = if let Some(cs) = charset {
        format!("SHOW COLLATION WHERE Charset = '{}'", cs)
    } else {
        "SHOW COLLATION".to_string()
    };

    let rows: Vec<serde_json::Value> = sqlx::query(&sql)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|row| {
            let mut map = serde_json::Map::new();
            map.insert("collation".to_string(), serde_json::Value::String(row.get("Collation")));
            map.insert("charset".to_string(), serde_json::Value::String(row.get("Charset")));
            
            let id = row.try_get::<i64, _>("Id")
                .or_else(|_| row.try_get::<u32, _>("Id").map(|v| v as i64))
                .or_else(|_| row.try_get::<i32, _>("Id").map(|v| v as i64))
                .or_else(|_| row.try_get::<u64, _>("Id").map(|v| v as i64))
                .unwrap_or(0);
            map.insert("id".to_string(), serde_json::Value::Number(id.into()));
            
            map.insert("is_default".to_string(), serde_json::Value::String(row.get("Default")));
            map.insert("is_compiled".to_string(), serde_json::Value::String(row.get("Compiled")));
            
            let sortlen = row.try_get::<i64, _>("Sortlen")
                .or_else(|_| row.try_get::<u32, _>("Sortlen").map(|v| v as i64))
                .or_else(|_| row.try_get::<i32, _>("Sortlen").map(|v| v as i64))
                .or_else(|_| row.try_get::<u64, _>("Sortlen").map(|v| v as i64))
                .unwrap_or(0);
            map.insert("sortlen".to_string(), serde_json::Value::Number(sortlen.into()));
            
            serde_json::Value::Object(map)
        })
        .collect();

    Ok(rows)
}
