import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { Columns as ColumnsIcon, Edit2, Key, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ColumnEditorDialog } from './ColumnEditorDialog';
import { IndexEditorDialog } from './IndexEditorDialog';
import { TablePropertiesDialog } from './TablePropertiesDialog';

interface TableStructureViewProps {
  connectionId: string;
  database: string;
  table: string;
  className?: string;
}

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
  is_auto_increment: boolean;
  comment?: string;
  character_set?: string;
  collation?: string;
  max_length?: number;
}

interface IndexInfo {
  name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
  index_type: string;
}

interface TableInfo {
  name: string;
  schema: string;
  engine?: string;
  comment?: string;
  create_sql?: string;
  collation?: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

export const TableStructureView: React.FC<TableStructureViewProps> = ({
  connectionId,
  database,
  table,
  className,
}) => {
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [indexDialogOpen, setIndexDialogOpen] = useState(false);
  const [tablePropertiesOpen, setTablePropertiesOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ColumnInfo | undefined>();

  const fetchInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<TableInfo>('get_table_info', {
        connectionId,
        database,
        table,
      });
      setInfo(result);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, [connectionId, database, table]);

  const handleAlterTable = async (sql: string) => {
    try {
      await invoke('alter_table', {
        connectionId,
        database,
        table,
        sql,
      });
      setColumnDialogOpen(false);
      setIndexDialogOpen(false);
      setTablePropertiesOpen(false);
      fetchInfo();
    } catch (err: any) {
      alert(`Error altering table: ${err}`);
    }
  };

  const handleDropColumn = async (columnName: string) => {
    if (!confirm(`Are you sure you want to drop column "${columnName}"?`)) return;
    const sql = `ALTER TABLE \`${table}\` DROP COLUMN \`${columnName}\``;
    handleAlterTable(sql);
  };

  const handleDropIndex = async (indexName: string) => {
    if (!confirm(`Are you sure you want to drop index "${indexName}"?`)) return;
    const sql = indexName === 'PRIMARY'
      ? `ALTER TABLE \`${table}\` DROP PRIMARY KEY`
      : `ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``;
    handleAlterTable(sql);
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-destructive mb-4">{error}</p>
        <button
          onClick={fetchInfo}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className={cn('flex flex-col h-full overflow-auto p-6 md:p-8 space-y-10 bg-background', className)}>
      {/* Table Metadata */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Table Information
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-card rounded-2xl shadow-sm border border-border hover:shadow-md transition-all duration-300">
          <div>
            <p className="text-xs text-muted-foreground">Engine</p>
            <p className="font-medium text-foreground">{info.engine || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collation</p>
            <p className="font-medium text-foreground">{info.collation || 'N/A'}</p>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" className="h-8 gap-1 ml-auto" onClick={() => setTablePropertiesOpen(true)}>
              <Edit2 className="h-3 w-3" /> Edit Properties
            </Button>
          </div>
        </div>
      </div>

      {/* DDL removed: Show via right click context menu */}

      {/* Columns */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ColumnsIcon className="h-5 w-5" />
            Columns
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 shadow-sm rounded-full bg-card hover:bg-accent transition-all font-medium border-border hover:border-primary/30 hover:text-primary"
            onClick={() => {
              setEditingColumn(undefined);
              setColumnDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Column
          </Button>
        </div>
        <div className="bg-card border border-border ring-1 ring-foreground/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PK</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Length</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Charset</TableHead>
                <TableHead>Collation</TableHead>
                <TableHead>Extra</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {info.columns.map((col) => (
                <TableRow key={col.name}>
                  <TableCell>
                    {col.is_primary_key && <Key className="h-3 w-3 text-[#ffb86c]" />}
                  </TableCell>
                  <TableCell className="font-medium">{col.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{col.data_type}</Badge>
                  </TableCell>
                  <TableCell>{col.max_length || '-'}</TableCell>
                  <TableCell>{col.is_nullable ? 'YES' : 'NO'}</TableCell>
                  <TableCell>{col.default_value === null ? 'NULL' : col.default_value || '-'}</TableCell>
                  <TableCell>{col.character_set || '-'}</TableCell>
                  <TableCell>{col.collation || '-'}</TableCell>
                  <TableCell>
                    {col.is_auto_increment && <Badge>auto_increment</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingColumn(col);
                          setColumnDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#ff5555] hover:text-[#ff5555] hover:bg-[#ff5555]/10"
                        onClick={() => handleDropColumn(col.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Indexes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Indexes
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 shadow-sm rounded-full bg-card hover:bg-accent transition-all font-medium border-border hover:border-primary/30 hover:text-primary"
            onClick={() => setIndexDialogOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add Index
          </Button>
        </div>
        <div className="bg-card border border-border ring-1 ring-foreground/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Unique</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Columns</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {info.indexes.map((idx) => (
                <TableRow key={idx.name}>
                  <TableCell className="font-medium">{idx.name}</TableCell>
                  <TableCell>{idx.is_unique ? 'YES' : 'NO'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{idx.index_type}</Badge>
                  </TableCell>
                  <TableCell>{idx.columns.join(', ')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#ff5555] hover:text-[#ff5555] hover:bg-[#ff5555]/10"
                        onClick={() => handleDropIndex(idx.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ColumnEditorDialog
        isOpen={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        onSave={handleAlterTable}
        connectionId={connectionId}
        tableName={table}
        initialData={editingColumn}
      />

      <IndexEditorDialog
        isOpen={indexDialogOpen}
        onClose={() => setIndexDialogOpen(false)}
        onSave={handleAlterTable}
        tableName={table}
        availableColumns={info.columns.map(c => c.name)}
      />

      <TablePropertiesDialog
        isOpen={tablePropertiesOpen}
        onClose={() => setTablePropertiesOpen(false)}
        onSave={handleAlterTable}
        connectionId={connectionId}
        tableName={table}
        initialCollation={info.collation}
      />
    </div>
  );
};
