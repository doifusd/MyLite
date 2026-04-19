import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronDown,
  ChevronRight,
  Columns,
  Database,
  FileText,
  Key,
  Loader2,
  RefreshCw,
  Table,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateTableDialog } from './CreateTableDialog';
import { DatabasePropertiesDialog } from './DatabasePropertiesDialog';
import { DesignTableDialog } from './DesignTableDialog';
import { IndexEditorDialog } from './IndexEditorDialog';
import { StructureDialog } from './StructureDialog';
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
  onNewQuery?: (database?: string) => void;
  className?: string;
}

export const SchemaBrowser: React.FC<SchemaBrowserProps> = ({
  connectionId,
  onTableSelect,
  onNewQuery,
  className,
}) => {
  const { t } = useTranslation();
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
  }, [connectionId]);

  useEffect(() => {
    const handleQueryUpdated = () => {
      // Refresh Queries folder
      setTreeData((prev) => {
        const markAsUnloaded = (nodes: SchemaTreeItem[]): SchemaTreeItem[] => {
          return nodes.map((node) => {
            if (node.type === 'folder' && node.metadata?.isQueryFolder) {
              return { ...node, isLoaded: false, children: undefined };
            }
            if (node.children) {
              return { ...node, children: markAsUnloaded(node.children) };
            }
            return node;
          });
        };
        return markAsUnloaded(prev);
      });
    };

    window.addEventListener('queryUpdated', handleQueryUpdated);
    return () => window.removeEventListener('queryUpdated', handleQueryUpdated);
  }, []);

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

        // Add virtual Queries folder
        children.push({
          id: `queries_${node.id}`,
          name: 'Queries',
          type: 'folder',
          parent_id: node.id,
          isLoaded: false,
          isLoading: false,
          metadata: {
            isQueryFolder: true,
            database: node.name,
          },
        });
      } else if (node.type === 'table') {
        children = await invoke<SchemaTreeItem[]>('get_table_schema', {
          connectionId,
          database: node.id.replace('table_', '').split('.')[0],
          table: node.name,
        });
      } else if (node.type === 'folder' && node.metadata?.isQueryFolder) {
        // Load saved queries
        const database = node.metadata.database;
        const key = `saved_queries_${connectionId}_${database}`;
        const savedQueries = JSON.parse(localStorage.getItem(key) || '[]');

        console.log('Loading queries for:', { database, key, count: savedQueries.length });

        children = savedQueries.map((query: any) => ({
          id: `query_${query.id}`,
          name: query.name,
          type: 'folder', // Use folder type to represent query items
          parent_id: node.id,
          isLoaded: true,
          isLoading: false,
          metadata: {
            isQueryItem: true,
            queryId: query.id,
            sql: query.sql,
            database,
          },
        }));
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

    // Load unloaded nodes (including Queries folder)
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

  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [selectedTableForStructure, setSelectedTableForStructure] = useState<{ database: string; table: string } | null>(null);
  const [tableStructure, setTableStructure] = useState<any>(null);
  const [structureLoading, setStructureLoading] = useState(false);

  const [indexEditorOpen, setIndexEditorOpen] = useState(false);
  const [selectedTableForIndex, setSelectedTableForIndex] = useState<{ database: string; table: string } | null>(null);
  const [availableColumnsForIndex, setAvailableColumnsForIndex] = useState<string[]>([]);

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

  const deleteQuery = (queryId: string, database: string) => {
    const key = `saved_queries_${connectionId}_${database}`;
    const savedQueries = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = savedQueries.filter((q: any) => String(q.id) !== String(queryId));
    localStorage.setItem(key, JSON.stringify(filtered));

    console.log('Query deleted:', { queryId, database, key, remaining: filtered.length });

    // Refresh tree
    setTreeData((prev) => {
      const markAsUnloaded = (nodes: SchemaTreeItem[]): SchemaTreeItem[] => {
        return nodes.map((node) => {
          if (node.type === 'folder' && node.metadata?.isQueryFolder) {
            return { ...node, isLoaded: false, children: undefined };
          }
          if (node.children) {
            return { ...node, children: markAsUnloaded(node.children) };
          }
          return node;
        });
      };
      return markAsUnloaded(prev);
    });
  };

  const handleNodeClick = (node: SchemaTreeItem) => {
    if (node.type === 'database' || node.type === 'table' || (node.type === 'folder' && !node.metadata?.isQueryItem)) {
      toggleNode(node);
    }

    if (node.type === 'table' && onTableSelect) {
      // Extract database and table name from node id
      const parts = node.id.replace('table_', '').split('.');
      if (parts.length === 2) {
        onTableSelect(parts[0], parts[1]);
      }
    }

    // Handle saved query item click
    if (node.metadata?.isQueryItem && onTableSelect) {
      const { sql, database } = node.metadata;
      // Use special table name to pass SQL, editor will recognize and load it
      window.dispatchEvent(
        new CustomEvent('loadSavedQuery', {
          detail: { sql, database },
        })
      );
    }
  };

  // Note: generateCreateTableTemplate is defined but not used
  // Can be removed if no longer needed
  /*
  const generateCreateTableTemplate = (database: string, tableName: string): string => {
    const escapedDb = database;
    const escapedTable = tableName;

    return `CREATE TABLE \`${escapedDb}\`.\`${escapedTable}\` (
  \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL DEFAULT '' COMMENT '名称',
  \`status\` tinyint(1) DEFAULT '1' COMMENT '状态',
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${tableName}表';`;
  };
  */

  const convertToGoType = (mysqlType: string): string => {
    const baseType = mysqlType.toLowerCase().split('(')[0];

    const typeMap: Record<string, string> = {
      'tinyint': 'int8',
      'smallint': 'int16',
      'mediumint': 'int32',
      'int': 'int32',
      'integer': 'int32',
      'bigint': 'int64',
      'float': 'float32',
      'double': 'float64',
      'decimal': 'float64',
      'varchar': 'string',
      'char': 'string',
      'text': 'string',
      'mediumtext': 'string',
      'longtext': 'string',
      'date': 'string',
      'datetime': 'string',
      'timestamp': 'string',
      'time': 'string',
      'boolean': 'bool',
      'bool': 'bool',
      'json': 'string',
      'blob': '[]byte',
      'longblob': '[]byte',
    };

    return typeMap[baseType] || 'string';
  };

  const toPascalCase = (str: string): string => {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  };

  const generateGoStruct = (tableName: string, columns: any[]): string => {
    const structName = toPascalCase(tableName);
    const fields = columns
      .map((col: any) => {
        const goType = convertToGoType(col.data_type);
        const fieldName = toPascalCase(col.name);
        const dbTag = `\`json:"${col.name}" db:"${col.name}"\``;
        return `\t${fieldName} ${goType} ${dbTag}`;
      })
      .join('\n');

    return `type ${structName} struct {\n${fields}\n}`;
  };

  const handleShowStructure = async (database: string, table: string) => {
    setStructureLoading(true);
    try {
      const info = await invoke<any>('get_table_info', {
        connectionId,
        database,
        table,
      });

      // Generate Go struct format
      const goStructCode = generateGoStruct(table, info.columns || []);
      const structure = {
        code: goStructCode,
        name: table,
        schema: database,
      };

      setTableStructure(structure);
      setSelectedTableForStructure({ database, table });
      setStructureDialogOpen(true);
    } catch (error: any) {
      const message = typeof error === 'string' ? error : (error?.message || 'Unknown error');
      toast({
        title: 'Error',
        description: `Failed to load table structure: ${message}`,
        variant: 'destructive',
      });
    } finally {
      setStructureLoading(false);
    }
  };

  const handleCreateIndex = async (database: string, table: string) => {
    try {
      const info = await invoke<any>('get_table_info', {
        connectionId,
        database,
        table,
      });

      const columns = (info.columns || []).map((col: any) => col.name || col.COLUMN_NAME);
      setAvailableColumnsForIndex(columns);
      setSelectedTableForIndex({ database, table });
      setIndexEditorOpen(true);
    } catch (error: any) {
      const message = typeof error === 'string' ? error : (error?.message || 'Unknown error');
      toast({
        title: 'Error',
        description: `Failed to load table columns: ${message}`,
        variant: 'destructive',
      });
    }
  };

  const getNodeIcon = (type: string, metadata?: Record<string, any>) => {
    if (metadata?.isQueryFolder) {
      return <FileText className="w-4 h-4 text-primary" />;
    }
    if (metadata?.isQueryItem) {
      return <FileText className="w-4 h-4 text-primary" />;
    }
    switch (type) {
      case 'database':
        return <Database className="w-4 h-4 text-primary" />;
      case 'table':
        return <Table className="w-4 h-4 text-[#f1fa8c]" />;
      case 'column':
        return <Columns className="w-4 h-4 text-muted-foreground" />;
      case 'index':
        return <Key className="w-4 h-4 text-primary" />;
      case 'folder':
        return <Columns className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const renderTreeNode = (node: SchemaTreeItem, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = (node.children && node.children.length > 0) || ((node.type === 'database' || node.type === 'table' || (node.type === 'folder' && node.metadata?.isQueryFolder)) && !node.isLoaded);
    const paddingLeft = depth * 16 + 8;
    const isQueryItem = node.metadata?.isQueryItem;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center justify-between gap-1 py-1 px-2 rounded-sm group',
            !isQueryItem && 'cursor-pointer hover:bg-accent/20',
            isQueryItem && 'cursor-pointer hover:bg-primary/20',
            node.type === 'table' && 'font-medium'
          )}
          style={{ paddingLeft }}
          onClick={() => handleNodeClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          <div className="flex items-center flex-1 min-w-0 gap-1">
            {node.isLoading ? (
              <Loader2 className="flex-shrink-0 w-3 h-3 text-muted-foreground animate-spin" />
            ) : hasChildren ? (
              isExpanded ? (
                <ChevronDown className="flex-shrink-0 w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="flex-shrink-0 w-3 h-3 text-muted-foreground" />
              )
            ) : (
              <span className="flex-shrink-0 w-3" />
            )}

            {getNodeIcon(node.type, node.metadata)}

            <span className={cn(
              'text-sm truncate',
              isQueryItem && 'text-primary'
            )}>
              {node.name}
            </span>
          </div>

          {isQueryItem && node.metadata && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteQuery(node.metadata!.queryId, node.metadata!.database);
              }}
              className="flex-shrink-0 p-1 ml-1 text-destructive transition-opacity rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20"
              title="Delete query"
            >
              <X className="w-3 h-3" />
            </button>
          )}
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
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-sm text-destructive', className)}>
        <p>{error}</p>
        <button
          onClick={fetchDatabases}
          className="flex items-center gap-1 mt-2 text-primary hover:underline"
        >
          <RefreshCw className="w-3 h-3" />
          {t('schema.browser.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto relative', className)}>
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="text-sm font-medium">{t('schema.browser.title')}</h3>
        <button
          onClick={fetchDatabases}
          className="p-1 rounded hover:bg-accent/20"
          title={t('schema.browser.refresh')}
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="p-2">
        {treeData.length === 0 ? (
          <p className="py-4 text-sm text-center text-muted-foreground">
            {t('schema.browser.noDatabasesFound')}
          </p>
        ) : (
          treeData.map((node) => renderTreeNode(node))
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-48 py-1 text-sm bg-popover text-popover-foreground border border-border shadow-lg rounded-md"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full px-4 py-2 text-left hover:bg-accent/20"
            onClick={() => {
              let database: string | undefined;
              if (contextMenu.node.type === 'database') {
                database = contextMenu.node.name;
              } else if (contextMenu.node.type === 'table') {
                const parts = contextMenu.node.id.replace('table_', '').split('.');
                if (parts.length === 2) {
                  database = parts[0];
                }
              } else if (contextMenu.node.type === 'folder' && contextMenu.node.metadata?.database) {
                // Extract database from Queries folder or query items
                database = contextMenu.node.metadata.database;
              }
              if (onNewQuery) {
                onNewQuery(database);
              }
              setContextMenu(null);
            }}
          >
            {t('schema.contextMenu.newQuery')}
          </button>
          {contextMenu.node.type === 'table' && (
            <button
              className="w-full px-4 py-2 font-medium text-left hover:bg-accent/20"
              onClick={() => {
                const parts = contextMenu.node.id.replace('table_', '').split('.');
                if (parts.length === 2) {
                  setSelectedTableForDesign({ database: parts[0], table: parts[1] });
                  setDesignTableOpen(true);
                }
                setContextMenu(null);
              }}
            >
              {t('schema.contextMenu.designTable')}
            </button>
          )}
          <button
            className="w-full px-4 py-2 text-left hover:bg-accent/20"
            onClick={() => {
              const parts = contextMenu.node.id.replace('table_', '').split('.');
              if (parts.length === 2 && onTableSelect) {
                onTableSelect(parts[0], parts[1], 'data');
              }
              setContextMenu(null);
            }}
          >
            {t('schema.contextMenu.showData')}
          </button>
          {contextMenu.node.type === 'table' && (
            <button
              className="w-full px-4 py-2 text-left hover:bg-accent/20"
              onClick={() => {
                const parts = contextMenu.node.id.replace('table_', '').split('.');
                if (parts.length === 2) {
                  setSelectedTableForDdl({ database: parts[0], table: parts[1] });
                  setDdlDialogOpen(true);
                }
                setContextMenu(null);
              }}
            >
              {t('schema.contextMenu.showDDL')}
            </button>
          )}
          {contextMenu.node.type === 'table' && (
            <button
              className="w-full px-4 py-2 text-left hover:bg-accent/20"
              onClick={() => {
                const parts = contextMenu.node.id.replace('table_', '').split('.');
                if (parts.length === 2) {
                  handleShowStructure(parts[0], parts[1]);
                }
                setContextMenu(null);
              }}
            >
              {t('schema.contextMenu.showStructure')}
            </button>
          )}
          {contextMenu.node.type === 'table' && (
            <button
              className="w-full px-4 py-2 text-left hover:bg-accent/20"
              onClick={() => {
                const parts = contextMenu.node.id.replace('table_', '').split('.');
                if (parts.length === 2) {
                  handleCreateIndex(parts[0], parts[1]);
                }
                setContextMenu(null);
              }}
            >
              {t('schema.contextMenu.createAddIndex')}
            </button>
          )}
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
              toast({
                title: 'Success',
                description: 'Table created successfully',
                variant: 'default',
              });
            } catch (err: any) {
              const message = typeof err === 'string' ? err : (err?.message || 'Unknown error');
              toast({
                title: 'Error',
                description: `Failed to create table: ${message}`,
                variant: 'destructive',
              });
            }
          }}
          connectionId={connectionId}
          database={selectedDbForCreateTable}
        />
      )}

      {structureDialogOpen && selectedTableForStructure && (
        <StructureDialog
          isOpen={structureDialogOpen}
          onClose={() => {
            setStructureDialogOpen(false);
            setSelectedTableForStructure(null);
            setTableStructure(null);
          }}
          table={selectedTableForStructure.table}
          structure={tableStructure}
          loading={structureLoading}
        />
      )}

      {indexEditorOpen && selectedTableForIndex && (
        <IndexEditorDialog
          isOpen={indexEditorOpen}
          onClose={() => {
            setIndexEditorOpen(false);
            setSelectedTableForIndex(null);
            setAvailableColumnsForIndex([]);
          }}
          onSave={async (sql) => {
            try {
              await invoke('execute_sql', { connectionId, sql });
              setIndexEditorOpen(false);
              setSelectedTableForIndex(null);
              setAvailableColumnsForIndex([]);
              fetchDatabases();
              toast({
                title: 'Success',
                description: 'Index created successfully',
                variant: 'default',
              });
            } catch (err: any) {
              const message = typeof err === 'string' ? err : (err?.message || 'Unknown error');
              toast({
                title: 'Error',
                description: `Failed to create index: ${message}`,
                variant: 'destructive',
              });
            }
          }}
          tableName={selectedTableForIndex.table}
          availableColumns={availableColumnsForIndex}
        />
      )}
    </div>
  );
};

export default SchemaBrowser;
