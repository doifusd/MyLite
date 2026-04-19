import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { invoke } from '@tauri-apps/api/core';
import { Check, Copy, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface TableDDLDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  database: string;
  tableName: string;
}

interface TableInfo {
  name: string;
  schema: string;
  create_sql?: string;
  // Other fields exist but we only need create_sql
}

export const TableDDLDialog: React.FC<TableDDLDialogProps> = ({
  isOpen,
  onClose,
  connectionId,
  database,
  tableName,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ddl, setDdl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDdl();
    } else {
      setDdl(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, connectionId, database, tableName]);

  const fetchDdl = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<TableInfo>('get_table_info', {
        connectionId,
        database,
        table: tableName,
      });
      setDdl(result.create_sql || 'No DDL information available.');
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (ddl) {
      navigator.clipboard.writeText(ddl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col items-start pt-10 px-8 pb-8 gap-6 outline-none shadow-2xl bg-card border border-border rounded-2xl overflow-hidden focus-visible:outline-none focus:outline-none">
        <DialogHeader className="w-full text-left">
          <DialogTitle className="text-xl font-semibold m-0 text-foreground">
            DDL for `{tableName}`
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8 w-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="w-full p-4 text-destructive bg-destructive/10 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="w-full h-full min-h-[150px] overflow-hidden flex flex-col relative group">
            {ddl && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="absolute top-4 right-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 border-white/20 text-white z-10"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
            <div className="bg-muted/30 text-foreground p-6 rounded-xl shadow-inner border border-border overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap max-h-[60vh] w-full">
              {ddl}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
