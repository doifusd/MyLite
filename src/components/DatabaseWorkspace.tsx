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
  const [activeTab, setActiveTab] = useState('query-0');

  // 支持多个查询窗口
  interface QueryTab {
    id: string;
    database?: string;
    content: string;
  }

  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([
    { id: 'query-0', database: undefined, content: '' }
  ]);
  const [queryCounter, setQueryCounter] = useState(1);

  const handleTableSelect = (database: string, table: string, tab?: string) => {
    setSelectedDatabase(database);
    setSelectedTable(table);
    // When a table is selected, switch to the specified tab or default to 'data'
    setActiveTab(tab || 'data');
  };

  const handleCreateTableSQL = (sql: string) => {
    // 更新当前活跃的query标签
    setQueryTabs(prev => prev.map(q => q.id === activeTab ? { ...q, content: sql } : q));
    if (!activeTab.startsWith('query-')) {
      setActiveTab('query-0');
    }
  };

  const handleNewQuery = (database?: string) => {
    const newId = `query-${queryCounter}`;
    setQueryTabs(prev => [...prev, { id: newId, database, content: '' }]);
    setQueryCounter(queryCounter + 1);
    setActiveTab(newId);
  };

  const handleCloseQueryTab = (id: string) => {
    if (queryTabs.length === 1) return; // 至少保留一个查询窗口
    setQueryTabs(prev => prev.filter(q => q.id !== id));
    if (activeTab === id) {
      setActiveTab(queryTabs[0].id);
    }
  };

  const handleSqlChange = (content: string) => {
    setQueryTabs(prev => prev.map(q => q.id === activeTab ? { ...q, content } : q));
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
              onNewQuery={handleNewQuery}
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
                <TabsList className="h-12 gap-2 p-0 bg-transparent">
                  {/* Query Tabs */}
                  {queryTabs.map((tab) => (
                    <div key={tab.id} className="flex items-center">
                      <TabsTrigger
                        value={tab.id}
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full gap-2"
                      >
                        <Code className="w-4 h-4" /> Query {queryTabs.indexOf(tab) + 1}
                      </TabsTrigger>
                      {queryTabs.length > 1 && (
                        <button
                          onClick={() => handleCloseQueryTab(tab.id)}
                          className="ml-1 p-1 hover:bg-gray-100 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Data Tab */}
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
                {/* Query Tabs Content */}
                {queryTabs.map((tab) => (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    className="h-full m-0 border-none"
                  >
                    <SQLEditor
                      connectionId={connectionId}
                      database={tab.database || selectedDatabase}
                      initialSql={tab.content}
                      onSqlChange={handleSqlChange}
                      className="h-full"
                    />
                  </TabsContent>
                ))}

                {/* Data Tab */}
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
