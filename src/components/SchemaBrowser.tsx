import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  ChevronRight, 
  ChevronDown, 
  Database, 
  Table, 
  Columns, 
  Key,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  onTableSelect?: (database: string, table: string) => void;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load databases');
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

    if (isExpanding && !node.isLoaded) {
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
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'table':
        return <Table className="h-4 w-4 text-amber-500" />;
      case 'column':
        return <Columns className="h-4 w-4 text-gray-500" />;
      case 'index':
        return <Key className="h-4 w-4 text-purple-500" />;
      case 'folder':
        return <Columns className="h-4 w-4 text-gray-400" />;
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
        >
          {node.isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          ) : hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-gray-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-500" />
            )
          ) : (
            <span className="w-3" />
          )}
          
          {getNodeIcon(node.type)}
          
          <span className="text-sm truncate ml-1">{node.name}</span>
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
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-sm text-red-500', className)}>
        <p>{error}</p>
        <button
          onClick={fetchDatabases}
          className="mt-2 flex items-center gap-1 text-blue-500 hover:text-blue-600"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto', className)}>
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="text-sm font-medium">Schema Browser</h3>
        <button
          onClick={fetchDatabases}
          className="p-1 hover:bg-gray-100 rounded"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      
      <div className="p-2">
        {treeData.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No databases found
          </p>
        ) : (
          treeData.map((node) => renderTreeNode(node))
        )}
      </div>
    </div>
  );
};

export default SchemaBrowser;
