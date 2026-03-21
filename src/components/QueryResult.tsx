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
  X
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

interface QueryResultProps {
  data: QueryResultData;
  className?: string;
}

const ROWS_PER_PAGE_OPTIONS = [50, 100, 200, 500, 1000];

export const QueryResult: React.FC<QueryResultProps> = ({
  data,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

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

  // Handle non-SELECT results
  if (data.columns.length === 0 && data.affected_rows !== undefined) {
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

  if (data.rows.length === 0) {
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
              {currentRows.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className="text-sm font-mono whitespace-nowrap"
                    >
                      {cell === null ? (
                        <span className="text-gray-400 italic">NULL</span>
                      ) : typeof cell === 'object' ? (
                        JSON.stringify(cell)
                      ) : (
                        String(cell)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
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
    </div>
  );
};

export default QueryResult;
