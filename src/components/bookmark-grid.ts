// ─── Bookmark Grid Component ───
// Renders bookmarks in the main content area with card/compact views
// and row/column layouts. Uses event delegation for click handling.

import type { BookmarkItem, BookmarkFolder } from '../types';
import { store } from '../state';
import { navigateToFolder, getFolderPath, getFolderTitle, getRecursiveBookmarks, flattenFolders, deleteBookmarksWithUndo } from '../bookmarks';
import { sortBookmarks } from '../utils/sort';
import { createFaviconElement } from '../favicon';
import { $, clearChildren } from '../utils/dom';
import { makeDraggable } from './drag-drop';
import { showToast } from './toast';

let gridEl: HTMLElement;
let headerEl: HTMLElement;
let selectionBarEl: HTMLElement;
let lastClickedId: string | null = null;

export function initBookmarkGrid(): void {
  gridEl = $('#bookmark-grid');
  headerEl = $('#content-header');

  // Re-render on data changes
  store.subscribe('bookmarks', () => {
    pruneStaleSelection();
    render();
  });
  store.subscribe('subfolders', () => render());
  store.subscribe('subfolderContents', () => render());
  store.subscribe('searchQuery', () => {
    clearSelection();
    render();
  });
  store.subscribe('currentFolderId', () => {
    clearSelection();
    updateHeader();
  });

  // Update selection visuals without full re-render
  store.subscribe('selectedBookmarkIds', (selected: Set<string>) => {
    gridEl.querySelectorAll<HTMLElement>('.bookmark-item').forEach(el => {
      const id = el.getAttribute('data-bookmark-id');
      el.classList.toggle('selected', id !== null && selected.has(id));
    });
    updateSelectionBar(selected);
  });

  // Re-render on bookmark metadata changes (pin/hide)
  store.subscribe('bookmarkMeta', () => render());

  // Re-render on view/layout/sort changes
  store.subscribe('settings', () => {
    applyViewSettings();
    render();
    updateHeaderToggles();
  });

  // Event delegation: handle bookmark clicks
  gridEl.addEventListener('click', handleGridClick);

  // Keyboard navigation within the grid
  gridEl.addEventListener('keydown', handleGridKeydown);

  // Listen for move-bookmarks event (from context menu)
  document.addEventListener('move-bookmarks', () => openMoveDialog());

  // Create selection bar
  createSelectionBar();

  // Initial render
  applyViewSettings();
  render();
  updateHeader();
}

function applyViewSettings(): void {
  const settings = store.get('settings');
  gridEl.setAttribute('data-view', settings.viewMode);
  gridEl.setAttribute('data-layout', settings.layoutMode);
}

async function updateHeader(): Promise<void> {
  const folderId = store.get('currentFolderId');
  const path = await getFolderPath(folderId);
  const bookmarks = store.get('bookmarks');
  const subfolders = store.get('subfolders');
  const totalCount = bookmarks.length + subfolders.length;
  const settings = store.get('settings');

  // Build breadcrumb HTML
  const breadcrumbParts = path.map((segment, i) => {
    const isLast = i === path.length - 1;
    if (isLast) {
      return `<span class="breadcrumb-current">${escapeHtml(segment.title)}</span>`;
    }
    return `<button class="breadcrumb-link" data-folder-id="${segment.id}">${escapeHtml(segment.title)}</button><span class="breadcrumb-sep">/</span>`;
  }).join('');

  headerEl.innerHTML = `
    <div class="header-left">
      <div class="header-breadcrumb">
        ${breadcrumbParts}
        <span class="bookmark-section-count">${totalCount}</span>
      </div>
    </div>
    <div class="header-controls">
      <button class="header-action-btn" id="add-bookmark-btn" title="Add bookmark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button class="header-action-btn${settings.showHidden ? ' active' : ''}" id="show-hidden-btn" title="${settings.showHidden ? 'Hide hidden bookmarks' : 'Show hidden bookmarks'}">
        ${settings.showHidden
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        }
      </button>
      <div class="search-container">
        <span class="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input type="text" class="search-input" id="search-input" placeholder="Search..." aria-label="Search bookmarks" value="${escapeHtml(store.get('searchQuery'))}">
        <span class="search-shortcut">Ctrl+F</span>
      </div>
      <div class="sort-container">
        <label class="sort-label" for="sort-select">Sort:</label>
        <select class="sort-select" id="sort-select">
          <option value="manual"${store.get('settings').sortMode === 'manual' ? ' selected' : ''}>Manual</option>
          <option value="alpha"${store.get('settings').sortMode === 'alpha' ? ' selected' : ''}>Alphabet</option>
          <option value="dateAdded"${store.get('settings').sortMode === 'dateAdded' ? ' selected' : ''}>Date Added</option>
          <option value="url"${store.get('settings').sortMode === 'url' ? ' selected' : ''}>URL</option>
        </select>
      </div>
      <div class="view-toggles">
        <button class="view-toggle-btn${store.get('settings').viewMode === 'card' ? ' active' : ''}" data-view="card" title="Card view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
        </button>
        <button class="view-toggle-btn${store.get('settings').viewMode === 'compact' ? ' active' : ''}" data-view="compact" title="Compact view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="layout-toggles">
        <button class="layout-toggle-btn${store.get('settings').layoutMode === 'row' ? ' active' : ''}" data-layout="row" title="Row layout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/>
            <rect x="3" y="17" width="18" height="4" rx="1"/>
          </svg>
        </button>
        <button class="layout-toggle-btn${store.get('settings').layoutMode === 'column' ? ' active' : ''}" data-layout="column" title="Column layout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/>
            <rect x="17" y="3" width="4" height="18" rx="1"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  wireUpHeaderControls();
}

/** Update only toggle active states without rebuilding header */
function updateHeaderToggles(): void {
  const settings = store.get('settings');
  headerEl.querySelectorAll<HTMLButtonElement>('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === settings.viewMode);
  });
  headerEl.querySelectorAll<HTMLButtonElement>('.layout-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-layout') === settings.layoutMode);
  });
}

function wireUpHeaderControls(): void {
  // Add bookmark button
  const addBtn = document.getElementById('add-bookmark-btn');
  addBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('create-bookmark'));
  });

  // Show hidden toggle
  const hiddenBtn = document.getElementById('show-hidden-btn');
  hiddenBtn?.addEventListener('click', () => {
    const s = store.get('settings');
    const nowShowing = !s.showHidden;
    store.set('settings', { ...s, showHidden: nowShowing });
    showToast({ message: nowShowing ? 'Showing hidden items' : 'Hidden items concealed' });
    updateHeader();
  });

  // Breadcrumb navigation
  headerEl.querySelectorAll<HTMLButtonElement>('.breadcrumb-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const folderId = btn.getAttribute('data-folder-id');
      if (folderId) navigateToFolder(folderId);
    });
  });

  // Search input
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  if (searchInput) {
    let debounceTimer: number;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        store.set('searchQuery', searchInput.value);
      }, 150);
    });
  }

  // Sort
  const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const settings = store.get('settings');
      store.set('settings', { ...settings, sortMode: sortSelect.value as import('../types').SortMode });
    });
  }

  // View toggles
  headerEl.querySelectorAll<HTMLButtonElement>('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view') as import('../types').ViewMode;
      const settings = store.get('settings');
      if (settings.viewMode !== view) {
        store.set('settings', { ...settings, viewMode: view });
        showToast({ message: `View: ${view === 'card' ? 'Card' : 'Compact'}` });
      }
    });
  });

  // Layout toggles
  headerEl.querySelectorAll<HTMLButtonElement>('.layout-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.getAttribute('data-layout') as import('../types').LayoutMode;
      const settings = store.get('settings');
      if (settings.layoutMode !== layout) {
        store.set('settings', { ...settings, layoutMode: layout });
        showToast({ message: `Layout: ${layout === 'row' ? 'Row' : 'Column'}` });
      }
    });
  });
}

// Track the latest render call to discard stale async results
let renderGeneration = 0;

async function render(): Promise<void> {
  const generation = ++renderGeneration;
  const directBookmarks = store.get('bookmarks');
  const subfolders = store.get('subfolders');
  const subfolderContents = store.get('subfolderContents');
  const query = store.get('searchQuery').toLowerCase().trim();
  const settings = store.get('settings');
  const meta = store.get('bookmarkMeta');

  // Clear and rebuild
  clearChildren(gridEl);

  // ─── Search Mode: flat results across all descendants ───
  if (query) {
    const allNested = await getRecursiveBookmarks(store.get('currentFolderId'));
    if (generation !== renderGeneration) return;
    const filtered = allNested.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query)
    );
    const visible = settings.showHidden
      ? filtered
      : filtered.filter(b => !meta[b.id]?.hidden);
    const sorted = sortBookmarks(visible, settings.sortMode);

    if (sorted.length === 0) {
      gridEl.appendChild(createEmptyState(query));
    } else {
      const list = document.createElement('div');
      list.className = 'bookmark-list';
      for (const bookmark of sorted) {
        list.appendChild(createBookmarkElement(bookmark));
      }
      gridEl.appendChild(list);
    }
    return;
  }

  // ─── Sectioned View ───

  // Collect ALL bookmarks (direct + subfolder children) for pinned extraction
  const allBookmarks: BookmarkItem[] = [...directBookmarks];
  for (const subfolder of subfolders) {
    const content = subfolderContents[subfolder.id];
    if (content) allBookmarks.push(...content.bookmarks);
  }

  // Filter hidden from the full set, then extract pinned
  const visibleAll = settings.showHidden
    ? allBookmarks
    : allBookmarks.filter(b => !meta[b.id]?.hidden);
  const pinned = visibleAll.filter(b => meta[b.id]?.pinned);
  const pinnedIds = new Set(pinned.map(b => b.id));

  // Collect ALL visible folders for pinned folder extraction
  const allFolders: BookmarkFolder[] = [...subfolders];
  for (const subfolder of subfolders) {
    const content = subfolderContents[subfolder.id];
    if (content) allFolders.push(...content.subfolders);
  }
  const pinnedFolders = allFolders.filter(f => meta[f.id]?.pinned);
  const pinnedFolderIds = new Set(pinnedFolders.map(f => f.id));

  // 1. Pinned section (bookmarks + folders pulled from any source)
  if (pinned.length > 0 || pinnedFolders.length > 0) {
    const sorted = sortBookmarks(pinned, settings.sortMode);
    gridEl.appendChild(createSection('Pinned', null, sorted, pinnedFolders));
  }

  // 2. Current folder section (direct bookmarks, minus pinned/hidden)
  const currentFolderId = store.get('currentFolderId');
  const directVisible = (settings.showHidden
    ? directBookmarks
    : directBookmarks.filter(b => !meta[b.id]?.hidden)
  ).filter(b => !pinnedIds.has(b.id));

  const folderTitle = await getFolderTitle(currentFolderId);
  if (generation !== renderGeneration) return;

  if (directVisible.length > 0) {
    const sorted = sortBookmarks(directVisible, settings.sortMode);
    gridEl.appendChild(createSection(folderTitle, currentFolderId, sorted, []));
  }

  // 3. One section per subfolder (skip pinned subfolders — they're in the Pinned section)
  for (const subfolder of subfolders) {
    if (pinnedFolderIds.has(subfolder.id)) continue;
    const content = subfolderContents[subfolder.id];
    if (!content) continue;

    const subVisible = (settings.showHidden
      ? content.bookmarks
      : content.bookmarks.filter(b => !meta[b.id]?.hidden)
    ).filter(b => !pinnedIds.has(b.id));

    const childFolders = content.subfolders.filter(f => !pinnedFolderIds.has(f.id));

    // Skip empty sections
    if (subVisible.length === 0 && childFolders.length === 0) continue;

    const sorted = sortBookmarks(subVisible, settings.sortMode);
    gridEl.appendChild(createSection(subfolder.title, subfolder.id, sorted, childFolders));
  }

  // Empty state if nothing was rendered
  if (gridEl.children.length === 0) {
    gridEl.appendChild(createEmptyState(''));
  }
}

function createSection(title: string, folderId: string | null, bookmarks: BookmarkItem[], childFolders: BookmarkFolder[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'bookmark-section';
  if (folderId) section.setAttribute('data-section-folder-id', folderId);

  const totalCount = bookmarks.length + childFolders.length;
  const header = document.createElement('div');
  header.className = 'bookmark-section-header';
  header.innerHTML = `
    <span class="bookmark-section-title">${escapeHtml(title)}</span>
    <span class="bookmark-section-count">${totalCount}</span>
  `;
  section.appendChild(header);

  // Child subfolders (rendered as clickable directory items)
  if (childFolders.length > 0) {
    const folderList = document.createElement('div');
    folderList.className = 'subfolder-list';
    for (const folder of childFolders) {
      folderList.appendChild(createSubfolderElement(folder));
    }
    section.appendChild(folderList);
  }

  // Bookmarks
  if (bookmarks.length > 0) {
    const list = document.createElement('div');
    list.className = 'bookmark-list';
    for (const bookmark of bookmarks) {
      list.appendChild(createBookmarkElement(bookmark));
    }
    section.appendChild(list);
  }

  return section;
}

function createBookmarkElement(bookmark: BookmarkItem): HTMLElement {
  const item = document.createElement('a');
  item.className = 'bookmark-item';
  item.href = bookmark.url;
  item.setAttribute('data-bookmark-id', bookmark.id);
  item.title = `${bookmark.title}\n${bookmark.url}`;
  item.tabIndex = 0;

  if (store.get('selectedBookmarkIds').has(bookmark.id)) {
    item.classList.add('selected');
  }

  const bmMeta = store.get('bookmarkMeta')[bookmark.id];
  if (bmMeta?.pinned) item.classList.add('bookmark-pinned');
  if (bmMeta?.hidden) item.classList.add('bookmark-hidden');

  makeDraggable(item);

  const faviconSize = store.get('settings').viewMode === 'card' ? 32 : 16;
  const favicon = createFaviconElement(bookmark.url, faviconSize);
  item.appendChild(favicon);

  const title = document.createElement('span');
  title.className = 'bookmark-title';
  title.textContent = bookmark.title || bookmark.url;
  item.appendChild(title);

  return item;
}

function createSubfolderElement(folder: BookmarkFolder): HTMLElement {
  const item = document.createElement('div');
  item.className = 'bookmark-subfolder';
  item.setAttribute('data-folder-id', folder.id);
  item.tabIndex = 0;

  const icon = document.createElement('span');
  icon.className = 'bookmark-subfolder-icon';
  icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  item.appendChild(icon);

  const name = document.createElement('span');
  name.className = 'bookmark-subfolder-name';
  name.textContent = folder.title;
  item.appendChild(name);

  const count = document.createElement('span');
  count.className = 'bookmark-subfolder-count';
  count.textContent = `${folder.bookmarkCount}`;
  item.appendChild(count);

  return item;
}

function createEmptyState(query: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'bookmark-empty';
  empty.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <div class="bookmark-empty-title">${query ? 'No matching bookmarks' : 'No bookmarks in this folder'}</div>
    <div class="bookmark-empty-subtitle">${query ? 'Try a different search term' : 'Bookmarks added to this folder will appear here'}</div>
  `;
  return empty;
}

function handleGridKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  const isBookmark = target.classList.contains('bookmark-item');
  const isSubfolder = target.classList.contains('bookmark-subfolder');

  if (!isBookmark && !isSubfolder) return;

  const focusables = Array.from(
    gridEl.querySelectorAll<HTMLElement>('.bookmark-item, .bookmark-subfolder')
  );
  const currentIndex = focusables.indexOf(target);

  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight': {
      e.preventDefault();
      const next = focusables[currentIndex + 1];
      next?.focus();
      break;
    }
    case 'ArrowUp':
    case 'ArrowLeft': {
      e.preventDefault();
      const prev = focusables[currentIndex - 1];
      prev?.focus();
      break;
    }
    case 'Enter': {
      if (isSubfolder) {
        e.preventDefault();
        const folderId = target.getAttribute('data-folder-id');
        if (folderId) navigateToFolder(folderId);
      }
      // For bookmarks, Enter follows the <a> href naturally
      break;
    }
    case 'Delete': {
      e.preventDefault();
      const selected = store.get('selectedBookmarkIds');
      if (selected.size > 0) {
        deleteSelected();
      } else if (isBookmark) {
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId) {
          deleteBookmarksWithUndo([bookmarkId]);
        }
      }
      break;
    }
    case 'e': {
      if (isBookmark && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId) {
          document.dispatchEvent(new CustomEvent('edit-bookmark', { detail: { id: bookmarkId } }));
        }
      }
      break;
    }
  }
}

function handleGridClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;

  // Check if a subfolder was clicked
  const subfolderEl = target.closest<HTMLElement>('.bookmark-subfolder');
  if (subfolderEl) {
    e.preventDefault();
    const folderId = subfolderEl.getAttribute('data-folder-id');
    if (folderId) {
      navigateToFolder(folderId);
      const expanded = new Set(store.get('expandedFolders'));
      expanded.add(folderId);
      store.set('expandedFolders', expanded);
    }
    return;
  }

  // Check if a bookmark was clicked
  const bookmarkEl = target.closest<HTMLElement>('.bookmark-item');
  if (bookmarkEl) {
    const bookmarkId = bookmarkEl.getAttribute('data-bookmark-id');
    if (!bookmarkId) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelection(bookmarkId);
      return;
    }

    if (e.shiftKey) {
      e.preventDefault();
      rangeSelect(bookmarkId);
      return;
    }

    // Normal click — clear selection if active, then navigate
    if (store.get('selectedBookmarkIds').size > 0) {
      clearSelection();
    }

    // Open in new tab if the setting is enabled
    if (store.get('settings').openInNewTab) {
      e.preventDefault();
      const url = (bookmarkEl as HTMLAnchorElement).href;
      if (url) chrome.tabs.create({ url });
    }
    return;
  }

  // Clicked empty space — clear selection
  clearSelection();
}

// ─── Selection Management ───

function toggleSelection(bookmarkId: string): void {
  const selected = new Set(store.get('selectedBookmarkIds'));
  if (selected.has(bookmarkId)) {
    selected.delete(bookmarkId);
  } else {
    selected.add(bookmarkId);
  }
  lastClickedId = bookmarkId;
  store.set('selectedBookmarkIds', selected);
}

function rangeSelect(bookmarkId: string): void {
  const items = Array.from(gridEl.querySelectorAll<HTMLElement>('.bookmark-item'));
  const ids = items.map(el => el.getAttribute('data-bookmark-id')!).filter(Boolean);

  const anchorId = lastClickedId || ids[0];
  const startIdx = ids.indexOf(anchorId);
  const endIdx = ids.indexOf(bookmarkId);

  if (startIdx === -1 || endIdx === -1) return;

  const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  const selected = new Set(store.get('selectedBookmarkIds'));
  for (let i = from; i <= to; i++) {
    selected.add(ids[i]);
  }
  lastClickedId = bookmarkId;
  store.set('selectedBookmarkIds', selected);
}

function clearSelection(): void {
  if (store.get('selectedBookmarkIds').size > 0) {
    store.set('selectedBookmarkIds', new Set<string>());
  }
  lastClickedId = null;
}

function pruneStaleSelection(): void {
  const selected = store.get('selectedBookmarkIds');
  if (selected.size === 0) return;
  // Collect all visible bookmark IDs (direct + subfolder contents)
  const currentIds = new Set(store.get('bookmarks').map(b => b.id));
  const contents = store.get('subfolderContents');
  for (const sub of Object.values(contents)) {
    for (const b of sub.bookmarks) currentIds.add(b.id);
  }
  const pruned = new Set([...selected].filter(id => currentIds.has(id)));
  if (pruned.size !== selected.size) {
    store.set('selectedBookmarkIds', pruned);
  }
}

async function deleteSelected(): Promise<void> {
  const selected = store.get('selectedBookmarkIds');
  if (selected.size === 0) return;
  const ids = Array.from(selected);
  clearSelection();
  await deleteBookmarksWithUndo(ids);
}

// ─── Selection Bar ───

function createSelectionBar(): void {
  selectionBarEl = document.createElement('div');
  selectionBarEl.className = 'selection-bar';
  selectionBarEl.hidden = true;
  selectionBarEl.innerHTML = `
    <span class="selection-count"></span>
    <div class="selection-actions">
      <button class="btn btn-secondary selection-action-btn" data-action="move">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        Move to\u2026
      </button>
      <button class="btn btn-danger selection-action-btn" data-action="delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Delete
      </button>
    </div>
    <button class="selection-close-btn" data-action="clear" title="Clear selection (Esc)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  document.body.appendChild(selectionBarEl);

  selectionBarEl.addEventListener('click', (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'move') openMoveDialog();
    else if (action === 'delete') deleteSelected();
    else if (action === 'clear') clearSelection();
  });
}

function updateSelectionBar(selected: Set<string>): void {
  if (selected.size === 0) {
    selectionBarEl.hidden = true;
    return;
  }
  selectionBarEl.hidden = false;
  const countEl = selectionBarEl.querySelector('.selection-count')!;
  countEl.textContent = `${selected.size} selected`;
}

// ─── Move Dialog ───

let moveDialogEl: HTMLDialogElement | null = null;

function openMoveDialog(): void {
  const selected = store.get('selectedBookmarkIds');
  if (selected.size === 0) return;

  if (!moveDialogEl) {
    moveDialogEl = document.createElement('dialog');
    moveDialogEl.className = 'modal';
    moveDialogEl.innerHTML = `
      <form method="dialog" class="modal-form" id="move-form">
        <h2 class="modal-title"></h2>
        <label class="form-field">
          <span class="form-label">Destination folder</span>
          <select class="form-select" id="move-folder-select"></select>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="move-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Move</button>
        </div>
      </form>
    `;
    document.body.appendChild(moveDialogEl);

    moveDialogEl.querySelector('#move-cancel')!.addEventListener('click', () => {
      moveDialogEl!.close();
    });

    moveDialogEl.querySelector('#move-form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const select = document.getElementById('move-folder-select') as HTMLSelectElement;
      await moveSelectedToFolder(select.value);
      moveDialogEl!.close();
    });
  }

  // Populate folder dropdown
  const select = document.getElementById('move-folder-select') as HTMLSelectElement;
  select.innerHTML = '';
  const folders = store.get('folders');
  const flat = flattenFolders(folders);
  for (const folder of flat) {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = '\u00A0'.repeat(folder.depth * 3) + folder.title;
    option.selected = folder.id === store.get('currentFolderId');
    select.appendChild(option);
  }

  moveDialogEl.querySelector('.modal-title')!.textContent =
    `Move ${selected.size} bookmark${selected.size === 1 ? '' : 's'}`;

  moveDialogEl.showModal();
}

async function moveSelectedToFolder(targetFolderId: string): Promise<void> {
  const selected = store.get('selectedBookmarkIds');
  if (selected.size === 0) return;
  const ids = Array.from(selected);
  clearSelection();
  await Promise.all(ids.map(id => chrome.bookmarks.move(id, { parentId: targetFolderId })));
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
