import { ConnectionDialog } from '@/components/ConnectionDialog';
import { ConnectionGroup, type ConnectionInfo } from '@/components/ConnectionGroupManager';
import { DatabaseWorkspace } from '@/components/DatabaseWorkspace';
import { GlobalSearch, useGlobalSearchShortcut } from '@/components/GlobalSearch';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ToastContainer } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WelcomePage } from '@/components/WelcomePage';
import { useAppShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { Connection, ConnectionColor, ConnectionType } from '@/store/connectionStore';
import { invoke } from '@tauri-apps/api/core';
import { ChevronDown, ChevronRight, Database, Edit2, Folder, Globe, HelpCircle, Lock, Plus, Search, Server, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Color mapping for Tailwind compatibility
const colorMap: Record<ConnectionColor, { bg: string; border: string; text: string; lightBg: string }> = {
  blue: { bg: 'bg-[#8be9fd]', border: 'border-[#8be9fd]', text: 'text-[#8be9fd]', lightBg: 'rgba(139, 233, 253, 0.1)' },
  green: { bg: 'bg-[#50fa7b]', border: 'border-[#50fa7b]', text: 'text-[#50fa7b]', lightBg: 'rgba(80, 250, 123, 0.1)' },
  purple: { bg: 'bg-[#bd93f9]', border: 'border-[#bd93f9]', text: 'text-[#bd93f9]', lightBg: 'rgba(189, 147, 249, 0.1)' },
  orange: { bg: 'bg-[#ffb86c]', border: 'border-[#ffb86c]', text: 'text-[#ffb86c]', lightBg: 'rgba(255, 184, 108, 0.1)' },
  red: { bg: 'bg-[#ff5555]', border: 'border-[#ff5555]', text: 'text-[#ff5555]', lightBg: 'rgba(255, 85, 85, 0.1)' },
  cyan: { bg: 'bg-[#8be9fd]', border: 'border-[#8be9fd]', text: 'text-[#8be9fd]', lightBg: 'rgba(139, 233, 253, 0.1)' },
  pink: { bg: 'bg-[#ff79c6]', border: 'border-[#ff79c6]', text: 'text-[#ff79c6]', lightBg: 'rgba(255, 121, 198, 0.1)' },
  indigo: { bg: 'bg-[#bd93f9]', border: 'border-[#bd93f9]', text: 'text-[#bd93f9]', lightBg: 'rgba(189, 147, 249, 0.1)' },
};

// Helper function to get connection type icon
function getConnectionTypeIcon(type: ConnectionType, color?: ConnectionColor) {
  const colorClass = color ? colorMap[color]?.text : 'text-muted-foreground';
  switch (type) {
    case 'ssh_tunnel':
      return <Lock className={`h-3 w-3 ${colorClass}`} />;
    case 'ssl':
      return <Shield className={`h-3 w-3 ${colorClass}`} />;
    case 'http':
      return <Globe className={`h-3 w-3 ${colorClass}`} />;
    default:
      return <Server className={`h-3 w-3 ${colorClass}`} />;
  }
}

// Helper function to get connection type label
function getConnectionTypeLabel(type: ConnectionType) {
  switch (type) {
    case 'ssh_tunnel':
      return 'SSH';
    case 'ssl':
      return 'SSL';
    case 'http':
      return 'HTTP';
    default:
      return 'Direct';
  }
}

function App() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [groups, setGroups] = useState<ConnectionGroup[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [, setIsLoading] = useState(false);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // UI/UX features
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [recentQueries, setRecentQueries] = useState<any[]>([]);

  // Hooks
  const { theme, setTheme } = useTheme();
  const { toasts, removeToast, success, error } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Attempt to load with retries for backend initialization
        let attempt = 0;
        const maxAttempts = 5;
        const baseDelay = 200;

        const tryLoad = async (): Promise<void> => {
          try {
            const [connData, groupData, queryData] = await Promise.all([
              invoke<ConnectionInfo[]>('get_connections'),
              invoke<ConnectionGroup[]>('get_connection_groups'),
              invoke<any[]>('get_query_history', { connectionId: null, limit: 10 }),
            ]);

            setConnections(connData);
            setGroups(groupData);
            setExpandedGroups(new Set(groupData.filter(g => g.is_expanded).map(g => g.id)));
            setRecentQueries(queryData);
          } catch (err: any) {
            attempt++;
            if (attempt < maxAttempts && err?.toString?.().includes('Store not initialized')) {
              // Backend not ready yet, retry with exponential backoff
              await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(1.5, attempt - 1)));
              await tryLoad();
            } else {
              // Other errors or max attempts reached
              throw err;
            }
          }
        };

        await tryLoad();
      } catch (err) {
        console.error('Failed to initialize app after retries:', err);
        // Continue loading with empty state
      }
    };

    initializeApp();
  }, []);

  // Global search shortcut
  useGlobalSearchShortcut(() => setShowGlobalSearch(true));

  // App shortcuts
  useAppShortcuts({
    onNewConnection: () => setShowNewConnection(true),
    onGlobalSearch: () => setShowGlobalSearch(true),
    onToggleTheme: () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'),
    onCloseTab: () => {
      if (selectedConnection) {
        setSelectedConnection(null);
        setShowWelcome(true);
      }
    },
  });

  const loadConnections = async () => {
    try {
      const data = await invoke<ConnectionInfo[]>('get_connections');
      setConnections(data);
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  // const loadGroups = async () => {
  //   try {
  //     const data = await invoke<ConnectionGroup[]>('get_connection_groups');
  //     setGroups(data);
  //     // Restore expanded state
  //     setExpandedGroups(new Set(data.filter(g => g.is_expanded).map(g => g.id)));
  //   } catch (err) {
  //     console.error('Failed to load groups:', err);
  //   }
  // };

  // const loadRecentQueries = async () => {
  //   try {
  //     const data = await invoke<any[]>('get_query_history', {
  //       connectionId: null,
  //       limit: 10,
  //     });
  //     setRecentQueries(data);
  //   } catch (err) {
  //     console.error('Failed to load recent queries:', err);
  //   }
  // };

  const handleSaveConnection = async (config: any) => {
    setIsLoading(true);
    try {
      await invoke('save_connection', { config });
      await loadConnections();
      setShowNewConnection(false);
      setEditingConnection(undefined);
      success(
        config.id ? 'Connection updated' : 'Connection created',
        `${config.name} has been saved successfully`
      );
    } catch (err) {
      console.error('Failed to save connection:', err);
      error('Failed to save connection', String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditConnection = (conn: Connection) => {
    setEditingConnection(conn);
    setShowNewConnection(true);
  };

  const deleteConnection = async (id: string) => {
    try {
      await invoke('delete_connection', { connectionId: id });
      if (selectedConnection?.id === id) {
        setSelectedConnection(null);
        setShowWelcome(true);
      }
      await loadConnections();
      success('Connection deleted', 'The connection has been removed');
    } catch (err) {
      console.error('Failed to delete connection:', err);
      error('Failed to delete connection', String(err));
    }
  };



  const handleSelectConnection = useCallback((connection: ConnectionInfo) => {
    setSelectedConnection(connection as any);
    setShowWelcome(false);
  }, []);

  const handleSelectQuery = useCallback((sql: string) => {
    // TODO: Open query editor with this SQL
    console.log('Selected query:', sql);
  }, []);

  // Filter connections based on search and selected group
  const filteredConnections = connections.filter(conn => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        conn.name.toLowerCase().includes(query) ||
        conn.host.toLowerCase().includes(query) ||
        conn.username.toLowerCase().includes(query) ||
        conn.tags.some(tag => tag.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Group filter
    if (selectedGroup) {
      return conn.group === selectedGroup;
    }
    return true;
  });

  // Group connections for display
  const groupedConnections = groups.map(group => ({
    group,
    connections: filteredConnections.filter(c => c.group === group.id),
  }));

  const ungroupedConnections = filteredConnections.filter(c => !c.group);

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">{t('app.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGlobalSearch(true)}
            title="Global Search (Cmd+K)"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShortcutsHelp(true)}
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <LanguageToggle />
          <ThemeToggle theme={theme} onThemeChange={setTheme} />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Connection List Sidebar - Always Visible */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b space-y-2">
              <h2 className="font-medium">{t('connection.title')}</h2>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('ui.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Quick Filters */}
            <div className="px-3 py-2 border-b space-y-1">
              <button
                onClick={() => setSelectedGroup(null)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                  selectedGroup === null
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-accent/20'
                )}
              >
                <Database className="w-4 h-4 text-primary" />
                <span className="flex-1 text-left">{t('connection.allConnections')}</span>
                <span className="text-xs text-muted-foreground">{connections.length}</span>
              </button>
            </div>

            {/* Connection List */}
            <div className="flex-1 overflow-auto p-2">
              {filteredConnections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('connection.noConnectionsFound')}</p>
                  {searchQuery && (
                    <p className="text-sm mt-1">{t('connection.tryAdjustingSearch')}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Grouped connections */}
                  {groupedConnections.map(({ group, connections: groupConns }) => (
                    groupConns.length > 0 && (
                      <div key={group.id}>
                        <button
                          onClick={() => toggleGroupExpanded(group.id)}
                          className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent/20 rounded"
                        >
                          {expandedGroups.has(group.id) ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          <Folder className="w-3 h-3" />
                          {group.name}
                          <span className="ml-auto">({groupConns.length})</span>
                        </button>
                        {expandedGroups.has(group.id) && (
                          <div className="ml-4 space-y-1">
                            {groupConns.map(conn => (
                              <ConnectionCard
                                key={conn.id}
                                conn={conn}
                                isSelected={selectedConnection?.id === conn.id}
                                onSelect={() => setSelectedConnection(conn as any)}
                                onEdit={() => handleEditConnection(conn as any)}
                                onDelete={() => deleteConnection(conn.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  ))}

                  {/* Ungrouped connections */}
                  {ungroupedConnections.length > 0 && (
                    <div className="space-y-1">
                      {groupedConnections.some(g => g.connections.length > 0) && (
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                          {t('connection.ungroupedConnections')}
                        </div>
                      )}
                      {ungroupedConnections.map(conn => (
                        <ConnectionCard
                          key={conn.id}
                          conn={conn}
                          isSelected={selectedConnection?.id === conn.id}
                          onSelect={() => setSelectedConnection(conn as any)}
                          onEdit={() => handleEditConnection(conn as any)}
                          onDelete={() => deleteConnection(conn.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* New Connection Button - Fixed at bottom */}
            <div className="p-3 border-t bg-muted/30">
              <Button
                className="w-full"
                onClick={() => {
                  setEditingConnection(undefined);
                  setShowNewConnection(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('connection.new')}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-hidden">
          {selectedConnection ? (
            <DatabaseWorkspace
              connectionId={selectedConnection.id}
              connectionName={selectedConnection.name}
              className="h-full"
              onClose={() => {
                setSelectedConnection(null);
                setShowWelcome(true);
              }}
            />
          ) : showWelcome ? (
            <WelcomePage
              connections={connections}
              recentQueries={recentQueries}
              onNewConnection={() => setShowNewConnection(true)}
              onSelectConnection={handleSelectConnection}
              onSelectQuery={handleSelectQuery}
              onOpenShortcuts={() => setShowShortcutsHelp(true)}
              onOpenSettings={() => {/* TODO */ }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Database className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  {t('connection.selectConnection')}
                </h3>
                <p className="text-muted-foreground/60 mt-1">
                  {t('connection.chooseOrCreate')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Dialog */}
      <ConnectionDialog
        key={editingConnection ? 'edit' : 'new'}
        open={showNewConnection}
        onOpenChange={(open) => {
          setShowNewConnection(open);
          if (!open) {
            setEditingConnection(undefined);
          }
        }}
        onSave={handleSaveConnection}
        initialConfig={editingConnection}
        groups={groups}
      />

      {/* Global Search */}
      <GlobalSearch
        open={showGlobalSearch}
        onOpenChange={setShowGlobalSearch}
        connections={connections}
        onSelectConnection={handleSelectConnection}
        onSelectQuery={handleSelectQuery}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// Connection Card Component
interface ConnectionCardProps {
  conn: ConnectionInfo;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ConnectionCard({ conn, isSelected, onSelect, onEdit, onDelete }: ConnectionCardProps) {
  const connColor = (conn.color || 'blue') as ConnectionColor;
  const colorStyle = colorMap[connColor];

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected ? `ring-2 ring-primary ${colorStyle.border}` : 'border-border'
      )}
      style={{ backgroundColor: isSelected ? colorStyle.lightBg : undefined }}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {getConnectionTypeIcon(conn.connection_type, connColor)}
            <span className="truncate">{conn.name}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="text-xs flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-muted rounded text-foreground">
            {getConnectionTypeLabel(conn.connection_type)}
          </span>
          {conn.host}:{conn.port}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">
          {conn.username}@{conn.database || 'no database'}
        </p>
        {conn.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {conn.tags.map(tag => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-xs bg-muted/50 rounded text-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default App;
