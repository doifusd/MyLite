import type { ConnectionInfo } from '@/components/ConnectionGroupManager';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/tauri';
import { Clock, Command, Database, FileText, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SearchResult {
  id: string;
  type: 'connection' | 'table' | 'query' | 'database';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  metadata?: Record<string, any>;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: ConnectionInfo[];
  onSelectConnection: (connection: ConnectionInfo) => void;
  onSelectTable?: (connectionId: string, database: string, table: string) => void;
  onSelectQuery?: (sql: string) => void;
}

export function GlobalSearch({
  open,
  onOpenChange,
  connections,
  onSelectConnection,
  onSelectQuery,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [recentQueries, setRecentQueries] = useState<any[]>([]);

  // Load recent queries on mount
  useEffect(() => {
    if (open) {
      loadRecentQueries();
    }
  }, [open]);

  const loadRecentQueries = async () => {
    try {
      const data = await invoke<any[]>('get_query_history', {
        connectionId: null,
        limit: 10,
      });
      setRecentQueries(data);
    } catch (err) {
      console.error('Failed to load recent queries:', err);
    }
  };

  // Perform search
  useEffect(() => {
    if (!query.trim()) {
      // Show recent items when no query
      const recentItems: SearchResult[] = [
        // Recent connections
        ...connections
          .filter(c => c.last_connected_at)
          .sort((a, b) => new Date(b.last_connected_at!).getTime() - new Date(a.last_connected_at!).getTime())
          .slice(0, 5)
          .map(conn => ({
            id: `conn-${conn.id}`,
            type: 'connection' as const,
            title: conn.name,
            subtitle: `${conn.host}:${conn.port}`,
            icon: <Database className="h-4 w-4" />,
            action: () => {
              onSelectConnection(conn);
              onOpenChange(false);
            },
            metadata: { lastConnected: conn.last_connected_at },
          })),
        // Recent queries
        ...recentQueries.slice(0, 5).map((q, idx) => ({
          id: `query-${idx}`,
          type: 'query' as const,
          title: q.sql.substring(0, 50) + (q.sql.length > 50 ? '...' : ''),
          subtitle: `Executed ${new Date(q.executed_at).toLocaleString()}`,
          icon: <Clock className="h-4 w-4" />,
          action: () => {
            onSelectQuery?.(q.sql);
            onOpenChange(false);
          },
          metadata: { sql: q.sql },
        })),
      ];
      setResults(recentItems);
      setSelectedIndex(0);
      return;
    }

    setIsLoading(true);
    const searchTerm = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search connections
    connections.forEach(conn => {
      if (
        conn.name.toLowerCase().includes(searchTerm) ||
        conn.host.toLowerCase().includes(searchTerm) ||
        conn.username.toLowerCase().includes(searchTerm) ||
        conn.database?.toLowerCase().includes(searchTerm) ||
        conn.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
      ) {
        searchResults.push({
          id: `conn-${conn.id}`,
          type: 'connection',
          title: conn.name,
          subtitle: `${conn.host}:${conn.port} • ${conn.username}`,
          icon: <Database className="h-4 w-4" />,
          action: () => {
            onSelectConnection(conn);
            onOpenChange(false);
          },
          metadata: { connection: conn },
        });
      }
    });

    // Search recent queries
    recentQueries.forEach((q, idx) => {
      if (q.sql.toLowerCase().includes(searchTerm)) {
        searchResults.push({
          id: `query-${idx}`,
          type: 'query',
          title: q.sql.substring(0, 60) + (q.sql.length > 60 ? '...' : ''),
          subtitle: `Executed ${new Date(q.executed_at).toLocaleString()}`,
          icon: <FileText className="h-4 w-4" />,
          action: () => {
            onSelectQuery?.(q.sql);
            onOpenChange(false);
          },
          metadata: { sql: q.sql },
        });
      }
    });

    setResults(searchResults);
    setSelectedIndex(0);
    setIsLoading(false);
  }, [query, connections, recentQueries, onSelectConnection, onSelectQuery, onOpenChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  }, [open, results, selectedIndex, onOpenChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'connection':
        return 'Connection';
      case 'table':
        return 'Table';
      case 'query':
        return 'Query History';
      case 'database':
        return 'Database';
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Global Search
          </DialogTitle>
        </DialogHeader>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search connections, tables, queries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Enter</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Esc</kbd>
              Close
            </span>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto border-t">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No results found</p>
              <p className="text-sm mt-1">Try searching for connections or queries</p>
            </div>
          ) : (
            <div className="py-2">
              {!query && (
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                  Recent Items
                </div>
              )}
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={result.action}
                  className={cn(
                    'w-full px-4 py-3 flex items-start gap-3 text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={cn(
                    'mt-0.5',
                    result.type === 'connection' && 'text-blue-500',
                    result.type === 'table' && 'text-green-500',
                    result.type === 'query' && 'text-purple-500',
                    result.type === 'database' && 'text-orange-500'
                  )}>
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{result.title}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 shrink-0">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    {result.subtitle && (
                      <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>{results.length} results</span>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            + K to open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for keyboard shortcut
export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}
