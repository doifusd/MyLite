import { Database, Plus, Clock, Star, BookOpen, Keyboard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConnectionInfo } from '@/components/ConnectionGroupManager';

interface WelcomePageProps {
  connections: ConnectionInfo[];
  recentQueries: any[];
  onNewConnection: () => void;
  onSelectConnection: (connection: ConnectionInfo) => void;
  onSelectQuery?: (sql: string) => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
}

export function WelcomePage({
  connections,
  recentQueries,
  onNewConnection,
  onSelectConnection,
  onSelectQuery,
  onOpenShortcuts,
}: WelcomePageProps) {
  const favoriteConnections = connections.filter(c => c.is_favorite);
  const recentConnections = connections
    .filter(c => c.last_connected_at)
    .sort((a, b) => new Date(b.last_connected_at!).getTime() - new Date(a.last_connected_at!).getTime())
    .slice(0, 5);

  const quickActions = [
    {
      icon: Plus,
      label: 'New Connection',
      description: 'Create a new database connection',
      onClick: onNewConnection,
      color: 'text-blue-500',
    },
    {
      icon: BookOpen,
      label: 'Documentation',
      description: 'View MyLite documentation',
      onClick: () => window.open('https://github.com/yourusername/mylite', '_blank'),
      color: 'text-green-500',
    },
    {
      icon: Keyboard,
      label: 'Keyboard Shortcuts',
      description: 'View all available shortcuts',
      onClick: onOpenShortcuts,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6">
            <Database className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Welcome to MyLite</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            A lightweight, powerful MySQL client for developers. Connect to your databases,
            run queries, and manage your data with ease.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button size="lg" onClick={onNewConnection}>
              <Plus className="h-5 w-5 mr-2" />
              New Connection
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => (
            <Card
              key={action.label}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={action.onClick}
            >
              <CardContent className="p-6">
                <action.icon className={`h-8 w-8 ${action.color} mb-3`} />
                <h3 className="font-semibold mb-1">{action.label}</h3>
                <p className="text-sm text-gray-500">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Connections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                Recent Connections
              </CardTitle>
              <CardDescription>
                Your recently used database connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentConnections.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No recent connections</p>
                  <p className="text-sm mt-1">Connect to a database to see it here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentConnections.map((conn) => (
                    <button
                      key={conn.id}
                      onClick={() => onSelectConnection(conn)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: conn.color ? `${conn.color}20` : '#e5e7eb' }}
                      >
                        <Database
                          className="h-5 w-5"
                          style={{ color: conn.color || '#6b7280' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{conn.name}</span>
                          {conn.is_favorite && (
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {conn.host}:{conn.port}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(conn.last_connected_at!).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Favorite Connections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Favorites
              </CardTitle>
              <CardDescription>
                Your favorite database connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              {favoriteConnections.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No favorite connections</p>
                  <p className="text-sm mt-1">
                    Click the star icon on a connection to add it here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {favoriteConnections.map((conn) => (
                    <button
                      key={conn.id}
                      onClick={() => onSelectConnection(conn)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: conn.color ? `${conn.color}20` : '#e5e7eb' }}
                      >
                        <Database
                          className="h-5 w-5"
                          style={{ color: conn.color || '#6b7280' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate">{conn.name}</span>
                        <p className="text-sm text-gray-500">
                          {conn.host}:{conn.port}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Queries */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                Recent Queries
              </CardTitle>
              <CardDescription>
                Your recently executed SQL queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentQueries.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No recent queries</p>
                  <p className="text-sm mt-1">
                    Execute queries to see them here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentQueries.slice(0, 5).map((query, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectQuery?.(query.sql)}
                      className="w-full p-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm font-mono text-gray-700 truncate max-w-md">
                          {query.sql.substring(0, 80)}
                          {query.sql.length > 80 && '...'}
                        </code>
                        <span className="text-xs text-gray-400">
                          {new Date(query.executed_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{query.row_count} rows</span>
                        <span>{query.execution_time_ms}ms</span>
                        {query.success ? (
                          <span className="text-green-600">Success</span>
                        ) : (
                          <span className="text-red-600">Failed</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
          <h3 className="font-semibold mb-2">💡 Pro Tips</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Press <kbd className="px-1.5 py-0.5 bg-white rounded border">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-white rounded border">K</kbd> to open global search</li>
            <li>• Use <kbd className="px-1.5 py-0.5 bg-white rounded border">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-white rounded border">Enter</kbd> to execute queries</li>
            <li>• Favorite connections for quick access</li>
            <li>• Use query history to reuse previous queries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
