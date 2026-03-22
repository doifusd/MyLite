import React, { useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { SchemaBrowser } from './SchemaBrowser';
import { SQLEditor } from './SQLEditor';
import { TableDataView } from './TableDataView';
import { TableStructureView } from './TableStructureView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Database, Table, Code } from 'lucide-react';

interface DatabaseWorkspaceProps {
  connectionId: string;
  connectionName: string;
  className?: string;
}

export const DatabaseWorkspace: React.FC<DatabaseWorkspaceProps> = ({
  connectionId,
  connectionName,
  className,
}) => {
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>();
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('query');

  const handleTableSelect = (database: string, table: string, tab?: string) => {
    setSelectedDatabase(database);
    setSelectedTable(table);
    // When a table is selected, switch to the specified tab or default to 'data'
    setActiveTab(tab || 'data');
  };

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
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
          <div className="h-full flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-4 border-b bg-white">
                <TabsList className="bg-transparent h-12 p-0 gap-6">
                  <TabsTrigger 
                    value="query" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full gap-2"
                  >
                    <Code className="h-4 w-4" /> Query
                  </TabsTrigger>
                  <TabsTrigger 
                    value="data" 
                    disabled={!selectedTable}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full gap-2 disabled:opacity-50"
                  >
                    <Table className="h-4 w-4" /> Data
                  </TabsTrigger>
                  <TabsTrigger 
                    value="structure" 
                    disabled={!selectedTable}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full gap-2 disabled:opacity-50"
                  >
                    <Database className="h-4 w-4" /> Structure
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="query" className="h-full m-0 border-none">
                  <SQLEditor
                    connectionId={connectionId}
                    database={selectedDatabase}
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
                    <TableStructureView
                      connectionId={connectionId}
                      database={selectedDatabase}
                      table={selectedTable}
                      className="h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Select a table to view structure
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
