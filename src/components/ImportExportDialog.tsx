import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { invoke } from '@tauri-apps/api/core';
import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import React, { useState } from 'react';

interface ImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  database: string;
  table?: string;
}

export const ImportExportDialog: React.FC<ImportExportDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  database,
  table,
}) => {
  const [activeTab, setActiveTab] = useState('export');
  const [exportFormat, setExportFormat] = useState<'csv' | 'sql' | 'json'>('csv');
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleExport = async () => {
    if (!table) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Fetch all data
      const result = await invoke<any>('execute_query', {
        connectionId,
        database,
        sql: `SELECT * FROM \`${database}\`.\`${table}\``,
      });

      if (!result || !result.rows) {
        throw new Error('No data to export');
      }

      let content = '';
      let filename = `${table}_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

      if (exportFormat === 'csv') {
        // CSV Export
        const headers = result.columns.map((c: any) => c.name).join(',');
        const rows = result.rows.map((row: any[]) =>
          row.map(cell => {
            if (cell === null) return '';
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ).join('\n');
        content = `${headers}\n${rows}`;
        filename += '.csv';
      } else if (exportFormat === 'json') {
        // JSON Export
        const data = result.rows.map((row: any[]) => {
          const obj: Record<string, any> = {};
          result.columns.forEach((col: any, idx: number) => {
            obj[col.name] = row[idx];
          });
          return obj;
        });
        content = JSON.stringify(data, null, 2);
        filename += '.json';
      } else if (exportFormat === 'sql') {
        // SQL Export (INSERT statements)
        const inserts = result.rows.map((row: any[]) => {
          const cols: string[] = [];
          const vals: string[] = [];

          result.columns.forEach((col: any, idx: number) => {
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

          return `INSERT INTO \`${database}\`.\`${table}\` (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
        });
        content = inserts.join('\n');
        filename += '.sql';
      }

      // Create download
      const blob = new Blob([content], {
        type: exportFormat === 'json' ? 'application/json' : 'text/plain'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (err: any) {
      alert(`Export failed: ${err}`);
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile || !table) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const content = await importFile.text();
      const lines = content.split('\n').filter(line => line.trim());

      if (importFile.name.endsWith('.csv')) {
        // Parse CSV
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Simple CSV parsing (doesn't handle all edge cases)
          const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

          const cols: string[] = [];
          const vals: string[] = [];

          headers.forEach((col, idx) => {
            if (idx < values.length && values[idx] !== '') {
              cols.push(`\`${col}\``);
              vals.push(`'${values[idx].replace(/'/g, "''")}'`);
            }
          });

          if (cols.length > 0) {
            const sql = `INSERT INTO \`${database}\`.\`${table}\` (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
            try {
              await invoke('execute_query', { connectionId, database, sql });
              successCount++;
            } catch (e) {
              errorCount++;
            }
          }

          setImportProgress(Math.round(((i + 1) / rows.length) * 100));
        }
        alert(`Import complete: ${successCount} rows imported, ${errorCount} errors`);
      } else if (importFile.name.endsWith('.sql')) {
        // Execute SQL file
        const statements = content.split(';').filter(s => s.trim());
        let successCount = 0;

        for (let i = 0; i < statements.length; i++) {
          const sql = statements[i].trim() + ';';
          try {
            await invoke('execute_query', { connectionId, database, sql });
            successCount++;
          } catch (e) {
            // Continue on error
          }
          setImportProgress(Math.round(((i + 1) / statements.length) * 100));
        }

        alert(`Import complete: ${successCount}/${statements.length} statements executed`);
      }

      setIsImporting(false);
      onClose();
    } catch (err: any) {
      alert(`Import failed: ${err}`);
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import / Export</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Export Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={exportFormat === 'csv' ? 'default' : 'outline'}
                    onClick={() => setExportFormat('csv')}
                    className="flex-col h-20 gap-1"
                  >
                    <FileSpreadsheet className="h-6 w-6" />
                    <span className="text-xs">CSV</span>
                  </Button>
                  <Button
                    variant={exportFormat === 'json' ? 'default' : 'outline'}
                    onClick={() => setExportFormat('json')}
                    className="flex-col h-20 gap-1"
                  >
                    <FileJson className="h-6 w-6" />
                    <span className="text-xs">JSON</span>
                  </Button>
                  <Button
                    variant={exportFormat === 'sql' ? 'default' : 'outline'}
                    onClick={() => setExportFormat('sql')}
                    className="flex-col h-20 gap-1"
                  >
                    <span className="text-lg font-bold">SQL</span>
                    <span className="text-xs">INSERT</span>
                  </Button>
                </div>
              </div>

              {table && (
                <div className="text-sm text-muted-foreground">
                  Exporting table: <span className="font-medium text-foreground">{database}.{table}</span>
                </div>
              )}

              {isExporting && (
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{exportProgress}%</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleExport}
                disabled={!table || isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select File</label>
                <input
                  type="file"
                  accept=".csv,.sql"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
              </div>

              {table && (
                <div className="text-sm text-muted-foreground">
                  Importing to: <span className="font-medium text-foreground">{database}.{table}</span>
                </div>
              )}

              {isImporting && (
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{importProgress}%</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || !table || isImporting}
              >
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ImportExportDialog;
