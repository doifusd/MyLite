use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRequest {
    pub connection_id: String,
    pub sql: String,
    #[serde(default)]
    pub database: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub execution_time_ms: u64,
    pub affected_rows: Option<u64>,
    pub last_insert_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_nullable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryItem {
    pub id: String,
    pub connection_id: String,
    pub database: Option<String>,
    pub sql: String,
    pub executed_at: String,
    pub execution_time_ms: u64,
    pub row_count: usize,
    pub affected_rows: Option<u64>,
    pub success: bool,
    pub error_message: Option<String>,
    pub is_favorite: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryFilter {
    pub connection_id: Option<String>,
    pub database: Option<String>,
    pub search_query: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub success_only: Option<bool>,
    pub favorites_only: Option<bool>,
    pub tags: Option<Vec<String>>,
}
