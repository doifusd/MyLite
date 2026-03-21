import React, { useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { SchemaBrowser } from './SchemaBrowser';
import { SQLEditor } from './SQLEditor';
import { cn } from '@/lib/utils';

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

  const handleTableSelect = (database: string, table: string) => {
    setSelectedDatabase(database);
    setSelectedTable(table);
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

        {/* SQL Editor Panel */}
        <ResizablePanel defaultSize={80}>
          <SQLEditor
            connectionId={connectionId}
            database={selectedDatabase}
            className="h-full"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DatabaseWorkspace;
