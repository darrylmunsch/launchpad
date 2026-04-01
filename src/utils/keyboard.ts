// ─── Global Keyboard Shortcut Registration ───

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
}

const shortcuts: Shortcut[] = [];

export function registerShortcut(shortcut: Shortcut): void {
  shortcuts.push(shortcut);
}

export function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Don't fire shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // Allow Escape to work even in inputs
      if (e.key !== 'Escape') return;
    }

    for (const shortcut of shortcuts) {
      const ctrlOrMeta = shortcut.ctrl || shortcut.meta;
      const matchesMod = ctrlOrMeta ? (e.ctrlKey || e.metaKey) : true;
      const matchesShift = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();

      if (matchesMod && matchesShift && matchesKey) {
        e.preventDefault();
        shortcut.handler(e);
        return;
      }
    }
  });
}
