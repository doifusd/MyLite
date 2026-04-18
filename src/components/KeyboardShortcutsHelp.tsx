import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutCategory {
  name: string;
  nameKey: string;
  shortcuts: {
    keys: string[];
    descriptionKey: string;
  }[];
}

const shortcutsConfig: ShortcutCategory[] = [
  {
    name: 'General',
    nameKey: 'shortcuts.categoryGeneral',
    shortcuts: [
      { keys: ['Cmd', 'K'], descriptionKey: 'shortcuts.openSearch' },
      { keys: ['Cmd', 'N'], descriptionKey: 'shortcuts.newConnection' },
      { keys: ['Cmd', 'Shift', 'T'], descriptionKey: 'shortcuts.toggleTheme' },
      { keys: ['Cmd', ','], descriptionKey: 'shortcuts.openSettings' },
      { keys: ['?'], descriptionKey: 'shortcuts.showHelp' },
    ],
  },
  {
    name: 'Navigation',
    nameKey: 'shortcuts.categoryNavigation',
    shortcuts: [
      { keys: ['Cmd', '1-9'], descriptionKey: 'shortcuts.switchTab' },
      { keys: ['Cmd', 'W'], descriptionKey: 'shortcuts.closeTab' },
      { keys: ['Cmd', 'Shift', '['], descriptionKey: 'shortcuts.previousTab' },
      { keys: ['Cmd', 'Shift', ']'], descriptionKey: 'shortcuts.nextTab' },
    ],
  },
  {
    name: 'Query Editor',
    nameKey: 'shortcuts.categoryQueryEditor',
    shortcuts: [
      { keys: ['Cmd', 'Enter'], descriptionKey: 'shortcuts.executeQuery' },
      { keys: ['Cmd', '/'], descriptionKey: 'shortcuts.toggleComment' },
      { keys: ['Cmd', 'F'], descriptionKey: 'shortcuts.findInEditor' },
      { keys: ['Cmd', 'S'], descriptionKey: 'shortcuts.saveQuery' },
      { keys: ['F5'], descriptionKey: 'shortcuts.refreshResults' },
    ],
  },
  {
    name: 'Data Grid',
    nameKey: 'shortcuts.categoryDataGrid',
    shortcuts: [
      { keys: ['Cmd', 'C'], descriptionKey: 'shortcuts.copy' },
      { keys: ['Cmd', 'V'], descriptionKey: 'shortcuts.paste' },
      { keys: ['Delete'], descriptionKey: 'shortcuts.delete' },
      { keys: ['Cmd', 'Z'], descriptionKey: 'shortcuts.undo' },
      { keys: ['Cmd', 'Shift', 'Z'], descriptionKey: 'shortcuts.redo' },
    ],
  },
];

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            {t('shortcuts.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcutsConfig.map((category) => (
            <div key={category.nameKey}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t(category.nameKey)}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm">{t(shortcut.descriptionKey)}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center">
                          <kbd
                            className={cn(
                              'px-2 py-1 text-xs font-mono bg-gray-100 rounded',
                              'border border-gray-200 shadow-sm'
                            )}
                          >
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-gray-400">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t text-sm text-gray-500">
          <p>
            <strong>Note:</strong> On Windows/Linux, use <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Ctrl</kbd> instead of{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Cmd</kbd>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
