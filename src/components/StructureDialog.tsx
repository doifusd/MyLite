import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Check, Copy, Loader2 } from 'lucide-react';
import React, { useEffect } from 'react';

export interface StructureDialogProps {
    isOpen: boolean;
    onClose: () => void;
    table: string;
    structure: any;
    loading?: boolean;
}

export const StructureDialog: React.FC<StructureDialogProps> = ({
    isOpen,
    onClose,
    table,
    structure,
    loading = false,
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopyStruct = async () => {
        if (structure?.code) {
            try {
                await navigator.clipboard.writeText(structure.code);
                setCopied(true);
                toast({
                    title: 'Success',
                    description: 'Struct code copied to clipboard',
                    variant: 'default',
                });
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                toast({
                    title: 'Error',
                    description: 'Failed to copy to clipboard',
                    variant: 'destructive',
                });
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-96 overflow-hidden">
                <DialogHeader>
                    <DialogTitle>{table} - Go Struct</DialogTitle>
                </DialogHeader>

                <div className="overflow-auto max-h-72">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            <span>Loading table structure...</span>
                        </div>
                    ) : structure?.code ? (
                        <pre className="bg-gray-50 dark:bg-gray-800 p-4 rounded text-sm overflow-auto max-h-72 font-mono whitespace-pre-wrap break-words">
                            {structure.code}
                        </pre>
                    ) : null}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                        onClick={handleCopyStruct}
                        disabled={!structure?.code || loading}
                        variant="default"
                        className="gap-2"
                    >
                        {copied ? (
                            <>
                                <Check className="w-4 h-4" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                Copy Struct
                            </>
                        )}
                    </Button>
                    <Button onClick={onClose} variant="outline">
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
