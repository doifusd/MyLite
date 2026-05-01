import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isIndex: boolean;
  autoIncrement: boolean;
}

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
  const [engine, setEngine] = useState('InnoDB');
  const [charset, setCharset] = useState('utf8mb4');
  const [collation, setCollation] = useState('utf8mb4_unicode_ci');
  const [activeTab, setActiveTab] = useState('columns');
  const [columns, setColumns] = useState<Column[]>([
    { name: 'id', type: 'INT', nullable: false, isPrimaryKey: true, isUnique: false, isIndex: false, autoIncrement: true },
    { name: '', type: 'VARCHAR(255)', nullable: true, isPrimaryKey: false, isUnique: false, isIndex: false, autoIncrement: false },
  ]);
  const [expandedColumn, setExpandedColumn] = useState<number | null>(null);

  const generateSQL = useMemo(() => {
    const validColumns = columns.filter(c => c.name.trim());
    if (validColumns.length === 0 || !tableName.trim()) return '';

    const colsSql = validColumns.map(c => {
      let sql = `\`${c.name}\` ${c.type}`;
      if (c.isPrimaryKey) sql += ' PRIMARY KEY';
      if (c.autoIncrement) sql += ' AUTO_INCREMENT';
      if (c.isUnique && !c.isPrimaryKey) sql += ' UNIQUE';
      if (!c.nullable) sql += ' NOT NULL';
      if (c.default) sql += ` DEFAULT ${c.default}`;
      return sql;
    }).join(',\n  ');

    const indexes = validColumns
      .filter(c => c.isIndex && !c.isPrimaryKey && !c.isUnique)
      .map(c => `KEY \`idx_${c.name}\` (\`${c.name}\`)`);

    const allConstraints = [colsSql, ...indexes].join(',\n  ');
    const sql = `CREATE TABLE \`${database}\`.\`${tableName}\` (\n  ${allConstraints}\n) ENGINE=${engine} DEFAULT CHARSET=${charset} COLLATE=${collation};`;
    return sql;
  }, [columns, tableName, database, engine, charset, collation]);

  const handleSave = () => {
    if (!generateSQL) return;
    onSave(generateSQL);
    setTableName('');
    setEngine('InnoDB');
    setCharset('utf8mb4');
    setCollation('utf8mb4_unicode_ci');
    setColumns([{ name: 'id', type: 'INT', nullable: false, isPrimaryKey: true, isUnique: false, isIndex: false, autoIncrement: true }, { name: '', type: 'VARCHAR(255)', nullable: true, isPrimaryKey: false, isUnique: false, isIndex: false, autoIncrement: false }]);
  };

  const updateColumn = (index: number, field: keyof Column, value: string | boolean) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };

    // 如果设置为主键，自动取消唯一索引
    if (field === 'isPrimaryKey' && value === true) {
      newColumns[index].isUnique = false;
    }

    setColumns(newColumns);
  };

  const addColumn = () => {
    setColumns([...columns, { name: '', type: 'VARCHAR(255)', nullable: true, isPrimaryKey: false, isUnique: false, isIndex: false, autoIncrement: false }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Create New Table in {database}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="preview">Preview SQL</TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Table Name</Label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="my_table"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>

            <div className="space-y-3">
              <Label>Columns</Label>
              {columns.map((col, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex gap-2 items-center justify-between">
                    <div className="flex gap-2 items-center flex-1">
                      <Input
                        placeholder="column_name"
                        value={col.name}
                        onChange={(e) => updateColumn(index, 'name', e.target.value)}
                        className="flex-1"
                        autoCapitalize="off"
                      />
                      <Select value={col.type} onValueChange={(v) => updateColumn(index, 'type', v)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INT">INT</SelectItem>
                          <SelectItem value="BIGINT">BIGINT</SelectItem>
                          <SelectItem value="VARCHAR(255)">VARCHAR(255)</SelectItem>
                          <SelectItem value="TEXT">TEXT</SelectItem>
                          <SelectItem value="DATETIME">DATETIME</SelectItem>
                          <SelectItem value="TIMESTAMP">TIMESTAMP</SelectItem>
                          <SelectItem value="DECIMAL(10,2)">DECIMAL(10,2)</SelectItem>
                          <SelectItem value="BOOLEAN">BOOLEAN</SelectItem>
                          <SelectItem value="JSON">JSON</SelectItem>
                          <SelectItem value="ENUM('yes','no')">ENUM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedColumn(expandedColumn === index ? null : index)}
                    >
                      <ChevronDown size={16} className={expandedColumn === index ? 'rotate-180' : ''} />
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

                  {expandedColumn === index && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`pk-${index}`}
                          checked={col.isPrimaryKey}
                          onChange={(e) => updateColumn(index, 'isPrimaryKey', e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor={`pk-${index}`} className="text-sm cursor-pointer">Primary Key</label>
                      </div>

                      {col.isPrimaryKey && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`ai-${index}`}
                            checked={col.autoIncrement}
                            onChange={(e) => updateColumn(index, 'autoIncrement', e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor={`ai-${index}`} className="text-sm cursor-pointer">Auto Increment</label>
                        </div>
                      )}

                      {!col.isPrimaryKey && (
                        <>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`unique-${index}`}
                              checked={col.isUnique}
                              onChange={(e) => updateColumn(index, 'isUnique', e.target.checked)}
                              className="rounded"
                            />
                            <label htmlFor={`unique-${index}`} className="text-sm cursor-pointer">Unique Index</label>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`idx-${index}`}
                              checked={col.isIndex}
                              onChange={(e) => updateColumn(index, 'isIndex', e.target.checked)}
                              className="rounded"
                            />
                            <label htmlFor={`idx-${index}`} className="text-sm cursor-pointer">Index</label>
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`null-${index}`}
                          checked={col.nullable}
                          onChange={(e) => updateColumn(index, 'nullable', e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor={`null-${index}`} className="text-sm cursor-pointer">Nullable</label>
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Default Value</Label>
                        <Input
                          placeholder="e.g., 0 or 'default_text' or CURRENT_TIMESTAMP"
                          value={col.default || ''}
                          onChange={(e) => updateColumn(index, 'default', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addColumn} className="w-full">
                + Add Column
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Storage Engine</Label>
                <Select value={engine} onValueChange={setEngine}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="InnoDB">InnoDB</SelectItem>
                    <SelectItem value="MyISAM">MyISAM</SelectItem>
                    <SelectItem value="Memory">Memory</SelectItem>
                    <SelectItem value="Archive">Archive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Character Set</Label>
                <Select value={charset} onValueChange={setCharset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utf8mb4">utf8mb4</SelectItem>
                    <SelectItem value="utf8">utf8</SelectItem>
                    <SelectItem value="latin1">latin1</SelectItem>
                    <SelectItem value="ascii">ascii</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Collation</Label>
                <Select value={collation} onValueChange={setCollation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</SelectItem>
                    <SelectItem value="utf8mb4_general_ci">utf8mb4_general_ci</SelectItem>
                    <SelectItem value="utf8mb4_bin">utf8mb4_bin</SelectItem>
                    <SelectItem value="utf8_general_ci">utf8_general_ci</SelectItem>
                    <SelectItem value="utf8_unicode_ci">utf8_unicode_ci</SelectItem>
                    <SelectItem value="latin1_swedish_ci">latin1_swedish_ci</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Generated SQL</Label>
              <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96 whitespace-pre-wrap break-words">
                {generateSQL || '<Table name required>'}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!tableName.trim() || !generateSQL}>Create Table</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTableDialog;
