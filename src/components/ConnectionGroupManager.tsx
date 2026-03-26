import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Folder, Plus, Trash2, Edit2, ChevronRight, ChevronDown, Star } from 'lucide-react';

export interface ConnectionGroup {
  id: string;
  name: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'cyan' | 'pink' | 'indigo';
  sort_order: number;
  is_expanded: boolean;
}

export interface ConnectionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  database?: string;
  color?: string;
  connection_type: 'direct' | 'ssh' | 'ssl' | 'http';
  group?: string;
  is_favorite: boolean;
  sort_order: number;
  tags: string[];
  last_connected_at?: string;
}

interface ConnectionGroupManagerProps {
  groups: ConnectionGroup[];
  connections: ConnectionInfo[];
  selectedGroup: string | null;
  onGroupSelect: (groupId: string | null) => void;
  onGroupsChange: () => void;
  onConnectionMove?: (connectionId: string, groupId: string | null) => void;
}

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  cyan: 'bg-cyan-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
};

export const ConnectionGroupManager: React.FC<ConnectionGroupManagerProps> = ({
  groups,
  connections,
  selectedGroup,
  onGroupSelect,
  onGroupsChange,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ConnectionGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState<ConnectionGroup['color']>('blue');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.filter(g => g.is_expanded).map(g => g.id))
  );

  const handleSaveGroup = useCallback(async () => {
    if (!groupName.trim()) return;

    const group: ConnectionGroup = {
      id: editingGroup?.id || crypto.randomUUID(),
      name: groupName.trim(),
      color: groupColor,
      sort_order: editingGroup?.sort_order || groups.length,
      is_expanded: true,
    };

    try {
      await invoke('save_connection_group', { group });
      setIsDialogOpen(false);
      setEditingGroup(null);
      setGroupName('');
      onGroupsChange();
    } catch (error) {
      console.error('Failed to save group:', error);
    }
  }, [groupName, groupColor, editingGroup, groups.length, onGroupsChange]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? Connections will be ungrouped.')) return;

    try {
      await invoke('delete_connection_group', { groupId });
      onGroupsChange();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  }, [onGroupsChange]);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const favoriteConnections = connections.filter(c => c.is_favorite);
  const ungroupedConnections = connections.filter(c => !c.group && !c.is_favorite);
  
  const groupedConnections = groups.map(group => ({
    group,
    connections: connections.filter(c => c.group === group.id),
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Quick Filters */}
      <div className="p-2 space-y-1">
        <button
          onClick={() => onGroupSelect('favorites')}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
            selectedGroup === 'favorites'
              ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          )}
        >
          <Star className="w-4 h-4 text-yellow-500" />
          <span className="flex-1 text-left">Favorites</span>
          <span className="text-xs text-gray-500">{favoriteConnections.length}</span>
        </button>

        <button
          onClick={() => onGroupSelect(null)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
            selectedGroup === null
              ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          )}
        >
          <span className="flex-1 text-left">All Connections</span>
          <span className="text-xs text-gray-500">{connections.length}</span>
        </button>
      </div>

      <div className="border-t dark:border-gray-700 my-2" />

      {/* Groups */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {groupedConnections.map(({ group, connections: groupConns }) => (
            <div key={group.id}>
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
                  selectedGroup === group.id
                    ? 'bg-gray-200 dark:bg-gray-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <button
                  onClick={() => toggleGroupExpanded(group.id)}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  {expandedGroups.has(group.id) ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                <div
                  onClick={() => onGroupSelect(group.id)}
                  className="flex-1 flex items-center gap-2 min-w-0"
                >
                  <div className={cn('w-2.5 h-2.5 rounded-full', colorClasses[group.color || 'blue'])} />
                  <Folder className="w-4 h-4 text-gray-500" />
                  <span className="flex-1 text-sm truncate">{group.name}</span>
                  <span className="text-xs text-gray-500">{groupConns.length}</span>
                </div>

                <button
                  onClick={() => {
                    setEditingGroup(group);
                    setGroupName(group.name);
                    setGroupColor(group.color || 'blue');
                    setIsDialogOpen(true);
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <Edit2 className="w-3 h-3" />
                </button>

                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Grouped connections */}
              {expandedGroups.has(group.id) && groupConns.length > 0 && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {groupConns.map(conn => (
                    <div
                      key={conn.id}
                      className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 truncate hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                    >
                      {conn.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped connections */}
          {ungroupedConnections.length > 0 && (
            <div className="pt-2 border-t dark:border-gray-700">
              <div className="px-2 py-1 text-xs text-gray-500 uppercase tracking-wider">
                Ungrouped
              </div>
              {ungroupedConnections.map(conn => (
                <div
                  key={conn.id}
                  className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 truncate hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                >
                  {conn.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Group Button */}
      <div className="p-2 border-t dark:border-gray-700">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            setEditingGroup(null);
            setGroupName('');
            setGroupColor('blue');
            setIsDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          New Group
        </Button>
      </div>

      {/* Group Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'New Group'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Production, Development"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(colorClasses).map(([color, className]) => (
                  <button
                    key={color}
                    onClick={() => setGroupColor(color as ConnectionGroup['color'])}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      className,
                      groupColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} disabled={!groupName.trim()}>
              {editingGroup ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConnectionGroupManager;
