import { QueryResult } from '@/components/QueryResult';
import { SaveQueryDialog } from '@/components/SaveQueryDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/store/connectionStore';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Table2
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'sql-formatter';

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

interface SQLEditorProps {
  connectionId: string;
  database?: string;
  initialSql?: string;
  onSqlChange?: (sql: string) => void;
  className?: string;
}

// Single query execution result
interface QueryExecutionResult {
  id: string;
  sql: string;
  result: QueryResultData | null;
  error: string | null;
  executionTime: number;
  isExecuting: boolean;
}

// Database table and column info
interface TableCompletionInfo {
  table_name: string;
  columns: string[];
}

interface DatabaseTablesInfo {
  database: string;
  tables: TableCompletionInfo[];
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  connectionId,
  database,
  initialSql = '',
  onSqlChange,
  className,
}) => {
  const { t } = useTranslation();
  const [sql, setSql] = useState(initialSql);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<QueryExecutionResult[]>([]);
  const [activeResultTab, setActiveResultTab] = useState<string>('');
  const [history, setHistory] = useState<Array<{ sql: string; timestamp: Date }>>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(connectionId);
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(database);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  // const editorRef = useRef<HTMLTextAreaElement>(null);
  // const resultIdCounter = useRef(0);
  const tablesInfoRef = useRef<DatabaseTablesInfo | null>(null);

  // Get all connections from store
  const connections = useConnectionStore((state) => state.connections);
  const loadConnections = useConnectionStore((state) => state.loadConnections);

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Fetch available databases when connection changes
  useEffect(() => {
    if (!selectedConnectionId) return;

    const fetchDatabases = async () => {
      try {
        const dbs = await invoke<string[]>('get_databases', {
          connectionId: selectedConnectionId,
        });
        setAvailableDatabases(dbs || []);

        // Reset and set first database as default when connection changes
        // or if current database is not in the new list
        if (!selectedDatabase || !dbs?.includes(selectedDatabase)) {
          if (dbs && dbs.length > 0) {
            setSelectedDatabase(dbs[0]);
          } else {
            setSelectedDatabase(undefined);
          }
        }
      } catch (error) {
        console.error('Failed to fetch databases:', error);
        setAvailableDatabases([]);
        setSelectedDatabase(undefined);
      }
    };

    fetchDatabases();
  }, [selectedConnectionId]);

  // Sync selectedConnectionId with connectionId prop and immediately fetch databases
  useEffect(() => {
    if (connectionId) {
      setSelectedConnectionId(connectionId);
      // Fetch databases for this connection
      const fetchDbs = async () => {
        try {
          const dbs = await invoke<string[]>('get_databases', {
            connectionId: connectionId,
          });
          setAvailableDatabases(dbs || []);
        } catch (err) {
          console.error('[SQLEditor] Failed to fetch databases:', err);
        }
      };
      fetchDbs();
    }
  }, [connectionId]);

  // Sync selectedDatabase with database prop
  useEffect(() => {
    if (database) {
      setSelectedDatabase(database);
    }
  }, [database]);

  // Fetch tables and columns for autocomplete
  useEffect(() => {
    const dbToUse = selectedDatabase || database;
    const connToUse = selectedConnectionId || connectionId;

    if (!connToUse || !dbToUse) return;

    const fetchTablesAndColumns = async () => {
      try {
        const info = await invoke<DatabaseTablesInfo>('get_database_tables_and_columns', {
          connectionId: connToUse,
          database: dbToUse,
        });
        tablesInfoRef.current = info; // Also update ref
      } catch (error) {
        console.error('Failed to fetch tables and columns:', error);
      }
    };

    fetchTablesAndColumns();
  }, [connectionId, database, selectedConnectionId, selectedDatabase]);

  // Sync with initialSql prop when it changes (e.g., when switching tabs back)
  useEffect(() => {
    if (initialSql !== undefined && initialSql !== sql) {
      setSql(initialSql);
    }
  }, [initialSql]);

  // Listen for load saved query events
  useEffect(() => {
    const handleLoadSavedQuery = (event: any) => {
      const { sql: savedSql } = event.detail;
      setSql(savedSql);
      onSqlChange?.(savedSql);
    };

    window.addEventListener('loadSavedQuery', handleLoadSavedQuery);
    return () => window.removeEventListener('loadSavedQuery', handleLoadSavedQuery);
  }, [onSqlChange]);

  const formatSql = () => {
    const currentSql = sql;

    try {
      // Use sql-formatter for professional formatting
      const formatted = format(currentSql, {
        language: 'mysql',
        keywordCase: 'upper',
        indentStyle: 'standard',
        linesBetweenQueries: 2,
      });

      setSql(formatted);
      onSqlChange?.(formatted);
    } catch (err) {
      // Silently handle formatting failure, keep original
      console.warn('SQL format failed:', err);
    }
  };

  // Parse multiple SQL statements
  const parseStatements = (sqlText: string): string[] => {
    const statements: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sqlText.length; i++) {
      const char = sqlText[i];
      // const nextChar = sqlText[i + 1];

      // Handle string boundaries
      if ((char === "'" || char === '"' || char === '`') && (i === 0 || sqlText[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      current += char;

      // Check for statement end (semicolon outside of string)
      if (char === ';' && !inString) {
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
      }
    }

    // Add any remaining statement
    const trimmed = current.trim();
    if (trimmed) {
      statements.push(trimmed);
    }

    return statements;
  };

  const executeQuery = async () => {
    const currentSql = sql.trim();
    if (!currentSql) return;

    setIsExecuting(true);
    const statements = parseStatements(currentSql);

    // Clear previous results
    setResults(
      statements.map((_, i) => ({
        id: `result-${i}`,
        sql: statements[i],
        result: null,
        error: null,
        executionTime: 0,
        isExecuting: true,
      }))
    );

    // Execute each statement sequentially
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const startTime = Date.now();

      try {
        const data = await invoke<QueryResultData>('execute_query', {
          connectionId: selectedConnectionId,
          database: selectedDatabase,
          sql: stmt,
        });

        // Debug: Log query results, especially for DECIMAL detection
        if (data.columns && data.rows) {
          const decimalCols = data.columns
            .map((col, idx) =>
              col.data_type.includes('DECIMAL') || col.data_type.includes('NUMERIC')
                ? { idx, col }
                : null
            )
            .filter(Boolean);
          if (decimalCols.length > 0) {
            console.log(
              '[SQLEditor] DECIMAL values:',
              data.rows.slice(0, 5).map(row =>
                decimalCols.map((dc: any) => ({
                  col: dc.col.name,
                  value: row[dc.idx],
                }))
              )
            );
          }
        }

        setResults(prev =>
          prev.map(r =>
            r.id === `result-${i}`
              ? {
                ...r,
                result: data,
                executionTime: Date.now() - startTime,
                isExecuting: false,
              }
              : r
          )
        );

        // Set active tab to the first result
        if (i === 0) {
          setActiveResultTab(`result-0`);
        }

        // Add to history
        if (i === statements.length - 1) {
          setHistory(prev => [
            {
              sql: currentSql.slice(0, 100) + (currentSql.length > 100 ? '...' : ''),
              timestamp: new Date(),
            },
            ...prev.slice(0, 49),
          ]);
        }
      } catch (err) {
        const errorMsg =
          typeof err === 'string' ? err : err instanceof Error ? err.message : 'Query execution failed';
        console.error('[SQLEditor] Execute error:', errorMsg);
        setResults(prev =>
          prev.map(r =>
            r.id === `result-${i}`
              ? {
                ...r,
                error: errorMsg,
                executionTime: Date.now() - startTime,
                isExecuting: false,
              }
              : r
          )
        );
        // Continue executing remaining statements after error
      }
    }

    setIsExecuting(false);
  };

  const handleSaveQuery = useCallback(async (queryName: string) => {
    console.log('[SQLEditor] handleSaveQuery called with:', { queryName, database, connectionId });

    try {
      // Validate inputs
      const trimmedName = queryName.trim();
      if (!trimmedName) {
        throw new Error('Query name cannot be empty');
      }

      const currentSql = sql;
      console.log('[SQLEditor] Current SQL length:', currentSql.length);
      console.log('[SQLEditor] Current SQL preview:', currentSql.substring(0, 50) + '...');

      if (!currentSql || !currentSql.trim()) {
        throw new Error('Query SQL is empty');
      }

      if (!connectionId) {
        throw new Error('No connection ID available. Please establish a database connection first.');
      }

      // Try to infer database from SQL if not explicitly provided
      let targetDatabase = database;
      if (!targetDatabase && currentSql) {
        // Try to extract database name from queries like "FROM database.table" or "INSERT INTO database.table"
        const dbMatch = currentSql.match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+`?(\w+)`?\s*\./i);
        if (dbMatch && dbMatch[1]) {
          targetDatabase = dbMatch[1];
          console.log('[SQLEditor] Inferred database from SQL:', targetDatabase);
        }
      }

      if (!targetDatabase) {
        throw new Error('No database selected. Please click on a table in Schema Browser to select a database, or use "database.table" syntax in your query.');
      }

      console.log('[SQLEditor] All validations passed, saving query...');

      // Save query to local storage
      const key = `saved_queries_${connectionId}_${targetDatabase}`;
      console.log('[SQLEditor] Storage key:', key);

      try {
        console.log('[SQLEditor] Reading from localStorage...');
        const storageValue = localStorage.getItem(key);
        console.log('[SQLEditor] Storage value retrieved, length:', storageValue?.length || 0);

        const savedQueries = JSON.parse(storageValue || '[]');
        if (!Array.isArray(savedQueries)) {
          throw new Error('Corrupted saved queries data');
        }
        console.log('[SQLEditor] Parsed existing queries:', savedQueries.length);

        // Check for duplicate names
        if (savedQueries.some((q: any) => q.name === trimmedName)) {
          throw new Error(`A query named "${trimmedName}" already exists. Please use a different name.`);
        }

        const newQuery = {
          id: `${Date.now()}`,
          name: trimmedName,
          sql: currentSql,
          createdAt: new Date().toISOString(),
        };

        console.log('[SQLEditor] New query object created:', { id: newQuery.id, name: newQuery.name, sqlLength: newQuery.sql.length });

        savedQueries.push(newQuery);
        console.log('[SQLEditor] Added to array, array length now:', savedQueries.length);

        const jsonString = JSON.stringify(savedQueries);
        console.log('[SQLEditor] JSON stringified, size:', jsonString.length, 'bytes');

        localStorage.setItem(key, jsonString);
        console.log('[SQLEditor] localStorage.setItem completed');

        const verifyValue = localStorage.getItem(key);
        console.log('[SQLEditor] Verification - retrieved from storage, size:', verifyValue?.length || 0);
        console.log('[SQLEditor] Query saved to localStorage:', {
          queryName: trimmedName,
          database: targetDatabase,
          key,
          totalQueries: savedQueries.length,
        });

        // Dispatch custom event to notify SchemaBrowser to refresh
        console.log('[SQLEditor] Dispatching queryUpdated event...');
        window.dispatchEvent(
          new CustomEvent('queryUpdated', {
            detail: { connectionId, database: targetDatabase },
          })
        );
        console.log('[SQLEditor] queryUpdated event dispatched');
      } catch (error: any) {
        console.error('[SQLEditor] localStorage operation failed:', error);
        console.error('[SQLEditor] Error type:', error?.name);
        console.error('[SQLEditor] Error message:', error?.message);

        // Provide more specific error messages
        if (error?.name === 'QuotaExceededError') {
          throw new Error('Storage quota exceeded. Please clear some saved queries to make space.');
        }

        if (error?.message?.includes('Corrupted') || error?.message?.includes('already exists')) {
          throw error;
        }

        throw new Error(`Failed to save query: ${error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[SQLEditor] handleSaveQuery error:', error);
      throw error;
    }
  }, [connectionId, database, sql]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        <Button
          size="sm"
          onClick={executeQuery}
          disabled={isExecuting || !sql.trim()}
          className="gap-1"
        >
          {isExecuting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {t('ui.execute')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={formatSql}
          disabled={!sql.trim()}
        >
          {t('ui.format')}
        </Button>

        <div className="flex-1" />
      </div>

      {/* Database Selection Row */}
      <div className="flex items-center gap-3 px-2 py-2 text-sm bg-white border-b">
        <label className="font-medium text-gray-600 min-w-fit">Connection:</label>
        <select
          value={selectedConnectionId}
          onChange={(e) => setSelectedConnectionId(e.target.value)}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select connection...</option>
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.name}
            </option>
          ))}
        </select>

        <label className="font-medium text-gray-600 min-w-fit">Database:</label>
        <select
          value={selectedDatabase || ''}
          onChange={(e) => setSelectedDatabase(e.target.value || undefined)}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select database...</option>
          {availableDatabases.map((db) => (
            <option key={db} value={db}>
              {db}
            </option>
          ))}
        </select>

        {selectedDatabase && (
          <span className="ml-auto text-xs text-gray-500">
            Selected: <code className="bg-gray-100 px-1 py-0.5 rounded">{selectedDatabase}</code>
          </span>
        )}
      </div>

      {/* SQL Input - Simple Textarea */}
      <div className="relative flex-1 min-h-0 border rounded">
        <Textarea
          value={sql}
          onChange={(e) => {
            const newValue = e.target.value;
            setSql(newValue);
            onSqlChange?.(newValue);
          }}
          placeholder="Enter SQL query here... (SELECT, INSERT, UPDATE, DELETE, etc.)"
          className="w-full h-full resize-none border-0 rounded font-mono text-sm focus:outline-none focus:ring-0"
          style={{
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Results */}
      <div className="flex flex-col flex-1 min-h-0 border-t">
        <Tabs value={activeResultTab} onValueChange={setActiveResultTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="justify-start w-full px-2 overflow-x-auto border-b rounded-none bg-gray-50 shrink-0">
            {results.length > 0 ? (
              results.map((res, index) => (
                <TabsTrigger
                  key={res.id}
                  value={res.id}
                  className={cn(
                    "gap-1 min-w-fit",
                    res.error && "text-red-600"
                  )}
                >
                  <span className="text-xs">{index + 1}</span>
                  {res.isExecuting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : res.error ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Table2 className="w-3 h-3" />
                  )}
                  <span className="max-w-[100px] truncate text-xs">
                    {res.sql.slice(0, 20)}...
                  </span>
                  {res.result && (
                    <span className="text-xs text-gray-500">
                      ({res.result.row_count || res.result.affected_rows || 0})
                    </span>
                  )}
                </TabsTrigger>
              ))
            ) : (
              <TabsTrigger value="placeholder" disabled className="gap-1">
                <Table2 className="w-4 h-4" />
                Results
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="gap-1 ml-auto">
              <Clock className="w-4 h-4" />
              History
              {history.length > 0 && <span className="ml-1 text-xs">({history.length})</span>}
            </TabsTrigger>
          </TabsList>

          <div className="relative flex-1 overflow-hidden">
            {results.map((res) => (
              <TabsContent
                key={res.id}
                value={res.id}
                className="absolute inset-0 m-0 data-[state=inactive]:hidden"
              >
                {res.isExecuting ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    <span className="ml-2 text-gray-500">Executing...</span>
                  </div>
                ) : res.error ? (
                  <div className="p-4">
                    <div className="flex items-start gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5 mt-0.5" />
                      <div>
                        <p className="font-medium">Query Error</p>
                        <p className="mt-1 text-sm">{res.error}</p>
                        <code className="block p-2 mt-2 text-xs rounded bg-red-50">
                          {res.sql}
                        </code>
                      </div>
                    </div>
                  </div>
                ) : res.result ? (
                  <QueryResult
                    data={res.result}
                    connectionId={connectionId}
                    databaseName={database}
                    onRefresh={executeQuery}
                  />
                ) : null}
              </TabsContent>
            ))}

            <TabsContent value="history" className="absolute inset-0 m-0 data-[state=inactive]:hidden overflow-auto">
              {history.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>{t('ui.noQueryHistory')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSql(item.sql);
                      }}
                    >
                      <code className="block font-mono text-sm text-gray-700 truncate">
                        {item.sql}
                      </code>
                      <p className="mt-1 text-xs text-gray-400">
                        {item.timestamp.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {results.length === 0 && activeResultTab !== 'history' && (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>{t('ui.executeQueryToSeeResults')}</p>
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t bg-gray-50 text-xs text-gray-500">
        {results.length > 0 && (
          <>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              {results.filter(r => !r.isExecuting).length}/{results.length} executed
            </span>
            <span>
              {results.reduce((sum, r) => sum + (r.result?.row_count || 0), 0)} total rows
            </span>
            <span>
              {results.reduce((sum, r) => sum + (r.result?.affected_rows || 0), 0)} affected
            </span>
            <span>
              {results.reduce((sum, r) => sum + r.executionTime, 0)}ms total
            </span>
            {results.some(r => r.error) && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="w-3 h-3" />
                {results.filter(r => r.error).length} errors
              </span>
            )}
          </>
        )}
      </div>

      <SaveQueryDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveQuery}
        sql={sql}
      />
    </div>
  );
};

export default SQLEditor;
