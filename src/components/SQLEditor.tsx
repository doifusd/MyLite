import { QueryResult } from '@/components/QueryResult';
import { SaveQueryDialog } from '@/components/SaveQueryDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/store/connectionStore';
import Editor, { type OnMount } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Table2
} from 'lucide-react';
import type * as MonacoEditor from 'monaco-editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'sql-formatter';

// ─── Dracula Theme Definition for Monaco ───────────────────────────────────────
const DRACULA_THEME: MonacoEditor.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'f8f8f2', background: '282a36' },
    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff79c6' },
    { token: 'keyword.sql', foreground: 'ff79c6' },
    { token: 'operator.sql', foreground: 'ff79c6' },
    { token: 'string', foreground: 'f1fa8c' },
    { token: 'string.sql', foreground: 'f1fa8c' },
    { token: 'number', foreground: 'bd93f9' },
    { token: 'number.sql', foreground: 'bd93f9' },
    { token: 'identifier', foreground: 'f8f8f2' },
    { token: 'identifier.sql', foreground: 'f8f8f2' },
    { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
    { token: 'predefined.sql', foreground: '8be9fd' },
    { token: 'delimiter', foreground: 'f8f8f2' },
    { token: 'delimiter.parenthesis', foreground: 'f8f8f2' },
    { token: 'operator', foreground: 'ff79c6' },
  ],
  colors: {
    'editor.background': '#282a36',
    'editor.foreground': '#f8f8f2',
    'editor.lineHighlightBackground': '#44475a',
    'editor.selectionBackground': '#44475a',
    'editor.selectionHighlightBackground': '#44475a80',
    'editorCursor.foreground': '#f8f8f2',
    'editorIndentGuide.background': '#44475a',
    'editorLineNumber.foreground': '#6272a4',
    'editorLineNumber.activeForeground': '#f8f8f2',
    'editorWhitespace.foreground': '#44475a',
    'editor.findMatchBackground': '#ffb86c50',
    'editor.findMatchHighlightBackground': '#ffb86c30',
    'editorGutter.background': '#282a36',
    'editorWidget.background': '#21222c',
    'editorSuggestWidget.background': '#21222c',
    'editorSuggestWidget.foreground': '#f8f8f2',
    'editorSuggestWidget.selectedBackground': '#44475a',
    'editorSuggestWidget.highlightForeground': '#8be9fd',
    'editorSuggestWidget.border': '#44475a',
    'input.background': '#21222c',
    'input.foreground': '#f8f8f2',
    'input.border': '#44475a',
    'scrollbar.shadow': '#00000030',
    'scrollbarSlider.background': '#44475a80',
    'scrollbarSlider.hoverBackground': '#44475aaa',
    'scrollbarSlider.activeBackground': '#6272a4',
  },
};

const DRACULA_LIGHT_THEME: MonacoEditor.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '282a36', background: 'f8f8f2' },
    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'd6336c' },
    { token: 'keyword.sql', foreground: 'd6336c' },
    { token: 'operator.sql', foreground: 'd6336c' },
    { token: 'string', foreground: '2e7d32' },
    { token: 'string.sql', foreground: '2e7d32' },
    { token: 'number', foreground: '7c3aed' },
    { token: 'number.sql', foreground: '7c3aed' },
    { token: 'identifier', foreground: '282a36' },
    { token: 'identifier.sql', foreground: '282a36' },
    { token: 'type', foreground: '0277bd', fontStyle: 'italic' },
    { token: 'predefined.sql', foreground: '0277bd' },
    { token: 'delimiter', foreground: '282a36' },
    { token: 'operator', foreground: 'd6336c' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#282a36',
    'editor.lineHighlightBackground': '#f5f5f0',
    'editor.selectionBackground': '#bd93f940',
    'editor.selectionHighlightBackground': '#bd93f920',
    'editorCursor.foreground': '#282a36',
    'editorIndentGuide.background': '#e0dfd5',
    'editorLineNumber.foreground': '#6272a4',
    'editorLineNumber.activeForeground': '#282a36',
    'editorGutter.background': '#ffffff',
    'editorWidget.background': '#f8f8f2',
    'editorSuggestWidget.background': '#ffffff',
    'editorSuggestWidget.foreground': '#282a36',
    'editorSuggestWidget.selectedBackground': '#f0efe9',
    'editorSuggestWidget.highlightForeground': '#bd93f9',
    'editorSuggestWidget.border': '#e0dfd5',
  },
};

// Track if themes have been registered
let themesRegistered = false;

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

  // Parameterized queries state
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [showParameters, setShowParameters] = useState(false);

  // Snippets state
  const [showSnippets, setShowSnippets] = useState(false);
  const [explainPlan, setExplainPlan] = useState<QueryResultData | null>(null);
  const [showExplainPlan, setShowExplainPlan] = useState(false);

  const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoEditor | null>(null);
  const tablesInfoRef = useRef<DatabaseTablesInfo | null>(null);

  // Detect dark mode from DOM
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  // Watch for dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Update Monaco theme when dark mode changes
  useEffect(() => {
    if (monacoRef.current && themesRegistered) {
      monacoRef.current.editor.setTheme(isDark ? 'dracula' : 'dracula-light');
    }
  }, [isDark]);

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

  // Extract parameters from SQL
  const extractParameters = (sqlText: string): string[] => {
    const matches = sqlText.match(/\?/g) || [];
    return matches.map((_, idx) => `param_${idx + 1}`);
  };

  // Replace parameters in SQL
  const replaceSQLParameters = (sqlText: string): string => {
    let result = sqlText;
    let paramIdx = 0;
    result = result.replace(/\?/g, () => {
      const key = `param_${++paramIdx}`;
      const value = parameters[key];
      if (!value) return '?';
      // Quote string values
      return isNaN(Number(value)) ? `'${value.replace(/'/g, "''")}'` : value;
    });
    return result;
  };

  // Insert SQL snippet
  const insertSnippet = (snippet: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    if (selection) {
      const range = {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn,
      };
      editor.executeEdits('insert-snippet', [{
        range: range as any,
        text: snippet,
      }]);
      editor.focus();
    }
  };

  // Execute EXPLAIN plan
  const executeExplain = async () => {
    if (!sql.trim()) return;

    setIsExecuting(true);
    try {
      const explainSQL = `EXPLAIN ${sql}`;
      const response = await invoke<QueryResultData>('execute_query', {
        connectionId: selectedConnectionId || connectionId,
        database: selectedDatabase,
        sql: explainSQL,
      });

      if (response && response.rows) {
        setExplainPlan(response as QueryResultData);
        setShowExplainPlan(true);
      }
    } catch (err: any) {
      alert(`Error executing EXPLAIN: ${err.toString()}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const executeQuery = async () => {
    const currentSql = sql.trim();
    if (!currentSql) return;

    // Replace parameters if needed
    const finalSql = replaceSQLParameters(currentSql);

    setIsExecuting(true);
    const statements = parseStatements(finalSql);

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

  // ─── Monaco Editor Mount Handler ─────────────────────────────────────────────
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco as unknown as typeof MonacoEditor;

    // Register Dracula themes (only once globally)
    if (!themesRegistered) {
      monaco.editor.defineTheme('dracula', DRACULA_THEME as any);
      monaco.editor.defineTheme('dracula-light', DRACULA_LIGHT_THEME as any);
      themesRegistered = true;
    }

    // Apply current theme
    const currentIsDark = document.documentElement.classList.contains('dark');
    monaco.editor.setTheme(currentIsDark ? 'dracula' : 'dracula-light');

    // Register SQL error diagnostics provider
    monaco.languages.registerCodeActionProvider('sql', {
      provideCodeActions: () => {
        return { actions: [], dispose: () => { } };
      },
    });

    // Validate SQL syntax on content change
    const validateSQL = (model: any) => {
      const sqlText = model.getValue().trim();
      const diagnostics: any[] = [];

      if (!sqlText) return;

      // Track line and column positions
      const lines = sqlText.split('\n');
      let bracketStack: Array<{ char: string; line: number; col: number }> = [];
      let inString = false;
      let stringChar = '';

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        for (let charIdx = 0; charIdx < line.length; charIdx++) {
          const char = line[charIdx];
          const prevChar = charIdx > 0 ? line[charIdx - 1] : '';

          // Handle string boundaries
          if ((char === "'" || char === '"' || char === '`') && prevChar !== '\\') {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
            }
          }

          if (!inString) {
            // Track brackets
            if (char === '(') {
              bracketStack.push({ char: '(', line: lineIdx, col: charIdx });
            } else if (char === ')') {
              const lastBracket = bracketStack[bracketStack.length - 1];
              if (lastBracket?.char === '(') {
                bracketStack.pop();
              } else {
                // Unmatched closing bracket
                diagnostics.push({
                  severity: monaco.MarkerSeverity.Error,
                  startLineNumber: lineIdx + 1,
                  startColumn: charIdx + 1,
                  endLineNumber: lineIdx + 1,
                  endColumn: charIdx + 2,
                  message: 'Unmatched closing parenthesis',
                });
              }
            }
          }
        }
      }

      // Check for unclosed brackets
      bracketStack.forEach(bracket => {
        diagnostics.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: bracket.line + 1,
          startColumn: bracket.col + 1,
          endLineNumber: bracket.line + 1,
          endColumn: bracket.col + 2,
          message: 'Unclosed parenthesis',
        });
      });

      // Check for basic SQL syntax errors
      const upperSQL = sqlText.toUpperCase();

      // Check for common errors: missing FROM in SELECT
      if (
        /^\s*SELECT\s+/i.test(upperSQL) &&
        !/\s+FROM\s+/i.test(upperSQL) &&
        !/^\s*SELECT\s+(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*[^)]*\s*\)/i.test(upperSQL) // Aggregate functions without FROM are valid
      ) {
        diagnostics.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 6,
          message: 'SELECT statement may be missing FROM clause',
        });
      }

      // Check for INSERT without VALUES or SET
      if (/^\s*INSERT\s+INTO\s+/i.test(upperSQL) && !/\s+(VALUES|SET)\s+/i.test(upperSQL)) {
        diagnostics.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 6,
          message: 'INSERT statement may be missing VALUES or SET clause',
        });
      }

      // Check for UPDATE without WHERE (warning only, not an error)
      if (/^\s*UPDATE\s+/i.test(upperSQL) && !/\s+WHERE\s+/i.test(upperSQL)) {
        diagnostics.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 6,
          message: 'UPDATE without WHERE will affect all rows',
        });
      }

      // Set diagnostics
      monaco.editor.setModelMarkers(model, 'sql-validator', diagnostics);
    };

    // Validate on initial content
    validateSQL(editor.getModel());

    // Validate on content change
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model) {
        validateSQL(model);
      }
    });

    // Register SQL autocomplete provider with schema-aware completions
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: MonacoEditor.languages.CompletionItem[] = [];

        // Add SQL keywords
        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
          'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'JOIN', 'INNER',
          'LEFT', 'RIGHT', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE',
          'BETWEEN', 'IS', 'NULL', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING',
          'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
          'MAX', 'MIN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS',
          'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'DEFAULT',
          'AUTO_INCREMENT', 'VARCHAR', 'INT', 'INTEGER', 'BIGINT', 'DECIMAL',
          'FLOAT', 'DOUBLE', 'TEXT', 'BLOB', 'DATE', 'DATETIME', 'TIMESTAMP',
          'BOOLEAN', 'CHAR', 'ENUM', 'IF', 'SHOW', 'DATABASES', 'TABLES',
          'DESCRIBE', 'EXPLAIN', 'USE', 'TRUNCATE', 'REPLACE', 'GRANT',
          'REVOKE', 'COMMIT', 'ROLLBACK', 'BEGIN', 'TRANSACTION', 'ASC', 'DESC',
        ];

        keywords.forEach(kw => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
            detail: 'SQL Keyword',
          } as any);
        });

        // Add table names and column names from schema
        const tablesInfo = tablesInfoRef.current;
        if (tablesInfo?.tables) {
          tablesInfo.tables.forEach(table => {
            suggestions.push({
              label: table.table_name,
              kind: monaco.languages.CompletionItemKind.Struct,
              insertText: table.table_name,
              range,
              detail: 'Table',
            } as any);

            // Add columns
            table.columns?.forEach(col => {
              suggestions.push({
                label: col,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col,
                range,
                detail: `Column (${table.table_name})`,
              } as any);
            });
          });
        }

        return { suggestions };
      },
    });

    // Add Cmd/Ctrl+Enter shortcut to execute query
    editor.addAction({
      id: 'execute-query',
      label: 'Execute Query',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      ],
      run: () => {
        executeQuery();
      },
    });

    // Focus editor
    editor.focus();
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/50">
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

        <Button
          variant="outline"
          size="sm"
          onClick={executeExplain}
          disabled={!sql.trim()}
          title="Execute EXPLAIN plan"
        >
          📊 Explain
        </Button>

        <Button
          variant={showSnippets ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowSnippets(!showSnippets)}
          title="SQL snippets"
        >
          📝 Snippets
        </Button>

        <Button
          variant={showParameters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowParameters(!showParameters)}
          title="Query parameters"
        >
          ⚙️ Params
        </Button>

        <div className="flex-1" />
      </div>

      {/* Database Selection Row */}
      <div className="flex items-center gap-3 px-2 py-2 text-sm bg-card border-b">
        <label className="font-medium text-muted-foreground min-w-fit">Connection:</label>
        <select
          value={selectedConnectionId}
          onChange={(e) => setSelectedConnectionId(e.target.value)}
          className="px-2 py-1 text-sm border border-input bg-background rounded focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select connection...</option>
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.name}
            </option>
          ))}
        </select>

        <label className="font-medium text-muted-foreground min-w-fit">Database:</label>
        <select
          value={selectedDatabase || ''}
          onChange={(e) => setSelectedDatabase(e.target.value || undefined)}
          className="px-2 py-1 text-sm border border-input bg-background rounded focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select database...</option>
          {availableDatabases.map((db) => (
            <option key={db} value={db}>
              {db}
            </option>
          ))}
        </select>

        {selectedDatabase && (
          <span className="ml-auto text-xs text-muted-foreground">
            Selected: <code className="bg-muted px-1 py-0.5 rounded">{selectedDatabase}</code>
          </span>
        )}
      </div>

      {/* SQL Input - Monaco Editor with Syntax Highlighting */}
      <div className="relative flex-1 min-h-0 border rounded overflow-hidden flex flex-col">
        {/* Parameters Panel */}
        {showParameters && (
          <div className="p-3 border-b bg-muted/20">
            <h4 className="text-xs font-semibold mb-2">Query Parameters</h4>
            <div className="grid grid-cols-auto gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {extractParameters(sql).length > 0 ? (
                extractParameters(sql).map((param) => (
                  <div key={param} className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{param}</label>
                    <input
                      type="text"
                      value={parameters[param] || ''}
                      onChange={(e) => setParameters({ ...parameters, [param]: e.target.value })}
                      placeholder="Value"
                      className="h-7 px-2 text-sm border border-input bg-background rounded"
                    />
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No parameters detected (use ? in your query)</p>
              )}
            </div>
          </div>
        )}

        {/* Snippets Panel */}
        {showSnippets && (
          <div className="p-3 border-b bg-muted/20">
            <h4 className="text-xs font-semibold mb-2">SQL Snippets</h4>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => insertSnippet('SELECT * FROM table_name WHERE condition;')}
                className="text-left text-xs px-2 py-1 bg-background border border-input rounded hover:bg-muted"
              >
                SELECT...
              </button>
              <button
                onClick={() => insertSnippet('INSERT INTO table_name (col1, col2) VALUES (?, ?);')}
                className="text-left text-xs px-2 py-1 bg-background border border-input rounded hover:bg-muted"
              >
                INSERT
              </button>
              <button
                onClick={() => insertSnippet('UPDATE table_name SET col1 = ? WHERE id = ?;')}
                className="text-left text-xs px-2 py-1 bg-background border border-input rounded hover:bg-muted"
              >
                UPDATE
              </button>
              <button
                onClick={() => insertSnippet('DELETE FROM table_name WHERE condition;')}
                className="text-left text-xs px-2 py-1 bg-background border border-input rounded hover:bg-muted"
              >
                DELETE
              </button>
              <button
                onClick={() => insertSnippet('SELECT COUNT(*) FROM table_name;')}
                className="text-left text-xs px-2 py-1 bg-background border border-input rounded hover:bg-muted"
              >
                COUNT
              </button>
              <button
                onClick={() => insertSnippet('SELECT * FROM table1 JOIN table2 ON table1.id = table2.id;')}
                className="text-left text-xs px-2 py-1 bg-background border border-input rounded hover:bg-muted"
              >
                JOIN
              </button>
            </div>
          </div>
        )}

        {/* EXPLAIN Plan Result */}
        {showExplainPlan && explainPlan && (
          <div className="p-3 border-b bg-muted/20 max-h-32 overflow-auto">
            <h4 className="text-xs font-semibold mb-2">Execution Plan</h4>
            <div className="text-xs font-mono bg-background p-2 rounded">
              {explainPlan.rows?.slice(0, 5).map((row: any[], idx: number) => (
                <div key={idx} className="text-muted-foreground">
                  {JSON.stringify(row)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            value={sql}
            onChange={(value) => {
              const newValue = value || '';
              setSql(newValue);
              onSqlChange?.(newValue);
            }}
            language="sql"
            theme={isDark ? 'dracula' : 'dracula-light'}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              fontLigatures: true,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              bracketPairColorization: { enabled: true },
              matchBrackets: 'always',
              padding: { top: 8, bottom: 8 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              roundedSelection: true,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
                verticalSliderSize: 8,
              },
              placeholder: 'Enter SQL query here... (SELECT, INSERT, UPDATE, DELETE, etc.)' as any,
            }}
            loading={
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading editor...
              </div>
            }
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col flex-1 min-h-0 border-t">
        <Tabs value={activeResultTab} onValueChange={setActiveResultTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="justify-start w-full px-2 overflow-x-auto border-b rounded-none bg-muted/30 shrink-0">
            {results.length > 0 ? (
              results.map((res, index) => (
                <TabsTrigger
                  key={res.id}
                  value={res.id}
                  className={cn(
                    "gap-1 min-w-fit",
                    res.error && "text-destructive"
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
                    <span className="text-xs text-muted-foreground">
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
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                    <span className="ml-2 text-muted-foreground">Executing...</span>
                  </div>
                ) : res.error ? (
                  <div className="p-4">
                    <div className="flex items-start gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5 mt-0.5" />
                      <div>
                        <p className="font-medium">Query Error</p>
                        <p className="mt-1 text-sm">{res.error}</p>
                        <code className="block p-2 mt-2 text-xs rounded bg-destructive/10">
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
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>{t('ui.noQueryHistory')}</p>
                </div>
              ) : (
                <div className="divide-y border-border">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 cursor-pointer hover:bg-accent/20"
                      onClick={() => {
                        setSql(item.sql);
                      }}
                    >
                      <code className="block font-mono text-sm text-foreground truncate">
                        {item.sql}
                      </code>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.timestamp.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {results.length === 0 && activeResultTab !== 'history' && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>{t('ui.executeQueryToSeeResults')}</p>
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t bg-muted text-xs text-muted-foreground">
        {results.length > 0 && (
          <>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
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
              <span className="flex items-center gap-1 text-destructive">
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
