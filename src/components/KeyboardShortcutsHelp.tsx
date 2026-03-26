import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutCategory {
  name: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcuts: ShortcutCategory[] = [
  {
    name: 'General',
    shortcuts: [
      { keys: ['Cmd', 'K'], description: 'Open global search' },
      { keys: ['Cmd', 'N'], description: 'New connection' },
      { keys: ['Cmd', 'Shift', 'T'], description: 'Toggle theme' },
      { keys: ['Cmd', ','], description: 'Open settings' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['Cmd', '1-9'], description: 'Switch to tab 1-9' },
      { keys: ['Cmd', 'W'], description: 'Close current tab' },
      { keys: ['Cmd', 'Shift', '['], description: 'Previous tab' },
      { keys: ['Cmd', 'Shift', ']'], description: 'Next tab' },
    ],
  },
  {
    name: 'Query Editor',
    shortcuts: [
      { keys: ['Cmd', 'Enter'], description: 'Execute query' },
      { keys: ['Cmd', '/'], description: 'Toggle comment' },
      { keys: ['Cmd', 'F'], description: 'Find in editor' },
      { keys: ['Cmd', 'S'], description: 'Save query' },
      { keys: ['F5'], description: 'Refresh results' },
    ],
  },
  {
    name: 'Data Grid',
    shortcuts: [
      { keys: ['Cmd', 'C'], description: 'Copy selected cells' },
      { keys: ['Cmd', 'V'], description: 'Paste into cells' },
      { keys: ['Delete'], description: 'Delete selected rows' },
      { keys: ['Cmd', 'Z'], description: 'Undo changes' },
      { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo changes' },
    ],
  },
];

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcuts.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm">{shortcut.description}</span>
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
