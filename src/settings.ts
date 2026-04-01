// ─── Settings Persistence ───
// Reads/writes settings to chrome.storage.local

import type { AppSettings, BookmarkMeta, BookmarkMetaMap } from './types';
import { DEFAULT_SETTINGS } from './types';
import { store } from './state';

const STORAGE_KEY = 'settings';
const SESSION_KEY = 'session';
const META_KEY = 'bookmarkMeta';

interface SessionState {
  lastFolderId: string;
  expandedFolders: string[];
}

/** Load settings from chrome.storage.local into state */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const saved = result[STORAGE_KEY] as Partial<AppSettings> | undefined;
    const settings: AppSettings = { ...DEFAULT_SETTINGS, ...saved };
    store.set('settings', settings);
    return settings;
  } catch {
    // Fallback to defaults if storage fails
    store.set('settings', { ...DEFAULT_SETTINGS });
    return { ...DEFAULT_SETTINGS };
  }
}

/** Save current settings to chrome.storage.local */
export async function saveSettings(settings: AppSettings): Promise<void> {
  store.set('settings', settings);
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  applySettings(settings);
}

/** Update a single setting */
export async function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const current = store.get('settings');
  const updated = { ...current, [key]: value };
  await saveSettings(updated);
}

// ─── Bookmark Metadata ───

/** Load per-bookmark metadata (pinned/hidden) from storage */
export async function loadBookmarkMeta(): Promise<BookmarkMetaMap> {
  try {
    const result = await chrome.storage.local.get(META_KEY);
    const meta = (result[META_KEY] as BookmarkMetaMap) || {};
    store.set('bookmarkMeta', meta);
    return meta;
  } catch {
    store.set('bookmarkMeta', {});
    return {};
  }
}

/** Update metadata for a single bookmark (merges with existing) */
export function setBookmarkMeta(id: string, patch: Partial<BookmarkMeta>): void {
  const meta = { ...store.get('bookmarkMeta') };
  const existing = meta[id] || {};
  const merged = { ...existing, ...patch };
  // Remove entry if all flags are falsy (keep map sparse)
  if (!merged.pinned && !merged.hidden) {
    delete meta[id];
  } else {
    meta[id] = merged;
  }
  store.set('bookmarkMeta', meta);
}

/** Remove metadata for a deleted bookmark */
export function removeBookmarkMeta(id: string): void {
  const meta = store.get('bookmarkMeta');
  if (id in meta) {
    const updated = { ...meta };
    delete updated[id];
    store.set('bookmarkMeta', updated);
  }
}

/** Restore last session state (folder, sidebar) from storage */
export async function loadSessionState(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(SESSION_KEY);
    const saved = result[SESSION_KEY] as SessionState | undefined;
    if (!saved) return;
    if (saved.lastFolderId) {
      store.set('currentFolderId', saved.lastFolderId);
    }
    if (saved.expandedFolders?.length) {
      store.set('expandedFolders', new Set(saved.expandedFolders));
    }
  } catch {
    // Ignore — use defaults
  }
}

/** Subscribe to store changes and auto-persist to storage */
export function initAutoSave(): void {
  // Auto-persist settings (catches header toggle changes that bypass saveSettings)
  store.subscribe('settings', (settings) => {
    chrome.storage.local.set({ [STORAGE_KEY]: settings });
  });

  // Auto-persist session state with debounce
  let sessionTimer: number | undefined;
  const saveSession = () => {
    clearTimeout(sessionTimer);
    sessionTimer = window.setTimeout(() => {
      const state: SessionState = {
        lastFolderId: store.get('currentFolderId'),
        expandedFolders: Array.from(store.get('expandedFolders')),
      };
      chrome.storage.local.set({ [SESSION_KEY]: state });
    }, 300);
  };

  store.subscribe('currentFolderId', saveSession);
  store.subscribe('expandedFolders', saveSession);

  // Auto-persist bookmark metadata with debounce
  let metaTimer: number | undefined;
  store.subscribe('bookmarkMeta', (meta) => {
    clearTimeout(metaTimer);
    metaTimer = window.setTimeout(() => {
      chrome.storage.local.set({ [META_KEY]: meta });
    }, 300);
  });
}

/** Apply settings to the DOM */
export function applySettings(settings: AppSettings): void {
  const html = document.documentElement;

  // Theme
  if (settings.theme === 'system') {
    html.setAttribute('data-theme', 'system');
  } else {
    html.setAttribute('data-theme', settings.theme);
  }

  // Font size
  html.style.setProperty('--font-size-base', `${settings.fontSize}px`);

  // Width ratio
  html.style.setProperty('--content-width-ratio', String(settings.widthRatio));

  // Animations
  html.setAttribute('data-animations', settings.animationsEnabled ? 'on' : 'off');

  // Sidebar collapsed
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed', settings.sidebarCollapsed);
  }
}
