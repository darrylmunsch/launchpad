// ─── Context Menu Component ───
// Custom right-click menu for bookmark items.

import { store } from '../state';
import { loadBookmarkTree, navigateToFolder, deleteBookmarksWithUndo } from '../bookmarks';
import { $ } from '../utils/dom';
import { setBookmarkMeta } from '../settings';
import { confirmDelete } from './confirm-dialog';
import { showToast } from './toast';

// ─── SVG Icons ───
const PIN_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 2h6l-1 7h4l-7 8V9H7l2-7z"/></svg>';
const HIDE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const SHOW_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const PLUS_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const FOLDER_PLUS_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
const FOLDER_OPEN_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const EDIT_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const DELETE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

let menuEl: HTMLElement;
let activeBookmarkId: string | null = null;
let activeBookmarkUrl: string | null = null;

interface ContextMenuItem {
  label: string;
  icon: string;
  action: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
}

export function initContextMenu(): void {
  menuEl = $('#context-menu');

  // Listen for right-click on bookmark items (event delegation on body)
  document.addEventListener('contextmenu', handleContextMenu);

  // Close on click outside or Escape
  document.addEventListener('click', () => hide());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
}

function handleContextMenu(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const bookmarkEl = target.closest<HTMLElement>('.bookmark-item');

  if (!bookmarkEl) {
    const subfolderEl = target.closest<HTMLElement>('.bookmark-subfolder');
    const inGrid = target.closest('#bookmark-grid') || target.closest('#main-content');

    // Right-click on a subfolder item
    if (subfolderEl && inGrid) {
      e.preventDefault();
      const folderId = subfolderEl.getAttribute('data-folder-id');
      if (folderId) renderMenu(buildFolderMenuItems(folderId), e.clientX, e.clientY);
      return;
    }

    // Right-click on empty space
    if (inGrid) {
      e.preventDefault();
      const sectionEl = target.closest<HTMLElement>('[data-section-folder-id]');
      const scopeFolderId = sectionEl?.getAttribute('data-section-folder-id') || store.get('currentFolderId');
      renderMenu(buildBackgroundMenuItems(scopeFolderId), e.clientX, e.clientY);
      return;
    }

    // Right-click on a sidebar folder
    const sidebarFolderEl = target.closest<HTMLElement>('#sidebar .folder-label');
    if (sidebarFolderEl) {
      e.preventDefault();
      const folderId = sidebarFolderEl.getAttribute('data-folder-id');
      if (folderId) renderMenu(buildFolderMenuItems(folderId), e.clientX, e.clientY);
      return;
    }

    hide();
    return;
  }

  e.preventDefault();
  activeBookmarkId = bookmarkEl.getAttribute('data-bookmark-id');
  activeBookmarkUrl = bookmarkEl.getAttribute('href');

  // Check for bulk selection
  const selected = store.get('selectedBookmarkIds');
  if (activeBookmarkId && selected.has(activeBookmarkId) && selected.size > 1) {
    renderMenu(buildBulkMenuItems(selected), e.clientX, e.clientY);
    return;
  }

  const meta = activeBookmarkId ? store.get('bookmarkMeta')[activeBookmarkId] : undefined;

  const items: ContextMenuItem[] = [
    {
      label: 'Open in New Tab',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
      action: () => {
        if (activeBookmarkUrl) chrome.tabs.create({ url: activeBookmarkUrl });
      },
    },
    {
      label: 'Open in New Window',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      action: () => {
        if (activeBookmarkUrl) chrome.windows.create({ url: activeBookmarkUrl });
      },
    },
    {
      label: 'Open in Incognito',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      action: () => {
        if (activeBookmarkUrl) {
          chrome.windows.create({ url: activeBookmarkUrl, incognito: true });
        }
      },
      dividerAfter: true,
    },
    {
      label: 'Edit',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      action: () => {
        if (activeBookmarkId) {
          // Dispatch custom event for edit-modal to pick up
          document.dispatchEvent(new CustomEvent('edit-bookmark', { detail: { id: activeBookmarkId } }));
        }
      },
    },
    {
      label: 'Copy URL',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      action: () => {
        if (activeBookmarkUrl) {
          navigator.clipboard.writeText(activeBookmarkUrl);
        }
      },
      dividerAfter: true,
    },
    {
      label: meta?.pinned ? 'Unpin' : 'Pin',
      icon: PIN_SVG,
      action: () => {
        if (activeBookmarkId) setBookmarkMeta(activeBookmarkId, { pinned: !meta?.pinned });
      },
    },
    {
      label: meta?.hidden ? 'Unhide' : 'Hide',
      icon: meta?.hidden ? SHOW_SVG : HIDE_SVG,
      action: () => {
        if (activeBookmarkId) setBookmarkMeta(activeBookmarkId, { hidden: !meta?.hidden });
      },
      dividerAfter: true,
    },
    {
      label: 'Delete',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      action: async () => {
        if (activeBookmarkId) {
          await deleteBookmarksWithUndo([activeBookmarkId]);
        }
      },
      danger: true,
    },
  ];

  renderMenu(items, e.clientX, e.clientY);
}

function renderMenu(items: ContextMenuItem[], x: number, y: number): void {
  menuEl.innerHTML = '';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = `context-menu-item${item.danger ? ' danger' : ''}`;
    btn.innerHTML = `${item.icon}<span>${item.label}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      item.action();
      hide();
    });
    menuEl.appendChild(btn);

    if (item.dividerAfter) {
      const divider = document.createElement('div');
      divider.className = 'context-menu-divider';
      menuEl.appendChild(divider);
    }
  }

  // Position — keep within viewport
  menuEl.hidden = false;
  const rect = menuEl.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 8;
  const maxY = window.innerHeight - rect.height - 8;
  menuEl.style.left = `${Math.min(x, maxX)}px`;
  menuEl.style.top = `${Math.min(y, maxY)}px`;
}

function hide(): void {
  menuEl.hidden = true;
  activeBookmarkId = null;
  activeBookmarkUrl = null;
}

function buildBulkMenuItems(selected: Set<string>): ContextMenuItem[] {
  const count = selected.size;
  return [
    {
      label: `Open ${count} in New Tabs`,
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
      action: () => {
        for (const id of selected) {
          const el = document.querySelector<HTMLAnchorElement>(`[data-bookmark-id="${id}"]`);
          if (el?.href) chrome.tabs.create({ url: el.href });
        }
      },
      dividerAfter: true,
    },
    {
      label: `Move ${count} Bookmarks\u2026`,
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      action: () => {
        document.dispatchEvent(new CustomEvent('move-bookmarks'));
      },
    },
    {
      label: `Copy ${count} URLs`,
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      action: () => {
        const urls: string[] = [];
        for (const id of selected) {
          const el = document.querySelector<HTMLAnchorElement>(`[data-bookmark-id="${id}"]`);
          if (el?.href) urls.push(el.href);
        }
        navigator.clipboard.writeText(urls.join('\n'));
      },
      dividerAfter: true,
    },
    {
      label: `Pin ${count} Bookmarks`,
      icon: PIN_SVG,
      action: () => {
        for (const id of selected) setBookmarkMeta(id, { pinned: true });
      },
    },
    {
      label: `Hide ${count} Bookmarks`,
      icon: HIDE_SVG,
      action: () => {
        for (const id of selected) setBookmarkMeta(id, { hidden: true });
      },
      dividerAfter: true,
    },
    {
      label: `Delete ${count} Bookmarks`,
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      action: async () => {
        const ids = Array.from(selected);
        store.set('selectedBookmarkIds', new Set<string>());
        await deleteBookmarksWithUndo(ids);
      },
      danger: true,
    },
  ];
}

function buildFolderMenuItems(folderId: string): ContextMenuItem[] {
  const meta = store.get('bookmarkMeta')[folderId];
  return [
    {
      label: 'Open',
      icon: FOLDER_OPEN_SVG,
      action: () => {
        navigateToFolder(folderId);
      },
      dividerAfter: true,
    },
    {
      label: 'Add Bookmark',
      icon: PLUS_SVG,
      action: () => {
        document.dispatchEvent(new CustomEvent('create-bookmark', { detail: { parentId: folderId } }));
      },
    },
    {
      label: 'Add Folder',
      icon: FOLDER_PLUS_SVG,
      action: () => {
        document.dispatchEvent(new CustomEvent('create-folder', { detail: { parentId: folderId } }));
      },
      dividerAfter: true,
    },
    {
      label: meta?.pinned ? 'Unpin' : 'Pin',
      icon: PIN_SVG,
      action: () => {
        setBookmarkMeta(folderId, { pinned: !meta?.pinned });
      },
      dividerAfter: true,
    },
    {
      label: 'Rename',
      icon: EDIT_SVG,
      action: () => {
        document.dispatchEvent(new CustomEvent('edit-folder', { detail: { id: folderId } }));
      },
      dividerAfter: true,
    },
    {
      label: 'Delete',
      icon: DELETE_SVG,
      action: async () => {
        if (await confirmDelete('Delete Folder?', 'This folder and all its contents will be permanently removed.')) {
          await chrome.bookmarks.removeTree(folderId);
          showToast({ message: 'Folder deleted' });
        }
      },
      danger: true,
    },
  ];
}

function buildBackgroundMenuItems(parentId: string): ContextMenuItem[] {
  return [
    {
      label: 'Add Bookmark',
      icon: PLUS_SVG,
      action: () => {
        document.dispatchEvent(new CustomEvent('create-bookmark', { detail: { parentId } }));
      },
    },
    {
      label: 'Add Folder',
      icon: FOLDER_PLUS_SVG,
      action: () => {
        document.dispatchEvent(new CustomEvent('create-folder', { detail: { parentId } }));
      },
    },
  ];
}
