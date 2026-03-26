import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'cmd' | 'alt' | 'shift')[];
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    shortcuts.forEach((shortcut) => {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      
      // Check modifiers
      const ctrlMatch = shortcut.modifiers?.includes('ctrl') ? e.ctrlKey : !e.ctrlKey;
      const cmdMatch = shortcut.modifiers?.includes('cmd') ? e.metaKey : !e.metaKey;
      const altMatch = shortcut.modifiers?.includes('alt') ? e.altKey : !e.altKey;
      const shiftMatch = shortcut.modifiers?.includes('shift') ? e.shiftKey : !e.shiftKey;

      if (keyMatch && ctrlMatch && cmdMatch && altMatch && shiftMatch) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.action();
      }
    });
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Predefined shortcuts for common actions
export function useAppShortcuts({
  onNewConnection,
  onGlobalSearch,
  onToggleTheme,
  onCloseTab,
  onSave,
  onRefresh,
  onExecuteQuery,
}: {
  onNewConnection?: () => void;
  onGlobalSearch?: () => void;
  onToggleTheme?: () => void;
  onCloseTab?: () => void;
  onSave?: () => void;
  onRefresh?: () => void;
  onExecuteQuery?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      modifiers: ['cmd'],
      description: 'Open global search',
      action: () => onGlobalSearch?.(),
    },
    {
      key: 'n',
      modifiers: ['cmd'],
      description: 'New connection',
      action: () => onNewConnection?.(),
    },
    {
      key: 't',
      modifiers: ['cmd', 'shift'],
      description: 'Toggle theme',
      action: () => onToggleTheme?.(),
    },
    {
      key: 'w',
      modifiers: ['cmd'],
      description: 'Close current tab',
      action: () => onCloseTab?.(),
    },
    {
      key: 's',
      modifiers: ['cmd'],
      description: 'Save',
      action: () => onSave?.(),
    },
    {
      key: 'r',
      modifiers: ['cmd'],
      description: 'Refresh',
      action: () => onRefresh?.(),
    },
    {
      key: 'Enter',
      modifiers: ['cmd'],
      description: 'Execute query',
      action: () => onExecuteQuery?.(),
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}

// Hook for focus management
export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
}
