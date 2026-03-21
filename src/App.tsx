import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Database, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DatabaseWorkspace } from '@/components/DatabaseWorkspace';

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
}

function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // New connection form state
  const [newConnection, setNewConnection] = useState<Partial<Connection>>({
    name: '',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
  });

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

  const testConnection = async () => {
    if (!newConnection.host || !newConnection.username) return;
    
    setTestStatus('testing');
    try {
      const result = await invoke<any>('test_connection', {
        config: {
          name: newConnection.name || 'Test Connection',
          host: newConnection.host,
          port: newConnection.port || 3306,
          username: newConnection.username,
          password: newConnection.password || '',
          database: newConnection.database || null,
        }
      });
      
      if (result.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setError(result.message || 'Connection failed');
      }
    } catch (err: any) {
      setTestStatus('error');
      setError(err?.toString() || 'An unknown error occurred');
    }
  };

  const saveConnection = async () => {
    if (!newConnection.name || !newConnection.host || !newConnection.username) return;

    setIsLoading(true);
    try {
      await invoke('save_connection', {
        config: {
          name: newConnection.name,
          host: newConnection.host,
          port: newConnection.port || 3306,
          username: newConnection.username,
          password: newConnection.password || '',
          database: newConnection.database || null,
        }
      });
      
      await loadConnections();
      setShowNewConnection(false);
      setNewConnection({
        name: '',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: '',
        database: '',
      });
      setTestStatus('idle');
    } catch (err) {
      setError('Failed to save connection');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConnection = async (id: string) => {
    try {
      await invoke('delete_connection', { id });
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
      <header className="h-14 border-b bg-white flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-600" />
          <h1 className="text-lg font-semibold">MySQL Client</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewConnection(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Connection
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {selectedConnection ? (
          <DatabaseWorkspace
            connectionId={selectedConnection.id}
            connectionName={selectedConnection.name}
            className="flex-1"
          />
        ) : (
          <div className="flex-1 flex">
            {/* Connection List Sidebar */}
            <div className="w-80 border-r bg-white flex flex-col">
              <div className="p-4 border-b">
                <h2 className="font-medium">Connections</h2>
                <p className="text-sm text-gray-500 mt-1">
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
                    {connections.map((conn) => (
                      <Card
                        key={conn.id}
                        className="cursor-pointer hover:border-blue-400 transition-colors"
                        onClick={() => setSelectedConnection(conn)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            {conn.name}
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
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {conn.host}:{conn.port}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-xs text-gray-500">
                            {conn.username}@{conn.database || 'no database'}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Empty State */}
            <div className="flex-1 flex items-center justify-center">
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
          </div>
        )}
      </div>

      {/* New Connection Dialog */}
      <Dialog open={showNewConnection} onOpenChange={setShowNewConnection}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Connection</DialogTitle>
            <DialogDescription>
              Configure a new MySQL database connection
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="Production Database"
                value={newConnection.name}
                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  placeholder="localhost"
                  value={newConnection.host}
                  onChange={(e) => setNewConnection({ ...newConnection, host: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="3306"
                  value={newConnection.port}
                  onChange={(e) => setNewConnection({ ...newConnection, port: parseInt(e.target.value) || 3306 })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="root"
                value={newConnection.username}
                onChange={(e) => setNewConnection({ ...newConnection, username: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={newConnection.password}
                onChange={(e) => setNewConnection({ ...newConnection, password: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="database">Database (optional)</Label>
              <Input
                id="database"
                placeholder="mydatabase"
                value={newConnection.database}
                onChange={(e) => setNewConnection({ ...newConnection, database: e.target.value })}
              />
            </div>

            {testStatus !== 'idle' && (
              <div className={cn(
                'flex items-center gap-2 text-sm',
                testStatus === 'success' && 'text-green-600',
                testStatus === 'error' && 'text-red-600',
                testStatus === 'testing' && 'text-blue-600'
              )}>
                {testStatus === 'testing' && <RefreshCw className="h-4 w-4 animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {testStatus === 'error' && <AlertCircle className="h-4 w-4" />}
                {testStatus === 'testing' && 'Testing connection...'}
                {testStatus === 'success' && 'Connection successful!'}
                {testStatus === 'error' && (error || 'Connection failed')}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewConnection(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={!newConnection.host || !newConnection.username || testStatus === 'testing'}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Test
            </Button>
            <Button
              onClick={saveConnection}
              disabled={!newConnection.name || !newConnection.host || !newConnection.username || isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
