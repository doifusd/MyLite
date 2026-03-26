import { invoke } from '@tauri-apps/api/tauri';

export interface QueryHistoryItem {
  id: string;
  connection_id: string;
  database?: string;
  sql: string;
  executed_at: string;
  execution_time_ms: number;
  row_count: number;
  affected_rows?: number;
  success: boolean;
  error_message?: string;
  is_favorite: boolean;
  tags: string[];
}

export interface QueryHistoryFilter {
  connection_id?: string;
  database?: string;
  search_query?: string;
  from_date?: string;
  to_date?: string;
  success_only?: boolean;
  favorites_only?: boolean;
  tags?: string[];
}

export interface QueryHistoryStats {
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  favorite_queries: number;
  average_execution_time_ms: number;
}

export async function addQueryToHistory(
  connectionId: string,
  database: string | undefined,
  sql: string,
  executionTimeMs: number,
  rowCount: number,
  affectedRows: number | undefined,
  success: boolean,
  errorMessage?: string
): Promise<QueryHistoryItem> {
  return invoke('add_query_to_history', {
    connectionId,
    database,
    sql,
    executionTimeMs,
    rowCount,
    affectedRows,
    success,
    errorMessage,
  });
}

export async function getQueryHistory(
  filter?: QueryHistoryFilter,
  limit?: number
): Promise<QueryHistoryItem[]> {
  return invoke('get_query_history', { filter, limit });
}

export async function deleteQueryHistoryItem(itemId: string): Promise<void> {
  return invoke('delete_query_history_item', { itemId });
}

export async function clearQueryHistory(connectionId?: string): Promise<void> {
  return invoke('clear_query_history', { connectionId });
}

export async function toggleQueryHistoryFavorite(itemId: string): Promise<QueryHistoryItem> {
  return invoke('toggle_query_history_favorite', { itemId });
}

export async function addQueryHistoryTags(itemId: string, tags: string[]): Promise<QueryHistoryItem> {
  return invoke('add_query_history_tags', { itemId, tags });
}

export async function removeQueryHistoryTags(itemId: string, tags: string[]): Promise<QueryHistoryItem> {
  return invoke('remove_query_history_tags', { itemId, tags });
}

export async function getQueryHistoryTags(): Promise<string[]> {
  return invoke('get_query_history_tags');
}

export async function getQueryHistoryStats(connectionId?: string): Promise<QueryHistoryStats> {
  return invoke('get_query_history_stats', { connectionId });
}

// Format execution time for display
export function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

// Format date for display
export function formatExecutedAt(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 1 minute
  if (diff < 60 * 1000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  }
  
  return date.toLocaleDateString();
}

// Truncate SQL for preview
export function truncateSql(sql: string, maxLength: number = 100): string {
  const trimmed = sql.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.substring(0, maxLength) + '...';
}

// Get SQL preview (first line or first N chars)
export function getSqlPreview(sql: string): string {
  const trimmed = sql.trim();
  const firstLine = trimmed.split('\n')[0];
  return truncateSql(firstLine, 80);
}
