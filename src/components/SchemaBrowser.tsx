import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/tauri';
import {
  ChevronDown,
  ChevronRight,
  Columns,
  Database,
  Key,
  Loader2,
  RefreshCw,
  Table
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { CreateTableDialog } from './CreateTableDialog';
import { DatabasePropertiesDialog } from './DatabasePropertiesDialog';
import { DesignTableDialog } from './DesignTableDialog';
import { TableDDLDialog } from './TableDDLDialog';

interface SchemaTreeItem {
  id: string;
  name: string;
  type: 'database' | 'table' | 'column' | 'index' | 'folder';
  parent_id?: string;
  children?: SchemaTreeItem[];
  metadata?: Record<string, any>;
  isLoaded?: boolean;
  isLoading?: boolean;
}

interface SchemaBrowserProps {
  connectionId: string;
  onTableSelect?: (database: string, table: string, tab?: string) => void;
  className?: string;
}

export const SchemaBrowser: React.FC<SchemaBrowserProps> = ({
  connectionId,
  onTableSelect,
  className,
}) => {
  const [treeData, setTreeData] = useState<SchemaTreeItem[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDatabases = useCallback(async () => {
    if (!connectionId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<SchemaTreeItem[]>('get_databases_v2', {
        connectionId,
      });
      setTreeData(result);
    } catch (err: any) {
      console.error('Failed to fetch databases:', err);
      // Ensure we extract the error message accurately from Tauri's response
      const message = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      setError(message || 'Failed to load databases');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    setTreeData([]);
    setExpandedNodes(new Set());
    fetchDatabases();
  }, [connectionId, fetchDatabases]);

  const updateNode = (
    nodes: SchemaTreeItem[],
    nodeId: string,
    updates: Partial<SchemaTreeItem>
  ): SchemaTreeItem[] => {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return {
          ...node,
          children: updateNode(node.children, nodeId, updates),
        };
      }
      return node;
    });
  };

  const loadNodeChildren = async (node: SchemaTreeItem) => {
    if (node.isLoaded || node.isLoading) return;

    setTreeData((prev) => updateNode(prev, node.id, { isLoading: true }));

    try {
      let children: SchemaTreeItem[] = [];
      if (node.type === 'database') {
        children = await invoke<SchemaTreeItem[]>('get_tables', {
          connectionId,
          database: node.name,
        });
      } else if (node.type === 'table') {
        children = await invoke<SchemaTreeItem[]>('get_table_schema', {
          connectionId,
          database: node.id.replace('table_', '').split('.')[0],
          table: node.name,
        });
      }

      setTreeData((prev) =>
        updateNode(prev, node.id, {
          children: children.length > 0 ? children : undefined,
          isLoaded: true,
          isLoading: false
        })
      );
    } catch (err) {
      console.error('Failed to load children:', err);
      setTreeData((prev) => updateNode(prev, node.id, { isLoading: false }));
    }
  };

  const toggleNode = async (node: SchemaTreeItem) => {
    const nodeId = node.id;
    const isExpanding = !expandedNodes.has(nodeId);

    if (isExpanding && !node.isLoaded && node.type !== 'folder') {
      await loadNodeChildren(node);
    }

    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: SchemaTreeItem;
  } | null>(null);

  const [dbPropertiesOpen, setDbPropertiesOpen] = useState(false);
  const [selectedDbForProps, setSelectedDbForProps] = useState<string | null>(null);

  const [ddlDialogOpen, setDdlDialogOpen] = useState(false);
  const [selectedTableForDdl, setSelectedTableForDdl] = useState<{ database: string; table: string } | null>(null);

  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [selectedDbForCreateTable, setSelectedDbForCreateTable] = useState<string | null>(null);

  const [designTableOpen, setDesignTableOpen] = useState(false);
  const [selectedTableForDesign, setSelectedTableForDesign] = useState<{ database: string; table: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, node: SchemaTreeItem) => {
    if (node.type !== 'table' && node.type !== 'database') return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleNodeClick = (node: SchemaTreeItem) => {
    if (node.type === 'database' || node.type === 'table' || node.type === 'folder') {
      toggleNode(node);
    }

    if (node.type === 'table' && onTableSelect) {
      // Extract database and table name from node id
      const parts = node.id.replace('table_', '').split('.');
      if (parts.length === 2) {
        onTableSelect(parts[0], parts[1]);
      }
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'database':
        return <Database className="w-4 h-4 text-blue-500" />;
      case 'table':
        return <Table className="w-4 h-4 text-amber-500" />;
      case 'column':
        return <Columns className="w-4 h-4 text-gray-500" />;
      case 'index':
        return <Key className="w-4 h-4 text-purple-500" />;
      case 'folder':
        return <Columns className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const renderTreeNode = (node: SchemaTreeItem, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = (node.children && node.children.length > 0) || ((node.type === 'database' || node.type === 'table') && !node.isLoaded);
    const paddingLeft = depth * 16 + 8;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center gap-1 py-1 px-2 rounded-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800',
            node.type === 'table' && 'font-medium'
          )}
          style={{ paddingLeft }}
          onClick={() => handleNodeClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.isLoading ? (
            <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
          ) : hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-500" />
            )
          ) : (
            <span className="w-3" />
          )}

          {getNodeIcon(node.type)}

          <span className="ml-1 text-sm truncate">{node.name}</span>
        </div>

        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-sm text-red-500', className)}>
        <p>{error}</p>
        <button
          onClick={fetchDatabases}
          className="flex items-center gap-1 mt-2 text-blue-500 hover:text-blue-600"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto relative', className)}>
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="text-sm font-medium">Schema Browser</h3>
        <button
          onClick={fetchDatabases}
          className="p-1 rounded hover:bg-gray-100"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="p-2">
        {treeData.length === 0 ? (
          <p className="py-4 text-sm text-center text-gray-500">
            No databases found
          </p>
        ) : (
          treeData.map((node) => renderTreeNode(node))
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-48 py-1 text-sm bg-white border rounded shadow-lg dark:bg-gray-900"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.node.type === 'table' && (
            <button
              className="w-full px-4 py-2 font-medium text-left hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => {
                const parts = contextMenu.node.id.replace('table_', '').split('.');
                if (parts.length === 2) {
                  setSelectedTableForDesign({ database: parts[0], table: parts[1] });
                  setDesignTableOpen(true);
                }
                setContextMenu(null);
              }}
            >
              Design Table
            </button>
          )}
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => {
              const parts = contextMenu.node.id.replace('table_', '').split('.');
              if (parts.length === 2 && onTableSelect) {
                onTableSelect(parts[0], parts[1], 'data');
              }
              setContextMenu(null);
            }}
          >
            Show Data
          </button>
          {contextMenu.node.type === 'table' && (
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => {
                const parts = contextMenu.node.id.replace('table_', '').split('.');
                if (parts.length === 2) {
                  setSelectedTableForDdl({ database: parts[0], table: parts[1] });
                  setDdlDialogOpen(true);
                }
                setContextMenu(null);
              }}
            >
              Show DDL
            </button>
          )}
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => {
              if (contextMenu.node.type === 'database') {
                setSelectedDbForCreateTable(contextMenu.node.name);
                setCreateTableOpen(true);
              }
              setContextMenu(null);
            }}
          >
            Create New Table
          </button>
          <div className="my-1 border-t" />
          <div className="my-1 border-t" />
          <button
            className="w-full px-4 py-2 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={async () => {
              const parts = contextMenu.node.id.replace('table_', '').split('.');
              if (parts.length === 2) {
                if (confirm(`Are you sure you want to drop table "${parts[1]}"?\n\nThis action cannot be undone!`)) {
                  try {
                    await invoke('execute_sql', {
                      connectionId,
                      sql: `DROP TABLE \`${parts[0]}\`.\`${parts[1]}\``,
                    });
                    fetchDatabases();
                  } catch (err: any) {
                    alert(`Failed to drop table: ${err}`);
                  }
                }
              }
              setContextMenu(null);
            }}
          >
            Drop Table
          </button>
        </div>
      )}

      {selectedDbForProps && (
        <DatabasePropertiesDialog
          isOpen={dbPropertiesOpen}
          onClose={() => {
            setDbPropertiesOpen(false);
            setSelectedDbForProps(null);
          }}
          connectionId={connectionId}
          databaseName={selectedDbForProps}
          onRefresh={fetchDatabases}
        />
      )}

      {selectedTableForDesign && (
        <DesignTableDialog
          isOpen={designTableOpen}
          onClose={() => {
            setDesignTableOpen(false);
            setSelectedTableForDesign(null);
          }}
          connectionId={connectionId}
          database={selectedTableForDesign.database}
          tableName={selectedTableForDesign.table}
          onRefresh={fetchDatabases}
        />
      )}

      {selectedTableForDdl && (
        <TableDDLDialog
          isOpen={ddlDialogOpen}
          onClose={() => {
            setDdlDialogOpen(false);
            setSelectedTableForDdl(null);
          }}
          connectionId={connectionId}
          database={selectedTableForDdl.database}
          tableName={selectedTableForDdl.table}
        />
      )}

      {selectedDbForCreateTable && (
        <CreateTableDialog
          isOpen={createTableOpen}
          onClose={() => {
            setCreateTableOpen(false);
            setSelectedDbForCreateTable(null);
          }}
          onSave={async (sql) => {
            try {
              await invoke('execute_sql', { connectionId, sql });
              setCreateTableOpen(false);
              setSelectedDbForCreateTable(null);
              fetchDatabases();
            } catch (err: any) {
              alert(`Failed to create table: ${err}`);
            }
          }}
          connectionId={connectionId}
          database={selectedDbForCreateTable}
        />
      )}
    </div>
  );
};

export default SchemaBrowser;
