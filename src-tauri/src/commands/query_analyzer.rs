use crate::AppState;
use crate::commands::query::get_connection_config;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
pub struct QueryAnalysis {
    pub sql: String,
    pub is_select: bool,
    pub has_limit: bool,
    pub has_where_clause: bool,
    pub has_index_hint: bool,
    pub table_names: Vec<String>,
    pub warning: Option<String>,
    pub suggestion: Option<String>,
    pub estimated_rows: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct QueryPlan {
    pub id: i64,
    pub select_type: String,
    pub table: Option<String>,
    pub partitions: Option<String>,
    pub join_type: Option<String>,
    pub possible_keys: Option<String>,
    pub key: Option<String>,
    pub key_len: Option<String>,
    pub ref_columns: Option<String>,
    pub rows: Option<i64>,
    pub filtered: Option<f64>,
    pub extra: Option<String>,
}

/// Analyze SQL query for potential performance issues
#[tauri::command]
pub async fn analyze_query(
    _state: State<'_, Arc<AppState>>,
    sql: String,
) -> Result<QueryAnalysis, String> {
    let analysis = analyze_query_internal(&sql)?;
    Ok(analysis)
}

fn analyze_query_internal(sql: &str) -> Result<QueryAnalysis, String> {
    let sql_upper = sql.trim().to_uppercase();
    let is_select = sql_upper.starts_with("SELECT") || 
                    sql_upper.starts_with("SHOW") ||
                    sql_upper.starts_with("DESCRIBE");
    
    // Check for LIMIT clause
    let has_limit = sql_upper.contains(" LIMIT ");
    
    // Check for WHERE clause
    let has_where_clause = sql_upper.contains(" WHERE ");
    
    // Check for index hints
    let has_index_hint = sql_upper.contains(" USE INDEX ") || 
                         sql_upper.contains(" FORCE INDEX ") ||
                         sql_upper.contains(" IGNORE INDEX ");
    
    // Extract table names (basic extraction)
    let table_names = extract_table_names(sql);
    
    // Generate warnings and suggestions
    let mut warning: Option<String> = None;
    let mut suggestion: Option<String> = None;
    
    if is_select {
        // Check for SELECT *
        if sql_upper.contains("SELECT * ") && !sql_upper.contains("COUNT(*)") {
            warning = Some("Query uses SELECT * which may fetch unnecessary columns".to_string());
            suggestion = Some("Consider specifying only needed columns".to_string());
        }
        
        // Check for missing WHERE clause on large tables
        if !has_where_clause && !has_limit {
            warning = Some("Query has no WHERE clause or LIMIT - may return large result set".to_string());
            suggestion = Some("Add a WHERE clause or LIMIT to restrict results".to_string());
        }
        
        // Check for LIKE with leading wildcard
        if sql_upper.contains(" LIKE '%") || sql_upper.contains(" LIKE '_") {
            warning = Some("LIKE pattern with leading wildcard prevents index usage".to_string());
            suggestion = Some("Consider using full-text search or restructuring the query".to_string());
        }
        
        // Check for NOT IN
        if sql_upper.contains(" NOT IN (") {
            warning = Some("NOT IN can have performance issues with NULL values".to_string());
            suggestion = Some("Consider using NOT EXISTS or LEFT JOIN with IS NULL".to_string());
        }
    }
    
    Ok(QueryAnalysis {
        sql: sql.to_string(),
        is_select,
        has_limit,
        has_where_clause,
        has_index_hint,
        table_names,
        warning,
        suggestion,
        estimated_rows: None,
    })
}

/// Get EXPLAIN plan for a query
#[tauri::command]
pub async fn explain_query(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    database: Option<String>,
    sql: String,
) -> Result<Vec<QueryPlan>, String> {
    use sqlx::Row;
    
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
    
    let explain_sql = format!("EXPLAIN {}", sql);
    
    let rows = sqlx::query(&explain_sql)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let mut plans = Vec::new();
    
    for row in rows {
        let plan = QueryPlan {
            id: row.try_get("id").unwrap_or(0),
            select_type: row.try_get("select_type").unwrap_or_default(),
            table: row.try_get("table").ok(),
            partitions: row.try_get("partitions").ok(),
            join_type: row.try_get::<Option<String>, _>("type").ok().flatten(),
            possible_keys: row.try_get("possible_keys").ok(),
            key: row.try_get("key").ok(),
            key_len: row.try_get("key_len").ok(),
            ref_columns: row.try_get("ref").ok(),
            rows: row.try_get("rows").ok(),
            filtered: row.try_get("filtered").ok(),
            extra: row.try_get("Extra").ok(),
        };
        plans.push(plan);
    }
    
    Ok(plans)
}

fn extract_table_names(sql: &str) -> Vec<String> {
    let mut tables = Vec::new();
    let sql_upper = sql.to_uppercase();
    
    // Simple extraction for FROM and JOIN clauses
    let keywords = [" FROM ", " JOIN "];
    
    for keyword in &keywords {
        if let Some(pos) = sql_upper.find(keyword) {
            let after_keyword = &sql[pos + keyword.len()..];
            // Extract table name (handle backticks)
            let table_name = after_keyword
                .trim_start()
                .split_whitespace()
                .next()
                .unwrap_or("")
                .trim_matches('`')
                .to_string();
            
            if !table_name.is_empty() && !tables.contains(&table_name) {
                tables.push(table_name);
            }
        }
    }
    
    tables
}

/// Optimize a query by adding suggestions
#[tauri::command]
pub async fn optimize_query(
    _state: State<'_, Arc<AppState>>,
    sql: String,
) -> Result<String, String> {
    let analysis = analyze_query_internal(&sql)?;
    
    let mut optimized = sql.clone();
    
    // Add LIMIT if missing for SELECT queries
    if analysis.is_select && !analysis.has_limit && !analysis.has_where_clause {
        optimized = format!("{} LIMIT 1000", optimized.trim());
    }
    
    Ok(optimized)
}
