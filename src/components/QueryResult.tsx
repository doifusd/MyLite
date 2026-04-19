import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileJson,
  Maximize2,
  Minimize2,
  Plus,
  Save,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { VirtualTable } from './VirtualTable';

interface InsertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sql: string) => void;
  columns: ColumnInfo[];
  tableName: string;
  databaseName: string;
}

const InsertDialog: React.FC<InsertDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  columns,
  tableName,
  databaseName,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSave = () => {
    const cols: string[] = [];
    const vals: string[] = [];

    columns.forEach(col => {
      if (values[col.name] !== undefined && values[col.name] !== '') {
        cols.push(`\`${col.name}\``);
        if (values[col.name] === 'NULL') {
          vals.push('NULL');
        } else if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'float', 'double'].some(t => col.data_type.toLowerCase().includes(t))) {
          vals.push(values[col.name]);
        } else {
          vals.push(`'${values[col.name].replace(/'/g, "''")}'`);
        }
      }
    });

    if (cols.length === 0) {
      alert('Please fill in at least one column');
      return;
    }

    const sql = `INSERT INTO \`${databaseName}\`.\`${tableName}\` (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
    onSave(sql);
    setValues({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-[1px]">
      <div className="bg-background border rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-auto p-6">
        <h3 className="text-lg font-semibold mb-4">Insert New Row</h3>
        <div className="space-y-3">
          {columns.map(col => (
            <div key={col.name} className="grid grid-cols-[150px_1fr] items-center gap-2">
              <label className="text-sm font-medium">
                {col.name}
                <span className="text-muted-foreground text-xs ml-1">({col.data_type})</span>
              </label>
              <Input
                placeholder={col.is_nullable ? 'NULL' : 'Required'}
                className="h-8"
                value={values[col.name] || ''}
                onChange={(e) => setValues({ ...values, [col.name]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Insert</Button>
        </div>
      </div>
    </div>
  );
};

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable?: boolean;
  max_length?: number;
}

export interface QueryResultData {
  columns: ColumnInfo[];
  rows: any[][];
  row_count: number;
  execution_time_ms: number;
  affected_rows?: number;
  last_insert_id?: number;
}

interface QueryResultProps {
  data: QueryResultData;
  className?: string;
  tableName?: string;
  databaseName?: string;
  connectionId?: string;
  onRefresh?: () => void;
}

const ROWS_PER_PAGE_OPTIONS = [50, 100, 200, 500, 1000];

export const QueryResult: React.FC<QueryResultProps> = ({
  data,
  className,
  tableName,
  databaseName,
  connectionId,
  onRefresh,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const tableAreaRef = useRef<HTMLDivElement>(null);
  const [tableAreaHeight, setTableAreaHeight] = useState(400);

  useEffect(() => {
    const el = tableAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setTableAreaHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setTableAreaHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const handleCellClick = (rowIndex: number, colIndex: number, value: any) => {
    if (!tableName || !databaseName || !connectionId) return;
    setEditingCell({ rowIndex, colIndex });
    setEditValue(value === null ? 'NULL' : String(value));
  };

  const handleCellSave = async () => {
    if (!editingCell || !tableName || !databaseName || !connectionId) return;

    const { rowIndex, colIndex } = editingCell;
    const row = currentRows[rowIndex];
    const col = data.columns[colIndex];
    const originalValue = row[colIndex];

    // Skip if no change
    const newValue = editValue === 'NULL' ? null : editValue;
    if (newValue === originalValue) {
      setEditingCell(null);
      return;
    }

    // Build UPDATE SQL
    const setClause = editValue === 'NULL'
      ? `\`${col.name}\` = NULL`
      : `\`${col.name}\` = '${editValue.replace(/'/g, "''")}'`;

    // Build WHERE clause using primary key or all columns
    const whereConditions: string[] = [];
    data.columns.forEach((c, idx) => {
      const val = row[idx];
      if (val === null) {
        whereConditions.push(`\`${c.name}\` IS NULL`);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        whereConditions.push(`\`${c.name}\` = ${val}`);
      } else {
        whereConditions.push(`\`${c.name}\` = '${String(val).replace(/'/g, "''")}'`);
      }
    });

    const sql = `UPDATE \`${databaseName}\`.\`${tableName}\` SET ${setClause} WHERE ${whereConditions.join(' AND ')} LIMIT 1;`;

    try {
      await invoke('execute_query', {
        connectionId,
        database: databaseName,
        sql,
      });
      onRefresh?.();
    } catch (err: any) {
      alert(`Error updating cell: ${err}`);
    }

    setEditingCell(null);
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle virtual table cell edit
  const handleVirtualCellEdit = async (rowIndex: number, colIndex: number, value: any) => {
    if (!tableName || !databaseName || !connectionId) return;

    const row = data.rows[rowIndex];
    const col = data.columns[colIndex];
    const originalValue = row[colIndex];

    // Skip if no change
    if (value === originalValue) return;

    // Build UPDATE SQL
    const setClause = value === null
      ? `\`${col.name}\` = NULL`
      : `\`${col.name}\` = '${String(value).replace(/'/g, "''")}'`;

    // Build WHERE clause using all columns
    const whereConditions: string[] = [];
    data.columns.forEach((c, idx) => {
      const val = row[idx];
      if (val === null) {
        whereConditions.push(`\`${c.name}\` IS NULL`);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        whereConditions.push(`\`${c.name}\` = ${val}`);
      } else {
        whereConditions.push(`\`${c.name}\` = '${String(val).replace(/'/g, "''")}'`);
      }
    });

    const sql = `UPDATE \`${databaseName}\`.\`${tableName}\` SET ${setClause} WHERE ${whereConditions.join(' AND ')} LIMIT 1;`;

    try {
      await invoke('execute_query', {
        connectionId,
        database: databaseName,
        sql,
      });
      onRefresh?.();
    } catch (err: any) {
      alert(`Error updating cell: ${err}`);
    }
  };

  const [insertDialogOpen, setInsertDialogOpen] = useState(false);

  const totalPages = Math.ceil(data.rows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, data.rows.length);
  const currentRows = data.rows.slice(startIndex, endIndex);

  const handleCopy = () => {
    const text = [
      data.columns.map((c) => c.name).join('\t'),
      ...data.rows.map((row) => row.join('\t')),
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRow = (row: any[]) => {
    const text = row.map(cell => cell === null ? 'NULL' : String(cell)).join('\t');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRowWithColumns = (row: any[]) => {
    const cols = data.columns.map(c => c.name).join('\t');
    const text = row.map(cell => cell === null ? 'NULL' : String(cell)).join('\t');
    navigator.clipboard.writeText(`${cols}\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateInsertSQL = (row: any[], excludeAutoInc: boolean) => {
    const table = tableName || 'table_name';
    const cols: string[] = [];
    const vals: string[] = [];

    data.columns.forEach((col, idx) => {
      if (excludeAutoInc && col.name.toLowerCase() === 'id') return;
      cols.push(`\`${col.name}\``);

      const val = row[idx];
      if (val === null) {
        vals.push('NULL');
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        vals.push(String(val));
      } else {
        vals.push(`'${String(val).replace(/'/g, "''")}'`);
      }
    });

    return `INSERT INTO \`${table}\` (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
  };

  const handleCopyInsert = (row: any[], excludeAutoInc: boolean) => {
    const sql = generateInsertSQL(row, excludeAutoInc);
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateDeleteSQL = (row: any[]) => {
    const table = tableName || 'table_name';
    const conditions: string[] = [];

    data.columns.forEach((col, idx) => {
      const val = row[idx];
      if (val === null) {
        conditions.push(`\`${col.name}\` IS NULL`);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        conditions.push(`\`${col.name}\` = ${val}`);
      } else {
        conditions.push(`\`${col.name}\` = '${String(val).replace(/'/g, "''")}'`);
      }
    });

    return `DELETE FROM \`${table}\` WHERE ${conditions.join(' AND ')} LIMIT 1;`;
  };

  const handleDeleteRow = async (row: any[]) => {
    if (!tableName || !databaseName || !connectionId) {
      alert("Table information is missing, cannot delete row directly.");
      return;
    }

    if (!confirm("Are you sure you want to delete this row?")) return;

    const sql = generateDeleteSQL(row);
    try {
      await invoke('execute_query', {
        connectionId,
        database: databaseName || null,
        sql,
      });
      onRefresh?.();
    } catch (err: any) {
      alert(`Error deleting row: ${err}`);
    }
  };

  const handleDuplicateRow = async (row: any[]) => {
    if (!tableName || !databaseName || !connectionId) {
      alert("Table information is missing, cannot duplicate row directly.");
      return;
    }

    const sql = generateInsertSQL(row, true);
    try {
      await invoke('execute_query', {
        connectionId,
        database: databaseName || null,
        sql,
      });
      onRefresh?.();
    } catch (err: any) {
      alert(`Error duplicating row: ${err}`);
    }
  };

  // Removed unused handleExport function

  // Handle non-SELECT results (INSERT, UPDATE, DELETE, etc.)
  if (data.columns.length === 0 && typeof data.affected_rows === 'number') {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-lg font-medium text-[#50fa7b]">
          Query executed successfully
        </p>
        <p className="text-muted-foreground mt-2">
          {data.affected_rows} row(s) affected
        </p>
        {data.last_insert_id && (
          <p className="text-muted-foreground">
            Last insert ID: {data.last_insert_id}
          </p>
        )}
        <p className="text-sm text-muted-foreground/60 mt-2">
          {data.execution_time_ms}ms
        </p>
      </div>
    );
  }

  if (data.rows.length === 0 && data.columns.length === 0) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-muted-foreground">Query returned no results</p>
        <p className="text-sm text-muted-foreground/60 mt-2">
          {data.execution_time_ms}ms
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1 h-8"
          >
            {copied ? (
              <Check className="h-4 w-4 text-[#50fa7b]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            variant={viewMode === 'json' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('json')}
            className="gap-1"
          >
            <FileJson className="h-4 w-4" />
            JSON
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Rows per page */}
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-8 px-2 rounded-md border bg-background text-sm"
          >
            {ROWS_PER_PAGE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}/page</option>
            ))}
          </select>

          {/* Pagination - always show */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2 min-w-[60px] text-center">
              {currentPage} / {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Badge variant="secondary" className="font-mono">
          {data.row_count} rows
        </Badge>
      </div>

      {/* Results */}
      <div ref={tableAreaRef} className="flex-1 min-h-0">
        {viewMode === 'table' ? (
          data.rows.length > 1000 ? (
            // Use virtual scrolling for large datasets
            <VirtualTable
              columns={data.columns}
              rows={data.rows}
              containerHeight={tableAreaHeight}
              className="h-full"
              onCellEdit={tableName && databaseName && connectionId ? handleVirtualCellEdit : undefined}
              onRowCopy={handleCopyRow}
              onRowCopyWithColumns={handleCopyRowWithColumns}
              onRowCopyInsert={handleCopyInsert}
              onRowDuplicate={tableName && databaseName && connectionId ? handleDuplicateRow : undefined}
              onRowDelete={tableName && databaseName && connectionId ? handleDeleteRow : undefined}
              onInsertNew={() => setInsertDialogOpen(true)}
              tableName={tableName}
            />
          ) : (
            // Use regular table for small datasets
            <div
              className="overflow-auto border rounded-sm"
              style={{ height: tableAreaHeight }}
            >
              <Table style={{ width: 'max-content', minWidth: '100%' }}>
                <TableHeader className="sticky top-0 bg-muted/50 z-10">
                  <TableRow>
                    {data.columns.map((col) => (
                      <TableHead
                        key={col.name}
                        className="font-semibold text-xs whitespace-nowrap bg-muted/50 h-9"
                        title={col.data_type}
                      >
                        {col.name}
                        <span className="text-muted-foreground font-normal ml-1">
                          ({col.data_type})
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRows.length > 0 ? (
                    currentRows.map((row, rowIndex) => (
                      <ContextMenu key={rowIndex}>
                        <ContextMenuTrigger asChild>
                          <TableRow className="hover:bg-muted/30 data-[state=open]:bg-accent">
                            {row.map((cell, cellIndex) => (
                              <TableCell
                                key={cellIndex}
                                className="text-sm font-mono whitespace-nowrap cursor-pointer hover:bg-accent/20 h-9"
                                onClick={() => handleCellClick(rowIndex, cellIndex, cell)}
                              >
                                {editingCell?.rowIndex === rowIndex && editingCell?.colIndex === cellIndex ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="h-7 w-32 text-xs"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCellSave();
                                        if (e.key === 'Escape') handleCellCancel();
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCellSave();
                                      }}
                                    >
                                      <Save className="h-3 w-3 text-[#50fa7b]" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCellCancel();
                                      }}
                                    >
                                      <X className="h-3 w-3 text-[#ff5555]" />
                                    </Button>
                                  </div>
                                ) : cell === null ? (
                                  <span className="text-muted-foreground italic opacity-50">NULL</span>
                                ) : typeof cell === 'object' ? (
                                  JSON.stringify(cell)
                                ) : (
                                  String(cell)
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-64">
                          <ContextMenuItem onClick={() => handleCopyRow(row)}>
                            Copy
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleCopyRowWithColumns(row)}>
                            Copy with Column Names
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleCopyInsert(row, false)}>
                            Copy as SQL INSERT
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleCopyInsert(row, true)}>
                            Copy as SQL INSERT (no auto_inc)
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={() => setInsertDialogOpen(true)}
                            disabled={!tableName}
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            Insert New Row
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleDuplicateRow(row)}
                            disabled={!tableName}
                          >
                            Duplicate Row
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleDeleteRow(row)}
                            disabled={!tableName}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            Delete Row
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={data.columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No data in this table
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )
        ) : (
          <div className="overflow-auto p-4 bg-[#1e1f29]" style={{ height: tableAreaHeight }}>
            <pre className="text-sm text-[#50fa7b] font-mono">
              {JSON.stringify(
                currentRows.map((row) => {
                  const obj: Record<string, any> = {};
                  data.columns.forEach((col, idx) => {
                    obj[col.name] = row[idx];
                  });
                  return obj;
                }),
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Showing {startIndex + 1} - {endIndex} of {data.row_count} rows
        </span>
        <span>
          Execution time: {data.execution_time_ms}ms
        </span>
      </div>

      <InsertDialog
        isOpen={insertDialogOpen}
        onClose={() => setInsertDialogOpen(false)}
        onSave={async (sql) => {
          try {
            await invoke('execute_query', {
              connectionId,
              database: databaseName,
              sql,
            });
            setInsertDialogOpen(false);
            onRefresh?.();
          } catch (err: any) {
            alert(`Error inserting row: ${err}`);
          }
        }}
        columns={data.columns}
        tableName={tableName || ''}
        databaseName={databaseName || ''}
      />
    </div>
  );
};

export default QueryResult;
