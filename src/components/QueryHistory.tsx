import { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Star, 
  Trash2, 
  Clock, 
  Database, 
  Play,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  QueryHistoryItem,
  QueryHistoryFilter,
  formatExecutionTime,
  formatExecutedAt,
  getSqlPreview,
  toggleQueryHistoryFavorite,
  deleteQueryHistoryItem,
  getQueryHistory,
  clearQueryHistory,
} from '@/store/queryHistoryStore';

interface QueryHistoryProps {
  connectionId?: string;
  database?: string;
  onSelectQuery?: (sql: string) => void;
  className?: string;
}

export function QueryHistory({ 
  connectionId, 
  database,
  onSelectQuery,
  className 
}: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSuccessOnly, setShowSuccessOnly] = useState(false);
  const [, setIsLoading] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const filter: QueryHistoryFilter = {
        connection_id: connectionId,
        database,
        search_query: searchQuery || undefined,
        favorites_only: showFavoritesOnly || undefined,
        success_only: showSuccessOnly || undefined,
      };
      const data = await getQueryHistory(filter, 100);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load query history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, database, searchQuery, showFavoritesOnly, showSuccessOnly]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleToggleFavorite = async (e: React.MouseEvent, item: QueryHistoryItem) => {
    e.stopPropagation();
    try {
      await toggleQueryHistoryFavorite(item.id);
      await loadHistory();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    try {
      await deleteQueryHistoryItem(itemId);
      await loadHistory();
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleClear = async () => {
    try {
      await clearQueryHistory(connectionId);
      await loadHistory();
      setShowClearDialog(false);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleSelectQuery = (sql: string) => {
    if (onSelectQuery) {
      onSelectQuery(sql);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-gray-500" />
            <span className="font-medium">Query History</span>
            <Badge variant="secondary" className="text-xs">
              {history.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                showFavoritesOnly && "text-yellow-500"
              )}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              title="Show favorites only"
            >
              <Star className={cn("h-4 w-4", showFavoritesOnly && "fill-current")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                showSuccessOnly && "text-green-500"
              )}
              onClick={() => setShowSuccessOnly(!showSuccessOnly)}
              title="Show successful only"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setShowClearDialog(true)}
              title="Clear history"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search queries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* History List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No query history</p>
                <p className="text-xs text-gray-400">
                  {showFavoritesOnly 
                    ? 'No favorite queries yet' 
                    : 'Execute queries to see them here'}
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "group rounded-md border p-2 cursor-pointer transition-colors",
                    "hover:bg-gray-50 hover:border-gray-300",
                    expandedItems.has(item.id) && "bg-gray-50 border-gray-300"
                  )}
                  onClick={() => handleSelectQuery(item.sql)}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(item.id);
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded"
                      >
                        {expandedItems.has(item.id) ? (
                          <ChevronDown className="h-3 w-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-gray-500" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getSqlPreview(item.sql)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 w-6 p-0",
                          item.is_favorite && "text-yellow-500"
                        )}
                        onClick={(e) => handleToggleFavorite(e, item)}
                      >
                        <Star className={cn("h-3 w-3", item.is_favorite && "fill-current")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                        onClick={(e) => handleDelete(e, item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Meta Row */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatExecutedAt(item.executed_at)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatExecutionTime(item.execution_time_ms)}</span>
                    <span className="text-gray-300">|</span>
                    {item.success ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        {item.row_count > 0 ? `${item.row_count} rows` : 'Success'}
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <X className="h-3 w-3" />
                        Failed
                      </span>
                    )}
                    {item.database && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {item.database}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {expandedItems.has(item.id) && (
                    <div className="mt-2 pt-2 border-t">
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                        <code>{item.sql}</code>
                      </pre>
                      {item.error_message && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                          {item.error_message}
                        </div>
                      )}
                      {item.tags.length > 0 && (
                        <div className="mt-2 flex items-center gap-1">
                          <Tag className="h-3 w-3 text-gray-400" />
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Clear Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear Query History</DialogTitle>
              <DialogDescription>
                Are you sure you want to clear all query history?
                {connectionId && ' This will only clear history for the current connection.'}
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleClear}>
                Clear History
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
