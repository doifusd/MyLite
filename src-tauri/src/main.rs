#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;

use commands::connection::*;
use commands::query::*;
use commands::schema::*;
use db::connection::ConnectionPool;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::Store;

pub struct AppState {
    pub pool: ConnectionPool,
    pub store: std::sync::Mutex<Option<Arc<std::sync::Mutex<Store<tauri::Wry>>>>>,
}

impl AppState {
    pub fn get_store(&self) -> Result<Arc<std::sync::Mutex<Store<tauri::Wry>>>, String> {
        self.store
            .lock()
            .map_err(|e| format!("Failed to lock store: {}", e))?
            .clone()
            .ok_or_else(|| "Store not initialized".to_string())
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let pool = ConnectionPool::new().await?;

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(Arc::new(AppState {
            pool,
            store: std::sync::Mutex::new(None),
        }))
        .setup(|app| {
            let store = tauri_plugin_store::StoreBuilder::new(
                app.handle(),
                "connections.json".parse()?,
            )
            .build();
            let state = app.state::<Arc<AppState>>();
            *state.store.lock().unwrap() = Some(Arc::new(std::sync::Mutex::new(store)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            test_connection,
            save_connection,
            get_connections,
            delete_connection,
            get_connection_detail,
            get_schema_tree,
            get_table_info,
            get_databases,
            get_databases_v2,
            get_tables,
            get_table_schema,
            get_database_info,
            execute_query,
            execute_raw_query,
            get_table_preview,
            alter_table,
            get_charsets,
            get_collations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
