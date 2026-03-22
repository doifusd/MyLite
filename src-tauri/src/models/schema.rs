use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseSchema {
    pub name: String,
    pub charset: Option<String>,
    pub collation: Option<String>,
    pub tables: Vec<TableInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub schema: String,
    pub engine: Option<String>,
    pub row_count: Option<i64>,
    pub data_length: Option<i64>,
    pub index_length: Option<i64>,
    pub collation: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub comment: Option<String>,
    pub create_sql: Option<String>,
    pub columns: Vec<ColumnDefinition>,
    pub indexes: Vec<IndexInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnDefinition {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub is_auto_increment: bool,
    pub comment: Option<String>,
    pub character_set: Option<String>,
    pub collation: Option<String>,
    pub ordinal_position: u32,
    pub max_length: Option<u64>,
    pub numeric_precision: Option<u32>,
    pub numeric_scale: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub is_unique: bool,
    pub is_primary: bool,
    pub columns: Vec<String>,
    pub index_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaTreeItem {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: String, // "database", "table", "column", "index"
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<SchemaTreeItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}
