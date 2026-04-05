import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';

interface TablePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sql: string) => void;
  connectionId: string;
  tableName: string;
  initialCharset?: string;
  initialCollation?: string;
}

export const TablePropertiesDialog: React.FC<TablePropertiesDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  connectionId,
  tableName,
  initialCharset,
  initialCollation,
}) => {
  const [charset, setCharset] = useState(initialCharset || '');
  const [collation, setCollation] = useState(initialCollation || '');
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
      setCharset(initialCharset || '');
      setCollation(initialCollation || '');
    }
  }, [isOpen, initialCharset, initialCollation]);

  useEffect(() => {
    const fetchCollations = async () => {
      if (!charset) {
        setCollations([]);
        return;
      }
      try {
        const result = await invoke<any[]>('get_collations', {
          connectionId,
          charset
        });
        setCollations(result);
      } catch (err) {
        console.error('Failed to fetch collations:', err);
      }
    };
    fetchCollations();
  }, [charset]);

  const handleSave = () => {
    let sql = `ALTER TABLE \`${tableName}\``;
    if (charset) {
      sql += ` CHARACTER SET ${charset}`;
    }
    if (collation) {
      sql += ` COLLATE ${collation}`;
    }
    onSave(sql);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Table Properties: {tableName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="table-charset">Character Set</Label>
            <select
              id="table-charset"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={charset}
              onChange={(e) => {
                setCharset(e.target.value);
                setCollation('');
              }}
            >
              <option value="">Default</option>
              {charsets.map((cs) => (
                <option key={cs.charset} value={cs.charset}>{cs.charset}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="table-collation">Collation</Label>
            <select
              id="table-collation"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={collation}
              onChange={(e) => setCollation(e.target.value)}
              disabled={!charset}
            >
              <option value="">Default</option>
              {collations.map((col) => (
                <option key={col.collation} value={col.collation}>{col.collation}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
