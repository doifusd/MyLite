import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/tauri';
import { Check, Code, Copy, Database, Loader2, Table, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { SchemaBrowser } from './SchemaBrowser';
import { SQLEditor } from './SQLEditor';
import { TableDataView } from './TableDataView';

interface DatabaseWorkspaceProps {
  connectionId: string;
  connectionName: string;
  className?: string;
  onClose?: () => void;
}

export const DatabaseWorkspace: React.FC<DatabaseWorkspaceProps> = ({
  connectionId,
  connectionName,
  className,
  onClose,
}) => {
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>();
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('query');
  // Persist SQL editor content across tab switches
  const [sqlContent, setSqlContent] = useState<string>('');

  // DDL for Structure tab
  const [ddl, setDdl] = useState<string | null>(null);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlCopied, setDdlCopied] = useState(false);

  useEffect(() => {
    if (!selectedDatabase || !selectedTable) {
      setDdl(null);
      return;
    }
    setDdl(null);
    setDdlLoading(true);
    invoke<{ create_sql?: string }>('get_table_info', {
      connectionId,
      database: selectedDatabase,
      table: selectedTable,
    })
      .then((info) => setDdl(info.create_sql ?? 'No DDL available.'))
      .catch((err) => setDdl(`Error: ${err}`))
      .finally(() => setDdlLoading(false));
  }, [connectionId, selectedDatabase, selectedTable]);

  const handleCopyDdl = () => {
    if (ddl) {
      navigator.clipboard.writeText(ddl);
      setDdlCopied(true);
      setTimeout(() => setDdlCopied(false), 2000);
    }
  };

  const handleTableSelect = (database: string, table: string, tab?: string) => {
    setSelectedDatabase(database);
    setSelectedTable(table);
    // When a table is selected, switch to the specified tab or default to 'data'
    setActiveTab(tab || 'data');
  };

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm font-medium">{connectionName}</span>
          {selectedDatabase && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-sm text-gray-600">{selectedDatabase}</span>
            </>
          )}
          {selectedTable && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-sm text-gray-600">{selectedTable}</span>
            </>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        )}
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Schema Browser Panel */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
          <div className="h-full border-r">
            <SchemaBrowser
              connectionId={connectionId}
              onTableSelect={handleTableSelect}
              className="h-full"
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Workspace Panel */}
        <ResizablePanel defaultSize={80}>
          <div className="flex flex-col h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
              <div className="px-4 bg-white border-b">
                <TabsList className="h-12 gap-6 p-0 bg-transparent">
                  <TabsTrigger
                    value="query"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full gap-2"
                  >
                    <Code className="w-4 h-4" /> Query
                  </TabsTrigger>
                  <TabsTrigger
                    value="data"
                    disabled={!selectedTable}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full gap-2 disabled:opacity-50"
                  >
                    <Table className="w-4 h-4" /> Data
                  </TabsTrigger>
                  <TabsTrigger
                    value="structure"
                    disabled={!selectedTable}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full gap-2 disabled:opacity-50"
                  >
                    <Database className="w-4 h-4" /> Structure
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="query" className="h-full m-0 border-none">
                  <SQLEditor
                    connectionId={connectionId}
                    database={selectedDatabase}
                    initialSql={sqlContent}
                    onSqlChange={setSqlContent}
                    className="h-full"
                  />
                </TabsContent>
                <TabsContent value="data" className="h-full m-0 border-none">
                  {selectedDatabase && selectedTable ? (
                    <TableDataView
                      connectionId={connectionId}
                      database={selectedDatabase}
                      table={selectedTable}
                      className="h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Select a table to view data
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="structure" className="h-full m-0 border-none">
                  {selectedDatabase && selectedTable ? (
                    <div className="flex flex-col h-full bg-[#1e1e2e]">
                      {/* toolbar */}
                      <div className="flex items-center justify-between px-4 py-2 bg-[#16161f] border-b border-[#2a2a38] shrink-0">
                        <span className="font-mono text-xs text-gray-400">
                          {selectedDatabase}.{selectedTable}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-gray-400 h-7 hover:text-white"
                          onClick={handleCopyDdl}
                          disabled={ddlLoading || !ddl}
                        >
                          {ddlCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {ddlCopied ? 'Copied!' : 'Copy DDL'}
                        </Button>
                      </div>
                      {/* content */}
                      <div className="flex-1 p-5 overflow-auto">
                        {ddlLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                          </div>
                        ) : (
                          <pre className="font-mono text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
                            {ddl}
                          </pre>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Select a table to view DDL
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DatabaseWorkspace;
