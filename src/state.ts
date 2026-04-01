// ─── Typed Pub/Sub State Store ───
// Lightweight reactive state — components subscribe to specific keys
// and only re-render when their data changes.

type Listener<T = unknown> = (value: T) => void;

class Store<S extends object> {
  private state: S;
  private listeners = new Map<keyof S, Set<Listener>>();

  constructor(initial: S) {
    this.state = { ...initial };
  }

  get<K extends keyof S>(key: K): S[K] {
    return this.state[key];
  }

  set<K extends keyof S>(key: K, value: S[K]): void {
    if (this.state[key] === value) return;
    this.state[key] = value;
    this.notify(key);
  }

  /** Update multiple keys at once, notifying after all are set */
  batch(updates: Partial<S>): void {
    const changedKeys: (keyof S)[] = [];
    for (const key in updates) {
      if (this.state[key] !== updates[key]) {
        this.state[key] = updates[key] as S[typeof key];
        changedKeys.push(key);
      }
    }
    for (const key of changedKeys) {
      this.notify(key);
    }
  }

  subscribe<K extends keyof S>(key: K, listener: Listener<S[K]>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    set.add(listener as Listener);

    // Return unsubscribe function
    return () => set.delete(listener as Listener);
  }

  private notify<K extends keyof S>(key: K): void {
    const set = this.listeners.get(key);
    if (!set) return;
    const value = this.state[key];
    for (const listener of set) {
      listener(value);
    }
  }
}

// ─── App State Type ───
export interface StateShape {
  // Data
  folders: import('./types').BookmarkFolder[];
  currentFolderId: string;
  bookmarks: import('./types').BookmarkItem[];
  subfolders: import('./types').BookmarkFolder[];
  subfolderContents: Record<string, import('./types').SubfolderContent>;

  // UI
  searchQuery: string;
  expandedFolders: Set<string>;
  selectedBookmarkIds: Set<string>;

  // Bookmark metadata (pinned/hidden state)
  bookmarkMeta: import('./types').BookmarkMetaMap;

  // Settings
  settings: import('./types').AppSettings;
}

import { DEFAULT_SETTINGS } from './types';

export const store = new Store<StateShape>({
  folders: [],
  currentFolderId: '1', // Default to Bookmarks Bar
  bookmarks: [],
  subfolders: [],
  subfolderContents: {},
  searchQuery: '',
  expandedFolders: new Set<string>(),
  selectedBookmarkIds: new Set<string>(),
  bookmarkMeta: {},
  settings: { ...DEFAULT_SETTINGS },
});
