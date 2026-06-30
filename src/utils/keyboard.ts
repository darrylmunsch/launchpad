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

// ─── Global "focus-search" Shortcut Cache ───
// Tracks the user's current binding (from chrome://extensions/shortcuts) for
// the `focus-search` command. Components read the cached value synchronously
// when rendering and call refreshFocusSearchShortcut() to update it.

let cachedFocusSearchShortcut: string | null = null;
const shortcutListeners = new Set<() => void>();

export function getFocusSearchShortcut(): string | null {
  return cachedFocusSearchShortcut;
}

export async function refreshFocusSearchShortcut(): Promise<void> {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find(c => c.name === 'focus-search');
    cachedFocusSearchShortcut = cmd?.shortcut?.trim() || null;
  } catch {
    cachedFocusSearchShortcut = null;
  }
  shortcutListeners.forEach(fn => fn());
}

export function onFocusSearchShortcutChange(fn: () => void): () => void {
  shortcutListeners.add(fn);
  return () => shortcutListeners.delete(fn);
}

export function formatShortcut(raw: string): string {
  // Chrome returns "Ctrl+Shift+F"; normalize spacing for display.
  return raw.split('+').join(' + ');
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
        // Preserve native Escape behavior (closing <dialog>, exiting fullscreen, etc.)
        if (e.key !== 'Escape') e.preventDefault();
        shortcut.handler(e);
        return;
      }
    }
  });
}
