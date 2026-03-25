import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Loader2, RefreshCw, Upload, Download } from 'lucide-react';
import { QueryResult } from './QueryResult';
import { ImportExportDialog } from './ImportExportDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TableDataViewProps {
  connectionId: string;
  database: string;
  table: string;
  className?: string;
}

export const TableDataView: React.FC<TableDataViewProps> = ({
  connectionId,
  database,
  table,
  className,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importExportOpen, setImportExportOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('get_table_preview', {
        connectionId,
        database,
        table,
        limit: 50,
      });
      setData(result);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [connectionId, database, table]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-end px-4 py-2 border-b bg-gray-50 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportExportOpen(true)}
          className="gap-1"
        >
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportExportOpen(true)}
          className="gap-1"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
      <QueryResult 
        data={data} 
        className="flex-1" 
        tableName={table}
        databaseName={database}
        connectionId={connectionId}
        onRefresh={fetchData}
      />
      <ImportExportDialog
        isOpen={importExportOpen}
        onClose={() => setImportExportOpen(false)}
        connectionId={connectionId}
        database={database}
        table={table}
      />
    </div>
  );
};
