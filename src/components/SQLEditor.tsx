import { QueryResult } from '@/components/QueryResult';
import { SaveQueryDialog } from '@/components/SaveQueryDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/store/connectionStore';
import Editor, { OnMount } from '@monaco-editor/react';
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

// 单个查询结果
interface QueryExecutionResult {
  id: string;
  sql: string;
  result: QueryResultData | null;
  error: string | null;
  executionTime: number;
  isExecuting: boolean;
}

// 数据库表和列信息
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
  const [sql, setSql] = useState(initialSql);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<QueryExecutionResult[]>([]);
  const [activeResultTab, setActiveResultTab] = useState<string>('');
  const [history, setHistory] = useState<Array<{ sql: string; timestamp: Date }>>([]);
  const [tablesInfo, setTablesInfo] = useState<DatabaseTablesInfo | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(connectionId);
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(database);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const editorRef = useRef<any>(null);
  const resultIdCounter = useRef(0);
  const monacoRef = useRef<any>(null);

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
      console.log('[SQLEditor] connectionId prop changed:', connectionId);
      setSelectedConnectionId(connectionId);
      // Fetch databases for this connection
      const fetchDbs = async () => {
        try {
          const dbs = await invoke<string[]>('get_databases', {
            connectionId: connectionId,
          });
          console.log('[SQLEditor] Fetched databases for connection:', { connectionId, dbs });
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
        setTablesInfo(info);
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
      if (editorRef.current) {
        editorRef.current.setValue(initialSql);
      }
    }
  }, [initialSql]);

  // 监听加载保存的查询事件
  useEffect(() => {
    const handleLoadSavedQuery = (event: any) => {
      const { sql: savedSql } = event.detail;
      setSql(savedSql);
      if (editorRef.current) {
        editorRef.current.setValue(savedSql);
      }
      onSqlChange?.(savedSql);
    };

    window.addEventListener('loadSavedQuery', handleLoadSavedQuery);
    return () => window.removeEventListener('loadSavedQuery', handleLoadSavedQuery);
  }, [onSqlChange]);

  // 生成自动补全建议
  const generateCompletionSuggestions = (monaco: any): any[] => {
    const suggestions = [
      // MySQL keywords
      { label: 'SELECT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'SELECT', sortText: '1' },
      { label: 'FROM', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'FROM', sortText: '2' },
      { label: 'WHERE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'WHERE', sortText: '3' },
      { label: 'INSERT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'INSERT INTO', sortText: '4' },
      { label: 'UPDATE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'UPDATE', sortText: '5' },
      { label: 'DELETE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DELETE FROM', sortText: '6' },
      { label: 'CREATE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'CREATE TABLE', sortText: '7' },
      { label: 'CREATE INDEX', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'CREATE INDEX idx_name ON table_name (column_name);', sortText: '7a' },
      { label: 'DROP', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DROP TABLE', sortText: '8' },
      { label: 'ALTER', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'ALTER TABLE', sortText: '9' },
      { label: 'TABLE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'TABLE', sortText: '10' },
      { label: 'DATABASE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DATABASE', sortText: '11' },
      { label: 'INDEX', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'INDEX', sortText: '12' },
      { label: 'JOIN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'JOIN', sortText: '13' },
      { label: 'LEFT JOIN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'LEFT JOIN', sortText: '14' },
      { label: 'RIGHT JOIN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'RIGHT JOIN', sortText: '15' },
      { label: 'INNER JOIN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'INNER JOIN', sortText: '16' },
      { label: 'GROUP BY', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'GROUP BY', sortText: '17' },
      { label: 'ORDER BY', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'ORDER BY', sortText: '18' },
      { label: 'HAVING', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'HAVING', sortText: '19' },
      { label: 'LIMIT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'LIMIT', sortText: '20' },
      { label: 'OFFSET', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'OFFSET', sortText: '21' },
      { label: 'UNION', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'UNION', sortText: '22' },
      { label: 'UNION ALL', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'UNION ALL', sortText: '23' },
      { label: 'DISTINCT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DISTINCT', sortText: '24' },
      { label: 'AS', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'AS', sortText: '25' },
      { label: 'ON', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'ON', sortText: '26' },
      { label: 'AND', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'AND', sortText: '27' },
      { label: 'OR', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'OR', sortText: '28' },
      { label: 'NOT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'NOT', sortText: '29' },
      { label: 'NULL', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'NULL', sortText: '30' },
      { label: 'IS NULL', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'IS NULL', sortText: '31' },
      { label: 'IS NOT NULL', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'IS NOT NULL', sortText: '32' },
      { label: 'IN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'IN', sortText: '33' },
      { label: 'EXISTS', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'EXISTS', sortText: '34' },
      { label: 'BETWEEN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'BETWEEN', sortText: '35' },
      { label: 'LIKE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'LIKE', sortText: '36' },

      // SQL Functions
      { label: 'COUNT', kind: monaco.languages.CompletionItemKind.Function, insertText: 'COUNT(*)', sortText: '50' },
      { label: 'SUM', kind: monaco.languages.CompletionItemKind.Function, insertText: 'SUM()', sortText: '51' },
      { label: 'AVG', kind: monaco.languages.CompletionItemKind.Function, insertText: 'AVG()', sortText: '52' },
      { label: 'MAX', kind: monaco.languages.CompletionItemKind.Function, insertText: 'MAX()', sortText: '53' },
      { label: 'MIN', kind: monaco.languages.CompletionItemKind.Function, insertText: 'MIN()', sortText: '54' },
      { label: 'CONCAT', kind: monaco.languages.CompletionItemKind.Function, insertText: 'CONCAT()', sortText: '55' },
      { label: 'SUBSTRING', kind: monaco.languages.CompletionItemKind.Function, insertText: 'SUBSTRING()', sortText: '56' },
      { label: 'LENGTH', kind: monaco.languages.CompletionItemKind.Function, insertText: 'LENGTH()', sortText: '57' },
      { label: 'TRIM', kind: monaco.languages.CompletionItemKind.Function, insertText: 'TRIM()', sortText: '58' },
      { label: 'UPPER', kind: monaco.languages.CompletionItemKind.Function, insertText: 'UPPER()', sortText: '59' },
      { label: 'LOWER', kind: monaco.languages.CompletionItemKind.Function, insertText: 'LOWER()', sortText: '60' },
      { label: 'REPLACE', kind: monaco.languages.CompletionItemKind.Function, insertText: 'REPLACE()', sortText: '61' },
      { label: 'DATE_FORMAT', kind: monaco.languages.CompletionItemKind.Function, insertText: 'DATE_FORMAT()', sortText: '62' },
      { label: 'NOW', kind: monaco.languages.CompletionItemKind.Function, insertText: 'NOW()', sortText: '63' },
      { label: 'CURDATE', kind: monaco.languages.CompletionItemKind.Function, insertText: 'CURDATE()', sortText: '64' },
      { label: 'CURTIME', kind: monaco.languages.CompletionItemKind.Function, insertText: 'CURTIME()', sortText: '65' },
      { label: 'DATEDIFF', kind: monaco.languages.CompletionItemKind.Function, insertText: 'DATEDIFF()', sortText: '66' },
      { label: 'DATE_ADD', kind: monaco.languages.CompletionItemKind.Function, insertText: 'DATE_ADD()', sortText: '67' },
      { label: 'COALESCE', kind: monaco.languages.CompletionItemKind.Function, insertText: 'COALESCE()', sortText: '68' },
      { label: 'IF', kind: monaco.languages.CompletionItemKind.Function, insertText: 'IF()', sortText: '69' },
      { label: 'CASE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'CASE WHEN THEN ELSE END', sortText: '70' },
    ];

    // 添加表名建议
    if (tablesInfo && tablesInfo.tables.length > 0) {
      tablesInfo.tables.forEach((table, index) => {
        suggestions.push({
          label: table.table_name,
          kind: monaco.languages.CompletionItemKind.Struct,
          insertText: table.table_name,
          sortText: `f${String(index).padStart(3, '0')}`,
        });
      });
    }

    // 添加列名建议
    if (tablesInfo && tablesInfo.tables.length > 0) {
      tablesInfo.tables.forEach((table) => {
        table.columns.forEach((column, index) => {
          suggestions.push({
            label: column,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: column,
            sortText: `g${table.table_name}_${String(index).padStart(3, '0')}`,
          });
        });
      });
    }

    return suggestions;
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // 注册自动补全提供程序
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: () => {
        const suggestions = generateCompletionSuggestions(monaco);
        return { suggestions };
      },
      triggerCharacters: [' ', '.', '(', ','],
    });

    // 注册 MySQL 的语言定义和高亮
    monaco.languages.register({ id: 'mysql' });

    // 如果 SQL 模式没有强化的高亮，则为其添加
    const sqlRulesId = 'sql';
    try {
      const currentDef = monaco.languages.getLanguages().find((l: any) => l.id === sqlRulesId);
      if (currentDef) {
        // 增强 SQL 的颜色和高亮
        monaco.editor.defineTheme('sql-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'keyword.sql', foreground: '0000FF', fontStyle: 'bold' },
            { token: 'keyword.operator.sql', foreground: 'FF0000' },
            { token: 'string.sql', foreground: '008000' },
            { token: 'number.sql', foreground: 'FF6600' },
            { token: 'identifier.sql', foreground: '000000' },
            { token: 'comment.line.sql', foreground: '008000', fontStyle: 'italic' },
          ],
          colors: {
            'editor.background': '#FFFFFF',
          },
        });
      }
    } catch (e) {
      // 主题定义失败，继续使用默认主题
    }

    // Add keyboard shortcut for execute (Ctrl+Enter / Cmd+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      console.log('[SQLEditor] Execute shortcut triggered');
      executeQuery();
    });

    // Add keyboard shortcut for format (Shift+Alt+F)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      console.log('[SQLEditor] Format shortcut triggered');
      formatSql();
    });

    // Add keyboard shortcut for save (Ctrl+S / Cmd+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      console.log('[SQLEditor] [SAVE SHORTCUT] Cmd+S/Ctrl+S triggered!');
      console.log('[SQLEditor] [SAVE SHORTCUT] About to set saveDialogOpen=true');
      setSaveDialogOpen(true);
      console.log('[SQLEditor] [SAVE SHORTCUT] setSaveDialogOpen called');
    });
  };

  // 解析多 SQL 语句（按分号分割，但忽略字符串中的分号）
  const parseMultipleStatements = (sqlText: string): string[] => {
    const statements: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (const char of sqlText) {
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        current += char;
        escaped = true;
        continue;
      }

      if (!inString && (char === "'" || char === '"' || char === '`')) {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
        current += char;
        continue;
      }

      if (!inString && char === ';') {
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
        continue;
      }

      current += char;
    }

    // 添加最后一条语句
    const trimmed = current.trim();
    if (trimmed) {
      statements.push(trimmed);
    }

    return statements;
  };

  const executeQuery = useCallback(async () => {
    let currentSql = sql;
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection && !selection.isEmpty()) {
        const model = editorRef.current.getModel();
        currentSql = model?.getValueInRange(selection) || sql;
      } else {
        currentSql = editorRef.current.getValue();
      }
    }

    console.log('[SQLEditor] executeQuery:', {
      hasSQL: currentSql.trim().length > 0,
      selectedConnectionId,
      selectedDatabase,
      availableDatabases
    });

    if (!currentSql.trim()) {
      console.warn('[SQLEditor] SQL is empty');
      return;
    }

    if (!selectedConnectionId) {
      console.warn('[SQLEditor] No connection selected');
      return;
    }

    if (!selectedDatabase) {
      console.warn('[SQLEditor] No database selected');
      return;
    }

    // 解析多语句
    const statements = parseMultipleStatements(currentSql);

    // 如果没有语句，直接返回
    if (statements.length === 0) return;

    setIsExecuting(true);

    // 清空之前的结果
    setResults([]);
    resultIdCounter.current = 0;

    // 为每个语句创建结果占位
    const initialResults: QueryExecutionResult[] = statements.map((stmt, index) => ({
      id: `result-${index}`,
      sql: stmt,
      result: null,
      error: null,
      executionTime: 0,
      isExecuting: true,
    }));
    setResults(initialResults);
    setActiveResultTab('result-0');

    // 顺序执行每个语句
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const startTime = Date.now();

      try {
        console.log('[SQLEditor] Executing statement:', { index: i, database: selectedDatabase, connectionId: selectedConnectionId });
        const data = await invoke<QueryResultData>('execute_query', {
          connectionId: selectedConnectionId,
          database: selectedDatabase,
          sql: stmt,
        });

        // Debug: Log query results, especially for DECIMAL detection
        if (data.columns && data.rows) {
          const decimalCols = data.columns
            .map((col, idx) => col.data_type.includes('DECIMAL') || col.data_type.includes('NUMERIC') ? { idx, col } : null)
            .filter(Boolean);
          if (decimalCols.length > 0) {
            console.log('[SQLEditor] Found DECIMAL columns:', decimalCols);
            console.log('[SQLEditor] DECIMAL values:', data.rows.slice(0, 5).map(row =>
              decimalCols.map((dc: any) => ({ col: dc.col.name, value: row[dc.idx] }))
            ));
          }
        }

        setResults(prev => prev.map(r =>
          r.id === `result-${i}`
            ? { ...r, result: data, executionTime: Date.now() - startTime, isExecuting: false }
            : r
        ));

        // 添加到历史
        if (i === statements.length - 1) {
          setHistory((prev) => [
            { sql: currentSql.slice(0, 100) + (currentSql.length > 100 ? '...' : ''), timestamp: new Date() },
            ...prev.slice(0, 49),
          ]);
        }
      } catch (err) {
        const errorMsg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Query execution failed';
        console.error('[SQLEditor] Execute error:', errorMsg);
        setResults(prev => prev.map(r =>
          r.id === `result-${i}`
            ? { ...r, error: errorMsg, executionTime: Date.now() - startTime, isExecuting: false }
            : r
        ));
        // 出错后继续执行其他语句
      }
    }

    setIsExecuting(false);
  }, [sql, selectedConnectionId, selectedDatabase]);

  const formatSql = () => {
    const currentSql = editorRef.current?.getValue() || sql;

    try {
      // 使用 sql-formatter 进行专业格式化
      const formatted = format(currentSql, {
        language: 'mysql',
        keywordCase: 'upper',
        indentStyle: 'standard',
        linesBetweenQueries: 2,
      });

      if (editorRef.current) {
        editorRef.current.setValue(formatted);
      }
      setSql(formatted);
      onSqlChange?.(formatted);
    } catch (err) {
      // 格式化失败时静默处理，保持原样
      console.warn('SQL format failed:', err);
    }
  };

  const handleSaveQuery = useCallback(async (queryName: string) => {
    console.log('[SQLEditor] handleSaveQuery called with:', { queryName, database, connectionId });

    try {
      // Validate inputs
      const trimmedName = queryName.trim();
      if (!trimmedName) {
        throw new Error('Query name cannot be empty');
      }

      const currentSql = editorRef.current?.getValue() || sql;
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

      // 保存查询到本地存储
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

        // 触发自定义事件以通知 SchemaBrowser 刷新
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
          Execute
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={formatSql}
          disabled={!sql.trim()}
        >
          Format
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

      {/* SQL Input - Monaco Editor */}
      <div className="relative flex-1 min-h-0">
        <Editor
          height="100%"
          language="sql"
          value={sql}
          onChange={(value) => {
            const newValue = value || '';
            setSql(newValue);
            onSqlChange?.(newValue);
          }}
          onMount={handleEditorMount}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
            },
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
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
                  <p>No query history</p>
                </div>
              ) : (
                <div className="divide-y">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSql(item.sql);
                        if (editorRef.current) {
                          editorRef.current.setValue(item.sql);
                        }
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
                <p>Execute a query to see results</p>
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
