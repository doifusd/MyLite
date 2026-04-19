import React, { useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X, Plus } from 'lucide-react';

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable?: boolean;
  max_length?: number;
}

interface VirtualTableProps {
  columns: ColumnInfo[];
  rows: any[][];
  rowHeight?: number;
  headerHeight?: number;
  className?: string;
  onCellEdit?: (rowIndex: number, colIndex: number, value: any) => void;
  onRowCopy?: (row: any[]) => void;
  onRowCopyWithColumns?: (row: any[]) => void;
  onRowCopyInsert?: (row: any[], excludeAutoInc: boolean) => void;
  onRowDuplicate?: (row: any[]) => void;
  onRowDelete?: (row: any[]) => void;
  onInsertNew?: () => void;
  tableName?: string;
  containerHeight?: number;
}

const DEFAULT_ROW_HEIGHT = 36;
const DEFAULT_HEADER_HEIGHT = 40;
const OVERSCAN_COUNT = 5;

export const VirtualTable: React.FC<VirtualTableProps> = ({
  columns,
  rows,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  className,
  onCellEdit,
  onRowCopy,
  onRowCopyWithColumns,
  onRowCopyInsert,
  onRowDuplicate,
  onRowDelete,
  onInsertNew,
  tableName,
  containerHeight = 400,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [editingCell, setEditingCell] = useState<{rowIndex: number; colIndex: number} | null>(null);
  const [editValue, setEditValue] = useState('');

  // Calculate visible range
  const totalHeight = rows.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_COUNT);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + OVERSCAN_COUNT * 2;
  const endIndex = Math.min(rows.length, startIndex + visibleCount);
  const visibleRows = rows.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Handle cell click for editing
  const handleCellClick = (rowIndex: number, colIndex: number, value: any) => {
    if (!onCellEdit) return;
    const actualRowIndex = startIndex + rowIndex;
    setEditingCell({ rowIndex: actualRowIndex, colIndex });
    setEditValue(value === null ? 'NULL' : String(value));
  };

  // Handle cell save
  const handleCellSave = () => {
    if (!editingCell || !onCellEdit) return;
    const newValue = editValue === 'NULL' ? null : editValue;
    onCellEdit(editingCell.rowIndex, editingCell.colIndex, newValue);
    setEditingCell(null);
  };

  // Handle cell cancel
  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Render cell content
  const renderCell = (cell: any, rowIndex: number, colIndex: number) => {
    const actualRowIndex = startIndex + rowIndex;
    const isEditing = editingCell?.rowIndex === actualRowIndex && editingCell?.colIndex === colIndex;

    if (isEditing) {
      return (
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
      );
    }

    if (cell === null) {
      return <span className="text-muted-foreground italic opacity-50">NULL</span>;
    }

    if (typeof cell === 'object') {
      return JSON.stringify(cell);
    }

    return String(cell);
  };

  // Column widths (memoized)
  const columnWidths = useMemo(() => {
    return columns.map(col => {
      // Estimate width based on data type and name length
      const baseWidth = Math.max(80, col.name.length * 10 + 20);
      if (col.data_type.includes('int') || col.data_type.includes('decimal')) {
        return Math.max(baseWidth, 100);
      }
      if (col.data_type.includes('varchar') || col.data_type.includes('text')) {
        return Math.max(baseWidth, 150);
      }
      if (col.data_type.includes('datetime') || col.data_type.includes('timestamp')) {
        return Math.max(baseWidth, 160);
      }
      return baseWidth;
    });
  }, [columns]);

  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto relative', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight + headerHeight, minWidth: totalWidth }}>
        {/* Header */}
        <div
          className="sticky top-0 z-20 bg-muted/50 border-b flex"
          style={{ height: headerHeight }}
        >
          {columns.map((col, idx) => (
            <div
              key={col.name}
              className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r last:border-r-0 flex items-center"
              style={{ width: columnWidths[idx] }}
              title={col.data_type}
            >
              <span className="truncate">
                {col.name}
                <span className="text-muted-foreground/50 font-normal ml-1">
                  ({col.data_type})
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Virtual rows */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleRows.map((row, rowIndex) => {
            const actualRowIndex = startIndex + rowIndex;
            return (
              <ContextMenu key={actualRowIndex}>
                <ContextMenuTrigger asChild>
                  <div
                    className="flex hover:bg-muted/40 border-b last:border-b-0 transition-colors"
                    style={{ height: rowHeight }}
                  >
                    {row.map((cell, cellIndex) => (
                      <div
                        key={cellIndex}
                        className="flex-shrink-0 px-3 py-2 text-sm font-mono whitespace-nowrap overflow-hidden text-ellipsis border-r last:border-r-0 cursor-pointer hover:bg-accent/20 flex items-center"
                        style={{ width: columnWidths[cellIndex] }}
                        onClick={() => handleCellClick(rowIndex, cellIndex, cell)}
                      >
                        {renderCell(cell, rowIndex, cellIndex)}
                      </div>
                    ))}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-64">
                  <ContextMenuItem onClick={() => onRowCopy?.(row)}>
                    Copy
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onRowCopyWithColumns?.(row)}>
                    Copy with Column Names
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onRowCopyInsert?.(row, false)}>
                    Copy as SQL INSERT
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onRowCopyInsert?.(row, true)}>
                    Copy as SQL INSERT (no auto_inc)
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem 
                    onClick={() => onInsertNew?.()}
                    disabled={!tableName}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Insert New Row
                  </ContextMenuItem>
                  <ContextMenuItem 
                    onClick={() => onRowDuplicate?.(row)}
                    disabled={!tableName}
                  >
                    Duplicate Row
                  </ContextMenuItem>
                  <ContextMenuItem 
                    onClick={() => onRowDelete?.(row)}
                    disabled={!tableName}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    Delete Row
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VirtualTable;
