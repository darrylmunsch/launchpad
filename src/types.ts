// ─── Bookmark Types ───
export interface BookmarkFolder {
  id: string;
  title: string;
  parentId?: string;
  children: BookmarkFolder[];
  bookmarkCount: number;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  parentId: string;
  dateAdded: number;
}

// ─── Subfolder Content (one level deep for sectioned view) ───
export interface SubfolderContent {
  bookmarks: BookmarkItem[];
  subfolders: BookmarkFolder[];
}

// ─── Bookmark Metadata ───
export interface BookmarkMeta {
  pinned?: boolean;
  hidden?: boolean;
}
export type BookmarkMetaMap = Record<string, BookmarkMeta>;

// ─── Settings Types ───
export type SortMode = 'manual' | 'alpha' | 'dateAdded' | 'url';
export type ViewMode = 'card' | 'compact';
export type LayoutMode = 'row' | 'column';
export type Theme = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: Theme;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  sortMode: SortMode;
  fontSize: number;
  widthRatio: number;
  animationsEnabled: boolean;
  sidebarCollapsed: boolean;
  showHidden: boolean;
  toastsEnabled: boolean;
  openInNewTab: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  viewMode: 'card',
  layoutMode: 'column',
  sortMode: 'manual',
  fontSize: 14,
  widthRatio: 1,
  animationsEnabled: true,
  sidebarCollapsed: false,
  showHidden: false,
  toastsEnabled: true,
  openInNewTab: false,
};

// ─── State Shape ───
export interface AppState {
  // Data
  folders: BookmarkFolder[];
  currentFolderId: string;
  bookmarks: BookmarkItem[];
  subfolders: BookmarkFolder[];

  // UI
  searchQuery: string;
  expandedFolders: Set<string>;
  selectedBookmarkIds: Set<string>;

  // Settings (persisted)
  settings: AppSettings;
}
