import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  FileJson,
  Table2,
  Maximize2,
  Minimize2,
  Search,
  X,
  Plus,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { invoke } from '@tauri-apps/api/tauri';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[600px] max-h-[80vh] overflow-auto p-6">
        <h3 className="text-lg font-semibold mb-4">Insert New Row</h3>
        <div className="space-y-3">
          {columns.map(col => (
            <div key={col.name} className="grid grid-cols-[150px_1fr] items-center gap-2">
              <label className="text-sm font-medium">
                {col.name}
                <span className="text-gray-400 text-xs ml-1">({col.data_type})</span>
              </label>
              <Input
                placeholder={col.is_nullable ? 'NULL' : 'Required'}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

  const [editingCell, setEditingCell] = useState<{rowIndex: number; colIndex: number} | null>(null);
  const [editValue, setEditValue] = useState('');
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

  const [insertDialogOpen, setInsertDialogOpen] = useState(false);

  // Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return data.rows;
    const term = searchTerm.toLowerCase();
    return data.rows.filter(row =>
      row.some(cell => {
        if (cell === null) return false;
        return String(cell).toLowerCase().includes(term);
      })
    );
  }, [data.rows, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filteredRows.length);
  const currentRows = filteredRows.slice(startIndex, endIndex);

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

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const csv = [
        data.columns.map((c) => c.name).join(','),
        ...data.rows.map((row) =>
          row
            .map((cell) => {
              if (cell === null) return '';
              const str = String(cell);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_result_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Export as JSON
      const jsonData = data.rows.map((row) => {
        const obj: Record<string, any> = {};
        data.columns.forEach((col, idx) => {
          obj[col.name] = row[idx];
        });
        return obj;
      });

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_result_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Handle non-SELECT results (INSERT, UPDATE, DELETE, etc.)
  if (data.columns.length === 0 && typeof data.affected_rows === 'number') {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-lg font-medium text-green-600">
          Query executed successfully
        </p>
        <p className="text-gray-500 mt-2">
          {data.affected_rows} row(s) affected
        </p>
        {data.last_insert_id && (
          <p className="text-gray-500">
            Last insert ID: {data.last_insert_id}
          </p>
        )}
        <p className="text-sm text-gray-400 mt-2">
          {data.execution_time_ms}ms
        </p>
      </div>
    );
  }

  if (data.rows.length === 0 && data.columns.length === 0) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-gray-500">Query returned no results</p>
        <p className="text-sm text-gray-400 mt-2">
          {data.execution_time_ms}ms
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            className="gap-1"
          >
            <FileJson className="h-4 w-4" />
            JSON
          </Button>
          <div className="h-4 w-px bg-gray-300 mx-1" />
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="gap-1"
          >
            <Table2 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'json' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('json')}
            className="gap-1"
          >
            <FileJson className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 w-48"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Rows per page */}
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-9 px-2 rounded-md border bg-white text-sm"
          >
            {ROWS_PER_PAGE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}/page</option>
            ))}
          </select>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

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
          {filteredRows.length} rows
          {searchTerm && ` (filtered from ${data.row_count})`}
        </Badge>
      </div>

      {/* Results */}
      {viewMode === 'table' ? (
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                {data.columns.map((col) => (
                  <TableHead
                    key={col.name}
                    className="font-semibold text-xs whitespace-nowrap"
                    title={col.data_type}
                  >
                    {col.name}
                    <span className="text-gray-400 font-normal ml-1">
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
                      <TableRow className="hover:bg-gray-50 data-[state=open]:bg-gray-100">
                        {row.map((cell, cellIndex) => (
                          <TableCell
                            key={cellIndex}
                            className="text-sm font-mono whitespace-nowrap cursor-pointer hover:bg-blue-50"
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
                                  <Save className="h-3 w-3 text-green-600" />
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
                                  <X className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                            ) : cell === null ? (
                              <span className="text-gray-400 italic">NULL</span>
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
                        className="text-red-600 focus:text-red-700 focus:bg-red-50"
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
                    className="h-24 text-center text-gray-500"
                  >
                    No data in this table
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 bg-gray-900">
          <pre className="text-sm text-green-400 font-mono">
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

      {/* Footer */}
      <div className="px-3 py-2 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
        <span>
          Showing {startIndex + 1} - {endIndex} of {filteredRows.length} rows
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
