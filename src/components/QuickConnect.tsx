import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { Clock, Edit2, ExternalLink, Plus, Trash2, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';

export interface QuickConnectTemplate {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  database?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'cyan' | 'pink' | 'indigo';
  tags: string[];
}

interface QuickConnectProps {
  templates: QuickConnectTemplate[];
  onTemplatesChange: () => void;
  onConnect: (template: QuickConnectTemplate) => void;
  recentConnections: Array<{
    id: string;
    name: string;
    host: string;
    lastConnected: string;
  }>;
}

const colorClasses: Record<string, string> = {
  blue: 'bg-[#8be9fd]',
  green: 'bg-[#50fa7b]',
  purple: 'bg-[#bd93f9]',
  orange: 'bg-[#ffb86c]',
  red: 'bg-[#ff5555]',
  cyan: 'bg-[#8be9fd]',
  pink: 'bg-[#ff79c6]',
  indigo: 'bg-primary',
};

export const QuickConnect: React.FC<QuickConnectProps> = ({
  templates,
  onTemplatesChange,
  onConnect,
  recentConnections,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuickConnectTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3306');
  const [username, setUsername] = useState('');
  const [database, setDatabase] = useState('');
  const [templateColor, setTemplateColor] = useState<QuickConnectTemplate['color']>('blue');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setTemplateName('');
    setHost('');
    setPort('3306');
    setUsername('');
    setDatabase('');
    setTemplateColor('blue');
    setTagInput('');
    setTags([]);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || !host.trim() || !username.trim()) return;

    const template: QuickConnectTemplate = {
      id: editingTemplate?.id || crypto.randomUUID(),
      name: templateName.trim(),
      host: host.trim(),
      port: parseInt(port) || 3306,
      username: username.trim(),
      database: database.trim() || undefined,
      color: templateColor,
      tags,
    };

    try {
      await invoke('save_quick_connect_template', { template });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
      onTemplatesChange();
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  }, [templateName, host, port, username, database, templateColor, tags, editingTemplate, onTemplatesChange, resetForm]);

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await invoke('delete_quick_connect_template', { templateId });
      onTemplatesChange();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  }, [onTemplatesChange]);

  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  }, [tags]);

  const startEdit = useCallback((template: QuickConnectTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setHost(template.host);
    setPort(template.port.toString());
    setUsername(template.username);
    setDatabase(template.database || '');
    setTemplateColor(template.color || 'blue');
    setTags(template.tags);
    setIsDialogOpen(true);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Recent Connections */}
      {recentConnections.length > 0 && (
        <>
          <div className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Recent
            </h3>
            <div className="space-y-1">
              {recentConnections.slice(0, 5).map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => onConnect({
                    id: conn.id,
                    name: conn.name,
                    host: conn.host,
                    port: 3306,
                    username: '',
                    tags: [],
                  })}
                   className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/20 rounded-md transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="flex-1 text-left truncate">{conn.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(conn.lastConnected).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border my-2" />
        </>
      )}

      {/* Quick Connect Templates */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Connect Templates
          </h3>

          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50 text-primary" />
              <p className="text-sm">No quick connect templates</p>
              <p className="text-xs mt-1">Create templates for frequently used connections</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="group relative p-3 border rounded-lg hover:border-primary hover:shadow-sm transition-all cursor-pointer bg-card"
                  onClick={() => onConnect(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('w-3 h-3 rounded-full mt-1', colorClasses[template.color || 'blue'])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{template.name}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {template.username}@{template.host}:{template.port}
                      </p>
                      {template.database && (
                        <p className="text-xs text-muted-foreground">/{template.database}</p>
                      )}
                      {template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-xs bg-muted rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(template);
                      }}
                      className="p-1 hover:bg-accent/20 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.id);
                      }}
                      className="p-1 hover:bg-destructive/20 rounded text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Template Button */}
      <div className="p-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-2"
          onClick={() => {
            setEditingTemplate(null);
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* Template Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Quick Connect' : 'New Quick Connect'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Local MySQL"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="3306"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="database">Database (optional)</Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="default database"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(colorClasses).map(([color, className]) => (
                  <button
                    key={color}
                    onClick={() => setTemplateColor(color as QuickConnectTemplate['color'])}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      className,
                      templateColor === color ? 'ring-2 ring-offset-2 ring-ring scale-110' : 'hover:scale-105'
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tag and press Enter"
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || !host.trim() || !username.trim()}
            >
              {editingTemplate ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickConnect;
