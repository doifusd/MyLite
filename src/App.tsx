import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Database, Plus, Trash2, Server, Lock, Shield, Globe, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatabaseWorkspace } from '@/components/DatabaseWorkspace';
import { ConnectionDialog } from '@/components/ConnectionDialog';
import type { Connection, ConnectionType, ConnectionColor } from '@/store/connectionStore';

// Color mapping for Tailwind compatibility
const colorMap: Record<ConnectionColor, { bg: string; border: string; text: string; lightBg: string }> = {
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', lightBg: '#eff6ff' },
  green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-500', lightBg: '#f0fdf4' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500', lightBg: '#faf5ff' },
  orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', lightBg: '#fff7ed' },
  red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-500', lightBg: '#fef2f2' },
  cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-500', lightBg: '#ecfeff' },
  pink: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-500', lightBg: '#fdf2f8' },
  indigo: { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-500', lightBg: '#eef2ff' },
};

// Helper function to get connection type icon
function getConnectionTypeIcon(type: ConnectionType, color?: ConnectionColor) {
  const colorClass = color ? colorMap[color]?.text : 'text-gray-400';
  switch (type) {
    case 'ssh':
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
    case 'ssh':
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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [, setIsLoading] = useState(false);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | undefined>(undefined);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await invoke<Connection[]>('get_connections');
      setConnections(data);
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const handleSaveConnection = async (config: any) => {
    setIsLoading(true);
    try {
      await invoke('save_connection', { config });
      await loadConnections();
      setShowNewConnection(false);
      setEditingConnection(undefined);
    } catch (err) {
      console.error('Failed to save connection:', err);
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
      }
      await loadConnections();
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-14 border-b bg-white flex items-center px-4">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          <h1 className="text-lg font-semibold">MyLite</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Connection List Sidebar - Always Visible */}
        <div className="w-80 border-r bg-white flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Connections</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingConnection(undefined);
                  setShowNewConnection(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              {connections.length} saved connection{connections.length !== 1 && 's'}
            </p>
          </div>
          
          <div className="flex-1 overflow-auto p-2">
            {connections.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No connections yet</p>
                <p className="text-sm mt-1">Click "New Connection" to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {connections.map((conn) => {
                  const connColor = conn.color || 'blue';
                  const colorStyle = colorMap[connColor];
                  const isSelected = selectedConnection?.id === conn.id;
                  
                  return (
                    <Card
                      key={conn.id}
                      className={`cursor-pointer transition-colors ${isSelected ? colorStyle.border : 'border-gray-200'} hover:${colorStyle.border}`}
                      style={{
                        backgroundColor: colorStyle.lightBg,
                      }}
                      onClick={() => setSelectedConnection(conn)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getConnectionTypeIcon(conn.connection_type, conn.color)}
                            <span className="truncate">{conn.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-blue-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditConnection(conn);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConnection(conn.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardTitle>
                        <CardDescription className="text-xs flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                            {getConnectionTypeLabel(conn.connection_type)}
                          </span>
                          {conn.host}:{conn.port}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-gray-500">
                          {conn.username}@{conn.database || 'no database'}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-hidden">
          {selectedConnection ? (
            <DatabaseWorkspace
              connectionId={selectedConnection.id}
              connectionName={selectedConnection.name}
              className="h-full"
              onClose={() => setSelectedConnection(null)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Database className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-700">
                  Select a connection
                </h3>
                <p className="text-gray-500 mt-1">
                  Choose a connection from the sidebar or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Dialog */}
      <ConnectionDialog
        open={showNewConnection}
        onOpenChange={(open) => {
          setShowNewConnection(open);
          if (!open) {
            // Reset editing state when dialog closes
            setEditingConnection(undefined);
          }
        }}
        onSave={handleSaveConnection}
        initialConfig={editingConnection}
      />
    </div>
  );
}

export default App;
