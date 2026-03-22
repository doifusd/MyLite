import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
  is_auto_increment: boolean;
  comment?: string;
  character_set?: string;
  collation?: string;
  max_length?: number;
}

interface ColumnEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sql: string) => void;
  connectionId: string;
  tableName: string;
  initialData?: ColumnInfo;
}

export const ColumnEditorDialog: React.FC<ColumnEditorDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  connectionId,
  tableName,
  initialData,
}) => {
  const [formData, setFormData] = useState<ColumnInfo>({
    name: '',
    data_type: 'varchar',
    is_nullable: true,
    is_primary_key: false,
    is_auto_increment: false,
    max_length: 255,
  });

  const [charsets, setCharsets] = useState<any[]>([]);
  const [collations, setCollations] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchCharsets = async () => {
        try {
          const result = await invoke<any[]>('get_charsets', { connectionId });
          setCharsets(result);
        } catch (err) {
          console.error('Failed to fetch charsets:', err);
        }
      };
      fetchCharsets();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchCollations = async () => {
      if (!formData.character_set) {
        setCollations([]);
        return;
      }
      try {
        const result = await invoke<any[]>('get_collations', { 
          connectionId,
          charset: formData.character_set 
        });
        setCollations(result);
      } catch (err) {
        console.error('Failed to fetch collations:', err);
      }
    };
    fetchCollations();
  }, [formData.character_set]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        data_type: 'varchar',
        is_nullable: true,
        is_primary_key: false,
        is_auto_increment: false,
        max_length: 255,
      });
    }
  }, [initialData, isOpen]);

  const handleSave = () => {
    let sql = '';
    const nullable = formData.is_nullable ? 'NULL' : 'NOT NULL';
    const pk = formData.is_primary_key ? ' PRIMARY KEY' : '';
    const ai = formData.is_auto_increment ? ' AUTO_INCREMENT' : '';
    const defaultValue = formData.default_value ? ` DEFAULT '${formData.default_value}'` : '';
    const length = formData.max_length ? `(${formData.max_length})` : '';
    const charset = formData.character_set ? ` CHARACTER SET ${formData.character_set}` : '';
    const collation = formData.collation ? ` COLLATE ${formData.collation}` : '';

    if (initialData) {
      // Modify column
      sql = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${formData.name}\` ${formData.data_type}${length}${charset}${collation} ${nullable}${defaultValue}${ai}${pk}`;
    } else {
      // Add column
      sql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${formData.name}\` ${formData.data_type}${length}${charset}${collation} ${nullable}${defaultValue}${ai}${pk}`;
    }
    onSave(sql);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Column' : 'Add Column'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Column Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Data Type</Label>
              <div className="flex gap-2">
                <select
                  className="flex h-9 w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.data_type.toLowerCase()}
                  onChange={(e) => setFormData({ ...formData, data_type: e.target.value })}
                >
                  <option value="varchar">VARCHAR</option>
                  <option value="int">INT</option>
                  <option value="bigint">BIGINT</option>
                  <option value="text">TEXT</option>
                  <option value="longtext">LONGTEXT</option>
                  <option value="datetime">DATETIME</option>
                  <option value="timestamp">TIMESTAMP</option>
                  <option value="decimal">DECIMAL</option>
                  <option value="float">FLOAT</option>
                  <option value="double">DOUBLE</option>
                  <option value="date">DATE</option>
                  <option value="time">TIME</option>
                  <option value="json">JSON</option>
                  <option value="blob">BLOB</option>
                  <option value="custom">CUSTOM...</option>
                </select>
                <Input
                  id="type"
                  placeholder="Or type here..."
                  className="flex-1"
                  value={formData.data_type}
                  onChange={(e) => setFormData({ ...formData, data_type: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="length">Length/Value</Label>
              <Input
                id="length"
                type="number"
                value={formData.max_length || ''}
                onChange={(e) => setFormData({ ...formData, max_length: parseInt(e.target.value) || undefined })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="default">Default Value</Label>
            <Input
              id="default"
              value={formData.default_value || ''}
              onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="charset">Character Set</Label>
              <select
                id="charset"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.character_set || ''}
                onChange={(e) => setFormData({ ...formData, character_set: e.target.value, collation: undefined })}
              >
                <option value="">Default</option>
                {charsets.map((cs) => (
                  <option key={cs.charset} value={cs.charset}>{cs.charset}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collation">Collation</Label>
              <select
                id="collation"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.collation || ''}
                onChange={(e) => setFormData({ ...formData, collation: e.target.value })}
                disabled={!formData.character_set}
              >
                <option value="">Default</option>
                {collations.map((col) => (
                  <option key={col.collation} value={col.collation}>{col.collation}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!formData.is_nullable}
                onChange={(e) => setFormData({ ...formData, is_nullable: !e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Not Null</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_primary_key}
                onChange={(e) => setFormData({ ...formData, is_primary_key: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Primary Key</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_auto_increment}
                onChange={(e) => setFormData({ ...formData, is_auto_increment: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Auto Inc</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
