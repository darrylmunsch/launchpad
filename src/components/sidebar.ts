// ─── Sidebar Component ───
// Renders the folder tree recursively with collapsible subfolders.

import type { BookmarkFolder } from '../types';
import { store } from '../state';
import { navigateToFolder } from '../bookmarks';
import { $, clearChildren } from '../utils/dom';

let navEl: HTMLElement;

export function initSidebar(): void {
  navEl = $('#sidebar-nav');

  // Re-render when folders change
  store.subscribe('folders', render);
  store.subscribe('currentFolderId', () => updateActiveState());
  store.subscribe('expandedFolders', () => render(store.get('folders')));

  // Sidebar collapse toggle
  const collapseBtn = $('#sidebar-collapse-btn');
  collapseBtn.addEventListener('click', () => {
    const sidebar = $('#sidebar');
    const collapsed = sidebar.classList.toggle('collapsed');
    updateCollapseIcon(collapseBtn, collapsed);
    const settings = store.get('settings');
    store.set('settings', { ...settings, sidebarCollapsed: collapsed });
  });

  // Set initial collapse icon state
  updateCollapseIcon(collapseBtn, store.get('settings').sidebarCollapsed);

  // Initial render
  render(store.get('folders'));
}

function render(folders: BookmarkFolder[]): void {
  clearChildren(navEl);
  const tree = createFolderTree(folders, 0);
  navEl.appendChild(tree);
}

function createFolderTree(folders: BookmarkFolder[], depth: number): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.className = 'folder-tree';

  for (const folder of folders) {
    const li = document.createElement('li');
    li.className = 'folder-item';
    li.setAttribute('data-folder-id', folder.id);

    // Non-root folders can be drag-reordered
    if (folder.parentId && folder.parentId !== '0') {
      li.draggable = true;
      li.setAttribute('data-parent-id', folder.parentId);
    }

    const hasChildren = folder.children.length > 0;
    const isExpanded = store.get('expandedFolders').has(folder.id);
    const isActive = store.get('currentFolderId') === folder.id;

    // Folder label button
    const btn = document.createElement('button');
    btn.className = `folder-label${isActive ? ' active' : ''}`;
    btn.style.paddingLeft = `${16 + depth * 16}px`;
    btn.setAttribute('data-folder-id', folder.id);

    // Folder icon
    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    btn.appendChild(icon);

    // Folder name
    const nameSpan = document.createElement('span');
    nameSpan.textContent = folder.title;
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    btn.appendChild(nameSpan);

    // Expand arrow (if has children)
    if (hasChildren) {
      const arrow = document.createElement('span');
      arrow.className = `folder-arrow${isExpanded ? ' expanded' : ''}`;
      arrow.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFolder(folder.id);
      });
      btn.appendChild(arrow);
    }

    // Click to navigate
    btn.addEventListener('click', () => {
      navigateToFolder(folder.id);
    });

    li.appendChild(btn);

    // Render children
    if (hasChildren) {
      const childUl = createFolderTree(folder.children, depth + 1);
      childUl.className = `folder-children${isExpanded ? '' : ' collapsed'}`;
      li.appendChild(childUl);
    }

    ul.appendChild(li);
  }

  return ul;
}

function updateCollapseIcon(btn: HTMLElement, collapsed: boolean): void {
  // Left chevron when expanded, right chevron when collapsed
  if (collapsed) {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  } else {
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  }
}

function toggleFolder(folderId: string): void {
  const expanded = new Set(store.get('expandedFolders'));
  if (expanded.has(folderId)) {
    expanded.delete(folderId);
  } else {
    expanded.add(folderId);
  }
  store.set('expandedFolders', expanded);
}

function updateActiveState(): void {
  const currentId = store.get('currentFolderId');
  const buttons = navEl.querySelectorAll<HTMLElement>('.folder-label');
  for (const btn of buttons) {
    const folderId = btn.getAttribute('data-folder-id');
    btn.classList.toggle('active', folderId === currentId);
  }
}
