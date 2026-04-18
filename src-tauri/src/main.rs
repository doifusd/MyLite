#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;

#[cfg(test)]
mod lib_test;

use commands::connection::*;
use commands::query::*;
use commands::query_analyzer::*;
use commands::query_history::*;
use commands::schema::*;
use db::connection::ConnectionPool;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::Store;

pub struct AppState {
    pub pool: ConnectionPool,
    pub store: std::sync::Mutex<Option<Arc<Store<tauri::Wry>>>>,
}

impl AppState {
    pub fn get_store(&self) -> Result<Arc<Store<tauri::Wry>>, String> {
        self.store
            .lock()
            .map_err(|e| format!("Failed to lock store: {}", e))?
            .clone()
            .ok_or_else(|| "Store not initialized".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match ConnectionPool::new().await {
                    Ok(pool) => {
                        match tauri_plugin_store::StoreBuilder::new(
                            &handle,
                            "connections.json".parse::<std::path::PathBuf>().unwrap(),
                        )
                        .build()
                        {
                            Ok(store) => {
                                let state = Arc::new(AppState {
                                    pool,
                                    store: std::sync::Mutex::new(Some(store)),
                                });

                                handle.manage(state);
                            }
                            Err(e) => {
                                eprintln!("Failed to build store: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize connection pool: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Connection management
            test_connection,
            save_connection,
            get_connections,
            delete_connection,
            get_connection_detail,
            get_home_dir,
            // Phase 4.1: Connection grouping and favorites
            toggle_connection_favorite,
            update_connection_group,
            update_connection_last_connected,
            get_connection_groups,
            save_connection_group,
            delete_connection_group,
            get_quick_connect_templates,
            save_quick_connect_template,
            delete_quick_connect_template,
            filter_connections,
            // Phase 4.2: Query history
            add_query_to_history,
            get_query_history,
            delete_query_history_item,
            clear_query_history,
            toggle_query_history_favorite,
            add_query_history_tags,
            remove_query_history_tags,
            get_query_history_tags,
            get_query_history_stats,
            // Schema management
            get_schema_tree,
            get_table_info,
            get_databases,
            get_databases_v2,
            get_tables,
            get_table_schema,
            get_database_info,
            // Query execution
            execute_query,
            execute_raw_query,
            get_table_preview,
            execute_paginated_query,
            get_query_count,
            alter_table,
            get_charsets,
            get_collations,
            // Query analyzer
            analyze_query,
            explain_query,
            optimize_query,
            // Query autocomplete
            save_query_to_file,
            get_database_tables_and_columns,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
