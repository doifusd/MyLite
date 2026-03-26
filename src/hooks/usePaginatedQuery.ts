import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable?: boolean;
  max_length?: number;
}

interface QueryResultData {
  columns: ColumnInfo[];
  rows: any[][];
  row_count: number;
  execution_time_ms: number;
  affected_rows?: number;
  last_insert_id?: number;
}

interface UsePaginatedQueryOptions {
  connectionId: string;
  database?: string;
  sql: string;
  pageSize?: number;
  enabled?: boolean;
}

interface UsePaginatedQueryResult {
  data: QueryResultData | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

export function usePaginatedQuery({
  connectionId,
  database,
  sql,
  pageSize = 100,
  enabled = true,
}: UsePaginatedQueryOptions): UsePaginatedQueryResult {
  const [data, setData] = useState<QueryResultData | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if this is a SELECT-like query
  const isSelectQuery = useRef(false);
  
  useEffect(() => {
    // Check if query is SELECT-like
    const trimmedSql = sql.trim().toUpperCase();
    isSelectQuery.current = 
      trimmedSql.startsWith('SELECT') ||
      trimmedSql.startsWith('SHOW') ||
      trimmedSql.startsWith('DESCRIBE') ||
      trimmedSql.startsWith('DESC') ||
      trimmedSql.startsWith('EXPLAIN') ||
      trimmedSql.startsWith('WITH');
  }, [sql]);

  const fetchPage = useCallback(async (page: number) => {
    if (!enabled || !sql || !connectionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (isSelectQuery.current) {
        // Use paginated query for SELECT-like queries
        const [result, count] = await Promise.all([
          invoke<QueryResultData>('execute_paginated_query', {
            connectionId,
            database,
            sql,
            page,
            pageSize,
          }),
          invoke<number>('get_query_count', {
            connectionId,
            database,
            sql,
          }).catch(() => 0),
        ]);
        
        setData(result);
        setTotalCount(count);
      } else {
        // Use regular execute for non-SELECT queries
        const result = await invoke<QueryResultData>('execute_query', {
          connectionId,
          database,
          sql,
        });
        
        setData(result);
        setTotalCount(result.row_count);
      }
      
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.toString());
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [connectionId, database, sql, pageSize, enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchPage(1);
    }
  }, [enabled, fetchPage]);

  const goToPage = useCallback((page: number) => {
    const totalPages = Math.ceil(totalCount / pageSize);
    const clampedPage = Math.max(1, Math.min(page, totalPages || 1));
    fetchPage(clampedPage);
  }, [fetchPage, totalCount, pageSize]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [goToPage, currentPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [goToPage, currentPage]);

  const refresh = useCallback(() => {
    fetchPage(currentPage);
  }, [fetchPage, currentPage]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data,
    totalCount,
    currentPage,
    totalPages,
    loading,
    error,
    goToPage,
    nextPage,
    prevPage,
    refresh,
  };
}

export default usePaginatedQuery;
