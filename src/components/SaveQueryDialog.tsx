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
import { toast } from '@/hooks/use-toast';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SaveQueryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (queryName: string) => Promise<void>;
    sql: string;
}

export const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
    open,
    onOpenChange,
    onSave,
    sql,
}) => {
    const { t } = useTranslation();
    const [queryName, setQueryName] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Clear input when dialog opens
    useEffect(() => {
        console.log('[SaveQueryDialog] Dialog open state changed:', open);
        if (open) {
            console.log('[SaveQueryDialog] Dialog opening, clearing queryName');
            setQueryName('');
            // Focus input after a small delay to ensure dialog is rendered
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    const handleSave = useCallback(async () => {
        console.log('[SaveQueryDialog] handleSave called');
        console.log('[SaveQueryDialog] Current state:', { queryName: queryName.trim(), saving, sqlLength: sql.length });

        const trimmedName = queryName.trim();

        if (!trimmedName) {
            console.warn('[SaveQueryDialog] Query name is empty, showing error toast');
            toast({
                title: t('ui.error'),
                description: t('query.dialog.errorEmptyName'),
                variant: 'destructive',
            });
            return;
        }

        console.log('[SaveQueryDialog] Setting saving to true');
        setSaving(true);
        let saveSuccess = false;

        try {
            console.log('[SaveQueryDialog] Starting save process for query:', trimmedName);
            console.log('[SaveQueryDialog] Calling onSave with:', trimmedName);
            await onSave(trimmedName);
            console.log('[SaveQueryDialog] Query saved successfully');
            saveSuccess = true;

            // Show success message
            toast({
                title: t('ui.success'),
                description: `${t('query.dialog.saveSuccess')}`,
            });
        } catch (error) {
            console.error('[SaveQueryDialog] Save error caught:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[SaveQueryDialog] Error message:', errorMessage);

            // Always show error to user
            toast({
                title: t('ui.error'),
                description: errorMessage || t('query.dialog.errorSaveFailed'),
                variant: 'destructive',
            });
        } finally {
            console.log('[SaveQueryDialog] Finally block - saveSuccess:', saveSuccess);
            setSaving(false);

            // Close dialog only if save was successful
            if (saveSuccess) {
                setQueryName('');
                console.log('[SaveQueryDialog] Closing dialog after successful save');
                onOpenChange(false);
            }
        }
    }, [queryName, sql, onSave, onOpenChange]);

    const handleOpenChange = useCallback((newOpen: boolean) => {
        console.log('[SaveQueryDialog] Dialog onOpenChange triggered:', { newOpen, currentOpen: open, currentSaving: saving });

        // Prevent closing during an ongoing save operation
        if (newOpen === false && saving) {
            console.log('[SaveQueryDialog] Preventing close while saving');
            return;
        }

        if (!newOpen) {
            // Reset state
            setQueryName('');
        }
        onOpenChange(newOpen);
    }, [saving, onOpenChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        console.log('[SaveQueryDialog] Input onKeyDown:', { key: e.key, saving });
        if (e.key === 'Enter' && !saving && queryName.trim()) {
            console.log('[SaveQueryDialog] Enter key pressed, calling handleSave');
            e.preventDefault();
            handleSave();
        }
    }, [saving, queryName, handleSave]);

    const isDisabled = !queryName.trim() || saving;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('query.dialog.saveQueryTitle')}</DialogTitle>
                    <DialogDescription>
                        {t('query.dialog.saveQueryDescription')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="query-name">{t('query.dialog.queryName')}</Label>
                        <Input
                            ref={inputRef}
                            id="query-name"
                            placeholder={t('query.dialog.queryNamePlaceholder')}
                            value={queryName}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                console.log('[SaveQueryDialog] Input onChange:', { newValue });
                                setQueryName(newValue);
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={saving}
                            autoFocus
                        />
                    </div>
                    <div className="text-sm text-gray-500">
                        <p className="p-2 overflow-y-auto font-mono text-xs bg-gray-100 rounded max-h-20">
                            {sql.substring(0, 150)}
                            {sql.length > 150 ? '...' : ''}
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            console.log('[SaveQueryDialog] Cancel button clicked');
                            onOpenChange(false);
                        }}
                        disabled={saving}
                    >
                        {t('ui.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            console.log('[SaveQueryDialog] Save button clicked, queryName:', queryName, 'disabled:', isDisabled);
                            if (!isDisabled) {
                                handleSave();
                            }
                        }}
                        disabled={isDisabled}
                    >
                        {saving ? `${t('ui.save')}...` : t('ui.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
