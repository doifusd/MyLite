import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useEffect, useState } from 'react';

interface IndexEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sql: string) => void;
  tableName: string;
  availableColumns: string[];
}

export const IndexEditorDialog: React.FC<IndexEditorDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  tableName,
  availableColumns,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'INDEX' | 'UNIQUE' | 'PRIMARY KEY' | 'FULLTEXT'>('INDEX');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setType('INDEX');
      setSelectedColumns([]);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (selectedColumns.length === 0) return;

    // For INDEX, UNIQUE, FULLTEXT - require index name
    if (type !== 'PRIMARY KEY' && !name.trim()) return;

    let sql = '';
    const columnsStr = selectedColumns.map(c => `\`${c}\``).join(', ');

    if (type === 'PRIMARY KEY') {
      sql = `ALTER TABLE \`${tableName}\` ADD PRIMARY KEY (${columnsStr})`;
    } else if (type === 'UNIQUE') {
      sql = `ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`${name}\` (${columnsStr})`;
    } else if (type === 'FULLTEXT') {
      sql = `ALTER TABLE \`${tableName}\` ADD FULLTEXT INDEX \`${name}\` (${columnsStr})`;
    } else {
      sql = `ALTER TABLE \`${tableName}\` ADD INDEX \`${name}\` (${columnsStr})`;
    }

    onSave(sql);
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Index</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="idx-name">Index Name</Label>
            <Input
              id="idx-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={type === 'PRIMARY KEY'}
              placeholder={type === 'PRIMARY KEY' ? 'PRIMARY' : 'idx_name'}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="idx-type">Index Type</Label>
            <select
              id="idx-type"
              className="h-9 px-2 rounded-md border border-input bg-background text-foreground text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="INDEX">INDEX</option>
              <option value="UNIQUE">UNIQUE</option>
              <option value="PRIMARY KEY">PRIMARY KEY</option>
              <option value="FULLTEXT">FULLTEXT</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Columns</Label>
            <div className="max-h-40 overflow-auto border rounded p-2 flex flex-col gap-1">
              {availableColumns.map(col => (
                <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1 rounded transition-colors text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                    className="rounded border-border bg-background"
                  />
                  <span className="text-sm">{col}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={selectedColumns.length === 0 || (type !== 'PRIMARY KEY' && !name.trim())}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
