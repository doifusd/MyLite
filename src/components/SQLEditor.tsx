import React, { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  Play, 
  Save, 
  FolderOpen, 
  Clock,
  Table2,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { QueryResult } from '@/components/QueryResult';
import Editor, { OnMount } from '@monaco-editor/react';

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
  className?: string;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  connectionId,
  database,
  className,
}) => {
  const [sql, setSql] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('result');
  const [history, setHistory] = useState<Array<{ sql: string; timestamp: Date }>>([]);
  const editorRef = useRef<any>(null);

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

    setIsExecuting(true);
    setError(null);
    setResult(null);
    setActiveTab('result');

    try {
      const finalSql = currentSql.trim();

      const data = await invoke<QueryResultData>('execute_query', {
        connectionId,
        database: database || null,
        sql: finalSql,
      });

      setResult(data);
      
      // Add to history
      setHistory((prev) => [
        { sql: finalSql.slice(0, 100) + (finalSql.length > 100 ? '...' : ''), timestamp: new Date() },
        ...prev.slice(0, 49), // Keep last 50 queries
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed');
    } finally {
      setIsExecuting(false);
    }
  }, [sql, connectionId, database]);

  const formatSql = () => {
    const currentSql = editorRef.current?.getValue() || sql;
    // Simple SQL formatting
    const formatted = currentSql
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ') ')
      .replace(/\s*;\s*/g, ';')
      .trim();
    
    if (editorRef.current) {
      editorRef.current.setValue(formatted);
    }
    setSql(formatted);
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
          onChange={(value) => setSql(value || '')}
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
      <div className="flex-1 min-h-0 border-t">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-gray-50 px-2">
            <TabsTrigger value="result" className="gap-1">
              <Table2 className="h-4 w-4" />
              Results
              {result && <span className="ml-1 text-xs">({result.row_count})</span>}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <Clock className="h-4 w-4" />
              History
              {history.length > 0 && <span className="ml-1 text-xs">({history.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="result" className="h-full m-0">
            {isExecuting ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="p-4">
                <div className="flex items-start gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Query Error</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            ) : result ? (
              <QueryResult data={result} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>Execute a query to see results</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="h-full m-0">
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
        </Tabs>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t bg-gray-50 text-xs text-gray-500">
        {result && (
          <>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {result.execution_time_ms}ms
            </span>
            {result.row_count > 0 && <span>{result.row_count} rows</span>}
            {result.affected_rows !== undefined && (
              <span>{result.affected_rows} affected</span>
            )}
          </>
        )}
        {error && (
          <span className="flex items-center gap-1 text-red-500">
            <AlertCircle className="h-3 w-3" />
            Error
          </span>
        )}
      </div>
    </div>
  );
};

export default SQLEditor;
