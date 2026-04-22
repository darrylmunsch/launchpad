// ─── Drag and Drop ───
// Enables dragging bookmarks to reorder within a folder
// and dragging onto sidebar folders to move between folders.
//
// Key challenge: bookmark items are <a> tags, which have native
// link-drag behavior. We must handle this carefully to prevent
// the browser's default URL-drag from interfering.

import { store } from '../state';
import { showToast } from './toast';

let draggedBookmarkId: string | null = null;
let draggedElement: HTMLElement | null = null;
let draggedFolderId: string | null = null;
let draggedFolderElement: HTMLElement | null = null;

export function initDragDrop(): void {
  const grid = document.getElementById('bookmark-grid')!;
  const sidebar = document.getElementById('sidebar-nav')!;

  // ─── Drag start ───
  grid.addEventListener('dragstart', (e: DragEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.bookmark-item');
    if (!item || !e.dataTransfer) return;

    // Disable reorganization while a search filter is active.
    // Search results are flattened from many folders, so drop-target
    // indexes don't translate cleanly into sibling reorders.
    if (store.get('searchQuery').trim()) {
      showToast({ message: 'Reordering is disabled while searching' });
      return;
    }

    draggedBookmarkId = item.getAttribute('data-bookmark-id');
    draggedElement = item;
    item.classList.add('dragging');

    // Mark all selected items as dragging when dragging a selected item
    const selected = store.get('selectedBookmarkIds');
    if (draggedBookmarkId && selected.has(draggedBookmarkId) && selected.size > 1) {
      document.querySelectorAll<HTMLElement>('.bookmark-item.selected').forEach(el => {
        el.classList.add('dragging');
      });
    }

    // Override the browser's native link-drag behavior
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-bookmark-id', draggedBookmarkId || '');

    // Create a cleaner drag image
    const ghost = item.cloneNode(true) as HTMLElement;
    ghost.style.width = `${item.offsetWidth}px`;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    requestAnimationFrame(() => ghost.remove());
  });

  grid.addEventListener('dragend', () => {
    document.querySelectorAll('.bookmark-item.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
    clearAllDragOver();
    draggedBookmarkId = null;
    draggedElement = null;
  });

  // ─── Grid: dragover must ALWAYS preventDefault when we have a drag in progress ───
  // Without this, the browser rejects the drop entirely.
  grid.addEventListener('dragover', (e: DragEvent) => {
    if (!draggedBookmarkId) return;

    // Always prevent default so drop can fire
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    // Highlight the specific target item
    clearAllDragOver();
    const item = (e.target as HTMLElement).closest<HTMLElement>('.bookmark-item');
    if (item && item.getAttribute('data-bookmark-id') !== draggedBookmarkId) {
      item.classList.add('drag-over');
    }
  });

  grid.addEventListener('dragleave', (e: DragEvent) => {
    // Only clear if we're leaving the grid entirely
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !grid.contains(related)) {
      clearAllDragOver();
    }
  });

  // ─── Grid: drop to reorder ───
  grid.addEventListener('drop', async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearAllDragOver();
    if (!draggedBookmarkId) return;

    // Capture in local vars before any await — dragend fires
    // during awaits and clears the module-level variables.
    const bookmarkId = draggedBookmarkId;
    const targetItem = (e.target as HTMLElement).closest<HTMLElement>('.bookmark-item');
    if (!targetItem) return;

    const targetId = targetItem.getAttribute('data-bookmark-id');
    if (!targetId || targetId === bookmarkId) return;

    // Resolve target's parent + index from Chrome (not from currentFolderId —
    // the grid renders subfolder sections, so target's parent may differ
    // from the folder the user is viewing).
    const targetNodes = await chrome.bookmarks.get(targetId);
    if (targetNodes.length === 0) return;
    const targetNode = targetNodes[0];
    const targetParentId = targetNode.parentId;
    if (!targetParentId) return;
    const targetIndex = targetNode.index ?? 0;

    // Switch to manual sort so the reorder is visible
    const settings = store.get('settings');
    if (settings.sortMode !== 'manual') {
      store.set('settings', { ...settings, sortMode: 'manual' });
    }

    await chrome.bookmarks.move(bookmarkId, {
      parentId: targetParentId,
      index: targetIndex,
    });
  });

  // ─── Sidebar: folder drag start ───
  sidebar.addEventListener('dragstart', (e: DragEvent) => {
    const folderItem = (e.target as HTMLElement).closest<HTMLElement>('.folder-item[draggable="true"]');
    if (!folderItem || !e.dataTransfer) return;

    draggedFolderId = folderItem.getAttribute('data-folder-id');
    draggedFolderElement = folderItem;
    folderItem.classList.add('dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-folder-id', draggedFolderId || '');
  });

  sidebar.addEventListener('dragend', () => {
    if (draggedFolderElement) {
      draggedFolderElement.classList.remove('dragging');
    }
    clearAllDragOver();
    clearFolderDropIndicators();
    draggedFolderId = null;
    draggedFolderElement = null;
  });

  // ─── Sidebar: dragover (bookmark → folder move, or folder reorder) ───
  sidebar.addEventListener('dragover', (e: DragEvent) => {
    // Bookmark → folder drop
    if (draggedBookmarkId) {
      const folderBtn = (e.target as HTMLElement).closest<HTMLElement>('.folder-label');
      if (!folderBtn) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      clearAllDragOver();
      folderBtn.classList.add('drag-over');
      return;
    }

    // Folder reorder
    if (!draggedFolderId) return;

    const folderItem = (e.target as HTMLElement).closest<HTMLElement>('.folder-item[data-folder-id]');
    if (!folderItem) return;

    const targetId = folderItem.getAttribute('data-folder-id');
    if (!targetId || targetId === draggedFolderId) return;

    // Don't drop on self or descendants
    if (draggedFolderElement?.contains(folderItem)) return;

    // Don't allow dropping at root level (would create a sibling of Bookmarks Bar, etc.)
    if (!folderItem.hasAttribute('data-parent-id')) return;

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    // Above/below based on mouse Y relative to the folder label
    clearFolderDropIndicators();
    const btn = folderItem.querySelector('.folder-label');
    if (!btn) return;
    const btnRect = btn.getBoundingClientRect();
    const midY = btnRect.top + btnRect.height / 2;

    if (e.clientY < midY) {
      folderItem.classList.add('drag-above');
    } else {
      folderItem.classList.add('drag-below');
    }
  });

  sidebar.addEventListener('dragleave', (e: DragEvent) => {
    if (draggedBookmarkId) {
      const folderBtn = (e.target as HTMLElement).closest<HTMLElement>('.folder-label');
      folderBtn?.classList.remove('drag-over');
    }
    if (draggedFolderId) {
      const related = e.relatedTarget as HTMLElement | null;
      if (!related || !sidebar.contains(related)) {
        clearFolderDropIndicators();
      }
    }
  });

  // ─── Sidebar: drop (bookmark → folder move, or folder reorder) ───
  sidebar.addEventListener('drop', async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearAllDragOver();
    clearFolderDropIndicators();

    // Bookmark → folder move
    if (draggedBookmarkId) {
      const bookmarkId = draggedBookmarkId;
      const folderBtn = (e.target as HTMLElement).closest<HTMLElement>('.folder-label');
      if (!folderBtn) return;

      const targetFolderId = folderBtn.getAttribute('data-folder-id');
      if (!targetFolderId) return;

      const selected = store.get('selectedBookmarkIds');
      if (selected.has(bookmarkId) && selected.size > 1) {
        const ids = Array.from(selected);
        store.set('selectedBookmarkIds', new Set<string>());
        await Promise.all(ids.map(id => chrome.bookmarks.move(id, { parentId: targetFolderId })));
      } else {
        await chrome.bookmarks.move(bookmarkId, { parentId: targetFolderId });
      }
      return;
    }

    // Folder reorder
    if (!draggedFolderId) return;

    const folderId = draggedFolderId;
    const folderItem = (e.target as HTMLElement).closest<HTMLElement>('.folder-item[data-folder-id]');
    if (!folderItem) return;

    const targetId = folderItem.getAttribute('data-folder-id');
    if (!targetId || targetId === folderId) return;
    if (draggedFolderElement?.contains(folderItem)) return;

    const targetParentId = folderItem.getAttribute('data-parent-id');
    if (!targetParentId) return;

    // Determine drop position
    const btn = folderItem.querySelector('.folder-label');
    if (!btn) return;
    const btnRect = btn.getBoundingClientRect();
    const above = e.clientY < btnRect.top + btnRect.height / 2;

    // Get target's Chrome bookmark index
    const targetNodes = await chrome.bookmarks.get(targetId);
    if (targetNodes.length === 0) return;
    const targetIndex = targetNodes[0].index ?? 0;

    await chrome.bookmarks.move(folderId, {
      parentId: targetParentId,
      index: above ? targetIndex : targetIndex + 1,
    });
  });

  // ─── Prevent <a> default navigation during drag ───
  // When you drag and release an <a> on itself, the browser navigates.
  // Suppress clicks immediately after a drag operation.
  let justDragged = false;
  grid.addEventListener('dragend', () => {
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 100);
  });
  grid.addEventListener('click', (e: MouseEvent) => {
    if (justDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

function clearAllDragOver(): void {
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function clearFolderDropIndicators(): void {
  document.querySelectorAll('.drag-above, .drag-below').forEach(el => {
    el.classList.remove('drag-above', 'drag-below');
  });
}

/** Make a bookmark element draggable */
export function makeDraggable(element: HTMLElement): void {
  element.draggable = true;
}
