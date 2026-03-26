import { QueryResult } from '@/components/QueryResult';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Editor, { OnMount } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/tauri';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderOpen,
  Loader2,
  Play,
  Save,
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
  const editorRef = useRef<any>(null);
  const resultIdCounter = useRef(0);

  // Sync with initialSql prop when it changes (e.g., when switching tabs back)
  useEffect(() => {
    if (initialSql !== undefined && initialSql !== sql) {
      setSql(initialSql);
      if (editorRef.current) {
        editorRef.current.setValue(initialSql);
      }
    }
  }, [initialSql]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add MySQL syntax highlighting
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: () => {
        const suggestions = [
          // MySQL keywords
          { label: 'SELECT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'SELECT' },
          { label: 'FROM', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'FROM' },
          { label: 'WHERE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'WHERE' },
          { label: 'INSERT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'INSERT' },
          { label: 'UPDATE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'UPDATE' },
          { label: 'DELETE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DELETE' },
          { label: 'CREATE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'CREATE' },
          { label: 'DROP', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DROP' },
          { label: 'ALTER', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'ALTER' },
          { label: 'TABLE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'TABLE' },
          { label: 'DATABASE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DATABASE' },
          { label: 'INDEX', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'INDEX' },
          { label: 'JOIN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'JOIN' },
          { label: 'LEFT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'LEFT' },
          { label: 'RIGHT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'RIGHT' },
          { label: 'INNER', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'INNER' },
          { label: 'OUTER', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'OUTER' },
          { label: 'GROUP', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'GROUP' },
          { label: 'ORDER', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'ORDER' },
          { label: 'BY', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'BY' },
          { label: 'HAVING', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'HAVING' },
          { label: 'LIMIT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'LIMIT' },
          { label: 'OFFSET', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'OFFSET' },
          { label: 'UNION', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'UNION' },
          { label: 'ALL', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'ALL' },
          { label: 'DISTINCT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'DISTINCT' },
          { label: 'AS', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'AS' },
          { label: 'ON', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'ON' },
          { label: 'AND', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'AND' },
          { label: 'OR', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'OR' },
          { label: 'NOT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'NOT' },
          { label: 'NULL', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'NULL' },
          { label: 'IS', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'IS' },
          { label: 'IN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'IN' },
          { label: 'EXISTS', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'EXISTS' },
          { label: 'BETWEEN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'BETWEEN' },
          { label: 'LIKE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'LIKE' },
          { label: 'COUNT', kind: monaco.languages.CompletionItemKind.Function, insertText: 'COUNT(*)' },
          { label: 'SUM', kind: monaco.languages.CompletionItemKind.Function, insertText: 'SUM()' },
          { label: 'AVG', kind: monaco.languages.CompletionItemKind.Function, insertText: 'AVG()' },
          { label: 'MAX', kind: monaco.languages.CompletionItemKind.Function, insertText: 'MAX()' },
          { label: 'MIN', kind: monaco.languages.CompletionItemKind.Function, insertText: 'MIN()' },
          { label: 'CONCAT', kind: monaco.languages.CompletionItemKind.Function, insertText: 'CONCAT()' },
          { label: 'SUBSTRING', kind: monaco.languages.CompletionItemKind.Function, insertText: 'SUBSTRING()' },
          { label: 'DATE_FORMAT', kind: monaco.languages.CompletionItemKind.Function, insertText: 'DATE_FORMAT()' },
          { label: 'NOW', kind: monaco.languages.CompletionItemKind.Function, insertText: 'NOW()' },
          { label: 'CURDATE', kind: monaco.languages.CompletionItemKind.Function, insertText: 'CURDATE()' },
        ];
        return { suggestions };
      },
    });

    // Add keyboard shortcut for execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeQuery();
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

    if (!currentSql.trim() || !connectionId) return;

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
        const data = await invoke<QueryResultData>('execute_query', {
          connectionId,
          database: database || null,
          sql: stmt,
        });

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
        setResults(prev => prev.map(r =>
          r.id === `result-${i}`
            ? { ...r, error: errorMsg, executionTime: Date.now() - startTime, isExecuting: false }
            : r
        ));
        // 出错后继续执行其他语句
      }
    }

    setIsExecuting(false);
  }, [sql, connectionId, database]);

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
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
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

        <Button variant="ghost" size="sm" className="gap-1">
          <Save className="h-4 w-4" />
          Save
        </Button>

        <Button variant="ghost" size="sm" className="gap-1">
          <FolderOpen className="h-4 w-4" />
          Open
        </Button>
      </div>

      {/* SQL Input - Monaco Editor */}
      <div className="flex-1 min-h-0">
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
          }}
        />
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 border-t flex flex-col">
        <Tabs value={activeResultTab} onValueChange={setActiveResultTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-gray-50 px-2 shrink-0 overflow-x-auto">
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
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : res.error ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <Table2 className="h-3 w-3" />
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
                <Table2 className="h-4 w-4" />
                Results
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="gap-1 ml-auto">
              <Clock className="h-4 w-4" />
              History
              {history.length > 0 && <span className="ml-1 text-xs">({history.length})</span>}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden relative">
            {results.map((res) => (
              <TabsContent
                key={res.id}
                value={res.id}
                className="absolute inset-0 m-0 data-[state=inactive]:hidden"
              >
                {res.isExecuting ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Executing...</span>
                  </div>
                ) : res.error ? (
                  <div className="p-4">
                    <div className="flex items-start gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5 mt-0.5" />
                      <div>
                        <p className="font-medium">Query Error</p>
                        <p className="text-sm mt-1">{res.error}</p>
                        <code className="text-xs bg-red-50 p-2 rounded mt-2 block">
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
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSql(item.sql);
                        if (editorRef.current) {
                          editorRef.current.setValue(item.sql);
                        }
                      }}
                    >
                      <code className="text-sm font-mono text-gray-700 block truncate">
                        {item.sql}
                      </code>
                      <p className="text-xs text-gray-400 mt-1">
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
              <CheckCircle2 className="h-3 w-3 text-green-500" />
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
                <AlertCircle className="h-3 w-3" />
                {results.filter(r => r.error).length} errors
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SQLEditor;
