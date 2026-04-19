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
import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface DatabasePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  databaseName: string;
  onRefresh?: () => void;
}

export const DatabasePropertiesDialog: React.FC<DatabasePropertiesDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  databaseName,
  onRefresh,
}) => {
  const [charset, setCharset] = useState('');
  const [collation, setCollation] = useState('');
  const [charsets, setCharsets] = useState<any[]>([]);
  const [collations, setCollations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const dbInfo = await invoke<any>('get_database_info', { connectionId, database: databaseName });
          setCharset(dbInfo.charset);
          setCollation(dbInfo.collation);

          const charsetList = await invoke<any[]>('get_charsets', { connectionId });
          setCharsets(charsetList);
        } catch (err) {
          console.error('Failed to fetch database info:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, connectionId, databaseName]);

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
  }, [charset, connectionId]);

  const handleSave = async () => {
    let sql = `ALTER DATABASE \`${databaseName}\` CHARACTER SET ${charset}`;
    if (collation) {
      sql += ` COLLATE ${collation}`;
    }

    try {
      await invoke('execute_query', {
        connectionId,
        database: null,
        sql,
      });
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      alert(`Failed to update database: ${err}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Database Properties: {databaseName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="db-charset">Character Set</Label>
              <select
                id="db-charset"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={charset}
                onChange={(e) => {
                  setCharset(e.target.value);
                  setCollation('');
                }}
              >
                {charsets.map((cs) => (
                  <option key={cs.charset} value={cs.charset}>{cs.charset}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="db-collation">Collation</Label>
              <select
                id="db-collation"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={collation}
                onChange={(e) => setCollation(e.target.value)}
                disabled={!charset}
              >
                {collations.map((col) => (
                  <option key={col.collation} value={col.collation}>{col.collation}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
