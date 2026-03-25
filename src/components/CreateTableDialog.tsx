import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sql: string) => void;
  connectionId: string;
  database: string;
}

export const CreateTableDialog: React.FC<CreateTableDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  database,
}) => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState([
    { name: 'id', type: 'INT PRIMARY KEY AUTO_INCREMENT', nullable: false },
    { name: '', type: 'VARCHAR(255)', nullable: true },
  ]);

  const handleSave = () => {
    const validColumns = columns.filter(c => c.name.trim());
    if (validColumns.length === 0 || !tableName.trim()) return;

    const colsSql = validColumns.map(c => {
      let sql = `\`${c.name}\` ${c.type}`;
      if (!c.nullable) sql += ' NOT NULL';
      return sql;
    }).join(',\n  ');

    const sql = `CREATE TABLE \`${database}\`.\`${tableName}\` (\n  ${colsSql}\n);`;
    onSave(sql);
    setTableName('');
    setColumns([{ name: 'id', type: 'INT PRIMARY KEY AUTO_INCREMENT', nullable: false }, { name: '', type: 'VARCHAR(255)', nullable: true }]);
  };

  const updateColumn = (index: number, field: string, value: string | boolean) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  };

  const addColumn = () => {
    setColumns([...columns, { name: '', type: 'VARCHAR(255)', nullable: true }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Create New Table in {database}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Table Name</Label>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="my_table"
            />
          </div>

          <div className="space-y-2">
            <Label>Columns</Label>
            {columns.map((col, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Input
                  placeholder="column_name"
                  value={col.name}
                  onChange={(e) => updateColumn(index, 'name', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="VARCHAR(255)"
                  value={col.type}
                  onChange={(e) => updateColumn(index, 'type', e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateColumn(index, 'nullable', !col.nullable)}
                  className={col.nullable ? 'text-gray-400' : 'text-red-500'}
                >
                  {col.nullable ? 'NULL' : 'NOT NULL'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeColumn(index)}
                  disabled={columns.length <= 1}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addColumn} className="w-full">
              + Add Column
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!tableName.trim()}>Create Table</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTableDialog;
