import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Code, Table, X } from 'lucide-react';
import React, { useState } from 'react';
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



  const handleTableSelect = (database: string, table: string, tab?: string) => {
    setSelectedDatabase(database);
    setSelectedTable(table);
    // When a table is selected, switch to the specified tab or default to 'data'
    setActiveTab(tab || 'data');
  };

  const handleCreateTableSQL = (sql: string) => {
    setSqlContent(sql);
    setActiveTab('query');
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
              onCreateTableSQL={handleCreateTableSQL}
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

              </div>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DatabaseWorkspace;
