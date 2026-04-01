// ─── App Bootstrap ───
// Orchestrates initialization in the correct order for instant load.

import { store } from './state';
import { loadSettings, applySettings, loadSessionState, loadBookmarkMeta, initAutoSave } from './settings';
import { loadBookmarkTree, registerBookmarkListeners } from './bookmarks';
import { initSidebar } from './components/sidebar';
import { initBookmarkGrid } from './components/bookmark-grid';
import { initContextMenu } from './components/context-menu';
import { initEditModal } from './components/edit-modal';
import { initSettingsModal } from './components/settings-modal';
import { initDragDrop } from './components/drag-drop';
import { initToolsPanel } from './components/tools-panel';
import { registerShortcut, initKeyboardShortcuts } from './utils/keyboard';

async function init(): Promise<void> {
  try {
    // 1. Load persisted settings + bookmark metadata in parallel
    const [settings] = await Promise.all([loadSettings(), loadBookmarkMeta()]);
    applySettings(settings);

    // 2. Restore last session (folder, sidebar expansion)
    await loadSessionState();

    // 3. Fetch bookmark tree
    await loadBookmarkTree();

    // 4. Initialize all components
    initSidebar();
    initBookmarkGrid();
    initContextMenu();
    initEditModal();
    initSettingsModal();
    initDragDrop();
    initToolsPanel();

    // 5. Register keyboard shortcuts
    registerShortcut({
      key: 'f',
      ctrl: true,
      handler: () => {
        const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
        searchInput?.focus();
        searchInput?.select();
      },
    });
    registerShortcut({
      key: 'n',
      ctrl: true,
      handler: () => {
        document.dispatchEvent(new CustomEvent('create-bookmark'));
      },
    });
    registerShortcut({
      key: 'a',
      ctrl: true,
      handler: () => {
        const items = document.querySelectorAll<HTMLElement>('.bookmark-item');
        const ids = new Set<string>();
        items.forEach(el => {
          const id = el.getAttribute('data-bookmark-id');
          if (id) ids.add(id);
        });
        store.set('selectedBookmarkIds', ids);
      },
    });
    registerShortcut({
      key: 'Escape',
      handler: () => {
        // Clear selection first, then search
        const selected = store.get('selectedBookmarkIds');
        if (selected.size > 0) {
          store.set('selectedBookmarkIds', new Set<string>());
          return;
        }
        if (store.get('searchQuery')) {
          store.set('searchQuery', '');
          const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
          if (searchInput) searchInput.value = '';
        }
      },
    });
    initKeyboardShortcuts();

    // 6. Register live update listeners
    registerBookmarkListeners();

    // 7. Auto-persist state changes (settings, folder, sidebar)
    initAutoSave();
  } catch (err) {
    console.error('[Launchpad] Init failed:', err);
    // Show error in the main content area so it's visible
    const grid = document.getElementById('bookmark-grid');
    if (grid) {
      grid.innerHTML = `<div class="bookmark-empty">
        <div class="bookmark-empty-title">Failed to load bookmarks</div>
        <div class="bookmark-empty-subtitle">${err instanceof Error ? err.message : String(err)}</div>
      </div>`;
    }
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
