// ─── Chrome Bookmarks API Wrapper ───
// Fetches the bookmark tree and derives flat folder/bookmark lists.
// Listens to Chrome events for live updates.

import type { BookmarkFolder, BookmarkItem, SubfolderContent } from './types';
import { store } from './state';
import { removeBookmarkMeta } from './settings';
import { showToast } from './components/toast';

/** Fetch the full bookmark tree and populate state */
export async function loadBookmarkTree(): Promise<void> {
  const tree = await chrome.bookmarks.getTree();
  const root = tree[0];
  if (!root?.children) return;

  const folders = deriveFolders(root.children);
  store.set('folders', folders);

  // Only set default expanded folders if no persisted state was restored
  if (store.get('expandedFolders').size === 0) {
    const expanded = new Set<string>();
    for (const child of root.children) {
      expanded.add(child.id);
    }
    store.set('expandedFolders', expanded);
  }

  // Load initial folder
  await loadFolder(store.get('currentFolderId'));
}

/** Recursively extract folder structure */
function deriveFolders(nodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkFolder[] {
  const result: BookmarkFolder[] = [];
  for (const node of nodes) {
    if (!node.url && node.children) {
      const children = deriveFolders(node.children);
      const bookmarkCount = node.children.filter(c => !!c.url).length;
      result.push({
        id: node.id,
        title: node.title || getFolderDisplayName(node.id),
        parentId: node.parentId,
        children,
        bookmarkCount,
      });
    }
  }
  return result;
}

/** Get a display name for special Chrome folder IDs */
function getFolderDisplayName(id: string): string {
  switch (id) {
    case '1': return 'Bookmarks Bar';
    case '2': return 'Other Bookmarks';
    case '3': return 'Mobile Bookmarks';
    default: return 'Untitled';
  }
}

/** Load bookmarks for a specific folder (uses getSubTree for one-call efficiency) */
export async function loadFolder(folderId: string): Promise<void> {
  let nodes: chrome.bookmarks.BookmarkTreeNode[];
  try {
    nodes = await chrome.bookmarks.getSubTree(folderId);
  } catch {
    // Folder was deleted — fall back to Bookmarks Bar
    return loadFolder('1');
  }

  const root = nodes[0];
  if (!root?.children) {
    store.batch({ currentFolderId: folderId, bookmarks: [], subfolders: [], subfolderContents: {} });
    return;
  }

  const bookmarks: BookmarkItem[] = [];
  const subfolders: BookmarkFolder[] = [];
  const subfolderContents: Record<string, SubfolderContent> = {};

  for (const child of root.children) {
    if (child.url) {
      bookmarks.push({
        id: child.id,
        title: child.title,
        url: child.url,
        parentId: child.parentId || folderId,
        dateAdded: child.dateAdded || 0,
      });
    } else {
      // It's a subfolder — extract its children from the subtree
      const subChildren = child.children || [];
      const bookmarkCount = subChildren.filter(c => !!c.url).length;
      subfolders.push({
        id: child.id,
        title: child.title || 'Untitled',
        parentId: child.parentId,
        children: [],
        bookmarkCount,
      });

      // Parse one level of subfolder contents for sectioned view
      const subBookmarks: BookmarkItem[] = [];
      const subSubfolders: BookmarkFolder[] = [];
      for (const sc of subChildren) {
        if (sc.url) {
          subBookmarks.push({
            id: sc.id,
            title: sc.title,
            url: sc.url,
            parentId: sc.parentId || child.id,
            dateAdded: sc.dateAdded || 0,
          });
        } else {
          const grandChildren = sc.children || [];
          subSubfolders.push({
            id: sc.id,
            title: sc.title || 'Untitled',
            parentId: sc.parentId,
            children: [],
            bookmarkCount: grandChildren.filter(c => !!c.url).length,
          });
        }
      }
      subfolderContents[child.id] = { bookmarks: subBookmarks, subfolders: subSubfolders };
    }
  }

  store.batch({
    currentFolderId: folderId,
    bookmarks,
    subfolders,
    subfolderContents,
  });
}

/** Navigate to a folder */
export function navigateToFolder(folderId: string): void {
  loadFolder(folderId);
}

/** Get folder title for display */
export async function getFolderTitle(folderId: string): Promise<string> {
  const nodes = await chrome.bookmarks.get(folderId);
  if (nodes.length === 0) return 'Bookmarks';
  return nodes[0].title || getFolderDisplayName(folderId);
}

/** Get all folders as a flat list (for folder picker dropdown) */
export function flattenFolders(folders: BookmarkFolder[], depth = 0): Array<{ id: string; title: string; depth: number }> {
  const result: Array<{ id: string; title: string; depth: number }> = [];
  for (const folder of folders) {
    result.push({ id: folder.id, title: folder.title, depth });
    if (folder.children.length > 0) {
      result.push(...flattenFolders(folder.children, depth + 1));
    }
  }
  return result;
}

/** Get the full path from root to a folder (for breadcrumbs) */
export async function getFolderPath(folderId: string): Promise<Array<{ id: string; title: string }>> {
  const path: Array<{ id: string; title: string }> = [];
  let currentId: string | undefined = folderId;

  while (currentId && currentId !== '0') {
    let nodes: chrome.bookmarks.BookmarkTreeNode[];
    try {
      nodes = await chrome.bookmarks.get(currentId);
    } catch {
      break;
    }
    if (nodes.length === 0) break;
    const node = nodes[0];
    path.unshift({
      id: node.id,
      title: node.title || getFolderDisplayName(node.id),
    });
    currentId = node.parentId;
  }

  return path;
}

/** Recursively collect all bookmarks under a folder (for deep search) */
export async function getRecursiveBookmarks(folderId: string): Promise<BookmarkItem[]> {
  const results: BookmarkItem[] = [];

  async function walk(id: string): Promise<void> {
    const children = await chrome.bookmarks.getChildren(id);
    for (const child of children) {
      if (child.url) {
        results.push({
          id: child.id,
          title: child.title,
          url: child.url,
          parentId: child.parentId || id,
          dateAdded: child.dateAdded || 0,
        });
      } else {
        await walk(child.id);
      }
    }
  }

  await walk(folderId);
  return results;
}

/** Delete bookmarks with an undo toast (skips confirmation dialog) */
export async function deleteBookmarksWithUndo(ids: string[]): Promise<void> {
  const data = await Promise.all(ids.map(id => chrome.bookmarks.get(id).then(n => n[0])));
  await Promise.all(ids.map(id => chrome.bookmarks.remove(id)));
  const count = ids.length;
  showToast({
    message: count === 1 ? 'Bookmark deleted' : `${count} bookmarks deleted`,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const bm of data) {
          chrome.bookmarks.create({
            parentId: bm.parentId,
            title: bm.title,
            url: bm.url,
            index: bm.index,
          });
        }
      },
    },
  });
}

/** Debounced full tree reload — coalesces rapid-fire bookmark events */
let reloadTimer: number | undefined;
const RELOAD_DEBOUNCE_MS = 300;

function debouncedReload(): void {
  clearTimeout(reloadTimer);
  reloadTimer = window.setTimeout(() => {
    loadBookmarkTree();
  }, RELOAD_DEBOUNCE_MS);
}

/** Check if a parent folder affects the currently displayed view (direct or subfolder) */
function affectsCurrentView(parentId?: string): boolean {
  if (!parentId) return false;
  const currentId = store.get('currentFolderId');
  if (parentId === currentId) return true;
  return store.get('subfolders').some(f => f.id === parentId);
}

/** Register Chrome bookmark event listeners for live updates */
export function registerBookmarkListeners(): void {
  // Created: refresh if the new item is in the current view
  chrome.bookmarks.onCreated.addListener((_id, node) => {
    if (affectsCurrentView(node.parentId)) {
      loadFolder(store.get('currentFolderId'));
    }
    debouncedReload();
  });

  // Removed: refresh if the removed item was in the current view
  chrome.bookmarks.onRemoved.addListener((_id, info) => {
    removeBookmarkMeta(_id);
    if (affectsCurrentView(info.parentId)) {
      loadFolder(store.get('currentFolderId'));
    }
    debouncedReload();
  });

  // Changed: surgical update for direct bookmarks, debounced reload for subfolder content
  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    const bookmarks = store.get('bookmarks');
    const idx = bookmarks.findIndex(b => b.id === id);
    if (idx !== -1) {
      const updated = [...bookmarks];
      updated[idx] = {
        ...updated[idx],
        ...(changeInfo.title !== undefined && { title: changeInfo.title }),
        ...(changeInfo.url !== undefined && { url: changeInfo.url }),
      };
      store.set('bookmarks', updated);
    }
    debouncedReload();
  });

  // Moved: refresh if source or destination affects the current view
  chrome.bookmarks.onMoved.addListener((_id, moveInfo) => {
    if (affectsCurrentView(moveInfo.parentId) || affectsCurrentView(moveInfo.oldParentId)) {
      loadFolder(store.get('currentFolderId'));
    }
    debouncedReload();
  });
}
