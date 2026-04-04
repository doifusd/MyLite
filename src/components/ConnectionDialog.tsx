import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ConnectionColor, Connection as ConnectionConfig, HttpConfig, SshConfig, SslConfig } from '@/store/connectionStore';
import { invoke } from '@tauri-apps/api/tauri';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderOpen,
  Globe,
  Lock,
  RefreshCw,
  Server,
  Shield,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ConnectionGroup } from './ConnectionGroupManager';

// Form config without id for new connections
type ConnectionFormConfig = Omit<ConnectionConfig, 'id'> & { id?: string };

// Color options with hex values for Tailwind compatibility
const colorOptions: { value: ConnectionColor; label: string; hex: string }[] = [
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'green', label: 'Green', hex: '#22c55e' },
  { value: 'purple', label: 'Purple', hex: '#a855f7' },
  { value: 'orange', label: 'Orange', hex: '#f97316' },
  { value: 'red', label: 'Red', hex: '#ef4444' },
  { value: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { value: 'pink', label: 'Pink', hex: '#ec4899' },
  { value: 'indigo', label: 'Indigo', hex: '#6366f1' },
];

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: ConnectionFormConfig) => void;
  initialConfig?: ConnectionConfig;
  groups?: ConnectionGroup[];
}

export function ConnectionDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
  groups = [],
}: ConnectionDialogProps) {
  const [config, setConfig] = useState<ConnectionFormConfig>({
    name: '',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
    connection_type: 'direct',
    color: 'blue',
    ssh_config: {
      ssh_host: '',
      ssh_port: 22,
      ssh_username: '',
      ssh_password: '',
      local_bind_port: 0,
    },
    ssl_config: {
      ssl_mode: 'preferred',
    },
    http_config: {
      http_url: '',
      http_auth_type: 'none',
    },
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [isLoading] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [showKeyPassphrase, setShowKeyPassphrase] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialConfig) {
        // Edit mode: populate with initial config
        setConfig({
          ...initialConfig,
          ssh_config: initialConfig.ssh_config || {
            ssh_host: '',
            ssh_port: 22,
            ssh_username: '',
            ssh_password: '',
            local_bind_port: 0,
          },
          ssl_config: initialConfig.ssl_config || { ssl_mode: 'preferred' },
          http_config: initialConfig.http_config || { http_url: '', http_auth_type: 'none' },
        });
      } else {
        // New connection mode: reset to defaults
        setConfig({
          name: '',
          host: 'localhost',
          port: 3306,
          username: 'root',
          password: '',
          database: '',
          connection_type: 'direct',
          color: 'blue',
          ssh_config: {
            ssh_host: '',
            ssh_port: 22,
            ssh_username: '',
            ssh_password: '',
            local_bind_port: 0,
          },
          ssl_config: {
            ssl_mode: 'preferred',
          },
          http_config: {
            http_url: '',
            http_auth_type: 'none',
          },
        });
      }
      // Reset test status when dialog opens
      setTestStatus('idle');
      setTestMessage('');
    }
  }, [open, initialConfig]);

  const testConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      const result = await invoke<any>('test_connection', {
        config: {
          ...config,
          database: config.database || null,
        },
      });

      if (result.success) {
        setTestStatus('success');
        setTestMessage(result.message);
      } else {
        setTestStatus('error');
        setTestMessage(result.message);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err?.toString() || 'Connection test failed');
    }
  };

  const handlePickPrivateKeyFile = useCallback(async () => {
    try {
      // Dynamic import to avoid formatter removing unused import
      const { open } = await import('@tauri-apps/api/dialog');

      // Get the home directory path
      const homeDir = await invoke<string>('get_home_dir').catch(() => {
        // Fallback: try to use a common default
        return '/home/user';
      });

      const sshDir = `${homeDir}/.ssh`;

      const selected = await open({
        defaultPath: sshDir,
        multiple: false,
        directory: false,
      });

      if (selected && typeof selected === 'string') {
        setConfig((prev) => ({
          ...prev,
          ssh_config: { ...prev.ssh_config!, ssh_private_key: selected },
        }));
      }
    } catch (err) {
      console.error('Failed to pick private key file:', err);
    }
  }, []);

  const handleSave = () => {
    if (!config.name || !config.host || !config.username) return;
    const saveConfig = initialConfig ? config : { ...config, id: undefined };
    onSave(saveConfig);
    onOpenChange(false);
  };

  const updateConfig = (updates: Partial<ConnectionConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const updateSshConfig = (updates: Partial<SshConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ssh_config: { ...prev.ssh_config!, ...updates },
    }));
  };

  const updateSslConfig = (updates: Partial<SslConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ssl_config: { ...prev.ssl_config!, ...updates },
    }));
  };

  const updateHttpConfig = (updates: Partial<HttpConfig>) => {
    setConfig((prev) => ({
      ...prev,
      http_config: { ...prev.http_config!, ...updates },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialConfig ? 'Edit Connection' : 'New Connection'}</DialogTitle>
          <DialogDescription>
            Configure MySQL database connection with advanced options
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={config.connection_type}
          onValueChange={(v) => updateConfig({ connection_type: v as any })}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="direct" className="flex items-center gap-1">
              <Server className="w-3 h-3" />
              Direct
            </TabsTrigger>
            <TabsTrigger value="ssh_tunnel" className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              SSH
            </TabsTrigger>
            <TabsTrigger value="ssl" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              SSL
            </TabsTrigger>
            <TabsTrigger value="http" className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              HTTP
            </TabsTrigger>
          </TabsList>

          {/* Direct Connection Tab */}
          <TabsContent value="direct" className="space-y-4">
            <BasicConnectionFields config={config} updateConfig={updateConfig} />
          </TabsContent>

          {/* SSH Tunnel Tab */}
          <TabsContent value="ssh_tunnel" className="space-y-4">
            <BasicConnectionFields config={config} updateConfig={updateConfig} />

            <Separator />

            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <Lock className="w-4 h-4" />
                SSH Tunnel Configuration
              </h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="ssh_host">SSH Host</Label>
                  <Input
                    id="ssh_host"
                    placeholder="ssh.example.com"
                    value={config.ssh_config?.ssh_host || ''}
                    onChange={(e) => updateSshConfig({ ssh_host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssh_port">SSH Port</Label>
                  <Input
                    id="ssh_port"
                    type="number"
                    value={config.ssh_config?.ssh_port || 22}
                    onChange={(e) => updateSshConfig({ ssh_port: parseInt(e.target.value) || 22 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh_username">SSH Username</Label>
                <Input
                  id="ssh_username"
                  placeholder="ssh_user"
                  value={config.ssh_config?.ssh_username || ''}
                  onChange={(e) => updateSshConfig({ ssh_username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh_password">SSH Password (or use key)</Label>
                <div className="relative">
                  <Input
                    id="ssh_password"
                    type={showSshPassword ? 'text' : 'password'}
                    placeholder="SSH password"
                    value={config.ssh_config?.ssh_password || ''}
                    onChange={(e) => updateSshConfig({ ssh_password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 h-full"
                    onClick={() => setShowSshPassword(!showSshPassword)}
                  >
                    {showSshPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh_private_key">Private Key (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="ssh_private_key"
                    type="text"
                    placeholder="No key file selected"
                    value={config.ssh_config?.ssh_private_key || ''}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePickPrivateKeyFile}
                    className="gap-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </Button>
                  {config.ssh_config?.ssh_private_key && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updateSshConfig({ ssh_private_key: '' })}
                      className="text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {config.ssh_config?.ssh_private_key && (
                <div className="space-y-2">
                  <Label htmlFor="key_passphrase">Key Passphrase (if encrypted)</Label>
                  <div className="relative">
                    <Input
                      id="key_passphrase"
                      type={showKeyPassphrase ? 'text' : 'password'}
                      placeholder="Passphrase"
                      value={config.ssh_config?.ssh_private_key_passphrase || ''}
                      onChange={(e) =>
                        updateSshConfig({ ssh_private_key_passphrase: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-full"
                      onClick={() => setShowKeyPassphrase(!showKeyPassphrase)}
                    >
                      {showKeyPassphrase ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SSL Tab */}
          <TabsContent value="ssl" className="space-y-4">
            <BasicConnectionFields config={config} updateConfig={updateConfig} />

            <Separator />

            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <Shield className="w-4 h-4" />
                SSL/TLS Configuration
              </h4>

              <div className="space-y-2">
                <Label htmlFor="ssl_mode">SSL Mode</Label>
                <Select
                  value={config.ssl_config?.ssl_mode || 'preferred'}
                  onValueChange={(v: string) => updateSslConfig({ ssl_mode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="preferred">Preferred</SelectItem>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="verify_ca">Verify CA</SelectItem>
                    <SelectItem value="verify_identity">Verify Identity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssl_ca">CA Certificate (optional)</Label>
                <Textarea
                  id="ssl_ca"
                  placeholder="-----BEGIN CERTIFICATE-----"
                  value={config.ssl_config?.ssl_ca || ''}
                  onChange={(e) => updateSslConfig({ ssl_ca: e.target.value })}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssl_cert">Client Certificate (optional)</Label>
                <Textarea
                  id="ssl_cert"
                  placeholder="-----BEGIN CERTIFICATE-----"
                  value={config.ssl_config?.ssl_cert || ''}
                  onChange={(e) => updateSslConfig({ ssl_cert: e.target.value })}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssl_key">Client Key (optional)</Label>
                <Textarea
                  id="ssl_key"
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  value={config.ssl_config?.ssl_key || ''}
                  onChange={(e) => updateSslConfig({ ssl_key: e.target.value })}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </TabsContent>

          {/* HTTP Tab */}
          <TabsContent value="http" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="http_url">HTTP Endpoint URL</Label>
                <Input
                  id="http_url"
                  placeholder="https://api.example.com/mysql-proxy"
                  value={config.http_config?.http_url || ''}
                  onChange={(e) => updateHttpConfig({ http_url: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  URL of the HTTP-to-MySQL proxy service
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="http_auth">Authentication Type</Label>
                <Select
                  value={config.http_config?.http_auth_type || 'none'}
                  onValueChange={(v: string) => updateHttpConfig({ http_auth_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.http_config?.http_auth_type === 'basic' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="http_username">HTTP Username</Label>
                    <Input
                      id="http_username"
                      value={config.http_config?.http_username || ''}
                      onChange={(e) => updateHttpConfig({ http_username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="http_password">HTTP Password</Label>
                    <Input
                      id="http_password"
                      type="password"
                      value={config.http_config?.http_password || ''}
                      onChange={(e) => updateHttpConfig({ http_password: e.target.value })}
                    />
                  </div>
                </>
              )}

              {config.http_config?.http_auth_type === 'bearer' && (
                <div className="space-y-2">
                  <Label htmlFor="bearer_token">Bearer Token</Label>
                  <Input
                    id="bearer_token"
                    type="password"
                    value={config.http_config?.http_bearer_token || ''}
                    onChange={(e) => updateHttpConfig({ http_bearer_token: e.target.value })}
                  />
                </div>
              )}

              <Separator />

              <div className="p-3 border border-yellow-200 rounded-md bg-yellow-50">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> HTTP connection requires a MySQL-to-HTTP proxy service.
                  This is useful for serverless environments or when direct MySQL ports are blocked.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {testStatus !== 'idle' && (
          <div
            className={cn(
              'flex items-center gap-2 text-sm p-3 rounded-md',
              testStatus === 'success' && 'bg-green-50 text-green-700',
              testStatus === 'error' && 'bg-red-50 text-red-700',
              testStatus === 'testing' && 'bg-blue-50 text-blue-700'
            )}
          >
            {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
            {testStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {testStatus === 'error' && <AlertCircle className="w-4 h-4" />}
            <span>
              {testStatus === 'testing' && 'Testing connection...'}
              {testStatus === 'success' && testMessage}
              {testStatus === 'error' && testMessage}
            </span>
          </div>
        )}

        {/* Color Selection */}
        <div className="pt-4 space-y-2 border-t">
          <Label className="text-sm font-medium">Connection Color</Label>
          <div className="flex flex-wrap gap-3">
            {colorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateConfig({ color: option.value })}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all',
                  config.color === option.value
                    ? 'border-gray-800 scale-110 shadow-md'
                    : 'border-gray-200 hover:scale-105 hover:border-gray-400'
                )}
                style={{ backgroundColor: option.hex }}
                title={option.label}
              />
            ))}
          </div>
        </div>

        {/* Group Selection */}
        {groups.length > 0 && (
          <div className="pt-4 space-y-2 border-t">
            <Label htmlFor="group">Group (optional)</Label>
            <Select
              value={config.group || ''}
              onValueChange={(v) => updateConfig({ group: v || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a group..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Group</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={!config.host || !config.username || testStatus === 'testing'}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Test
          </Button>
          <Button
            onClick={handleSave}
            disabled={!config.name || !config.host || !config.username || isLoading}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Basic connection fields component
function BasicConnectionFields({
  config,
  updateConfig,
}: {
  config: ConnectionFormConfig;
  updateConfig: (updates: Partial<ConnectionFormConfig>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Connection Name</Label>
        <Input
          id="name"
          placeholder="Production Database"
          value={config.name}
          onChange={(e) => updateConfig({ name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            id="host"
            placeholder="localhost"
            value={config.host}
            onChange={(e) => updateConfig({ host: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            placeholder="3306"
            value={config.port}
            onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 3306 })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          placeholder="root"
          value={config.username}
          onChange={(e) => updateConfig({ username: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={config.password}
            onChange={(e) => updateConfig({ password: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-full"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="database">Database (optional)</Label>
        <Input
          id="database"
          placeholder="mydatabase"
          value={config.database || ''}
          onChange={(e) => updateConfig({ database: e.target.value })}
        />
      </div>
    </div>
  );
}
