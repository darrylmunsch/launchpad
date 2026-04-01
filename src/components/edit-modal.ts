// ─── Edit/Create Bookmark Modal ───
// Uses native <dialog> for the bookmark form.
// Supports modes: 'edit', 'create', 'create-folder', 'edit-folder'.

import { store } from '../state';
import { flattenFolders } from '../bookmarks';
import { $ } from '../utils/dom';
import { showToast } from './toast';

const FOLDER_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const CHEVRON_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

let dialogEl: HTMLDialogElement;
let formEl: HTMLFormElement;
let modalTitle: HTMLElement;
let titleInput: HTMLInputElement;
let urlInput: HTMLInputElement;
let cancelBtn: HTMLButtonElement;
let submitBtn: HTMLButtonElement;
let urlField: HTMLElement;

// Custom folder picker
let pickerEl: HTMLElement;
let pickerTrigger: HTMLButtonElement;
let pickerLabel: HTMLElement;
let pickerDropdown: HTMLElement;
let selectedFolderId = '1';
let pickerOpen = false;

let currentBookmarkId: string | null = null;
let currentFolderEditId: string | null = null;
let mode: 'edit' | 'create' | 'create-folder' | 'edit-folder' = 'edit';

export function initEditModal(): void {
  dialogEl = document.getElementById('edit-modal') as HTMLDialogElement;
  formEl = document.getElementById('edit-form') as HTMLFormElement;
  modalTitle = formEl.querySelector('.modal-title') as HTMLElement;
  titleInput = document.getElementById('edit-title') as HTMLInputElement;
  urlInput = document.getElementById('edit-url') as HTMLInputElement;
  cancelBtn = document.getElementById('edit-cancel') as HTMLButtonElement;
  submitBtn = formEl.querySelector('.btn-primary') as HTMLButtonElement;
  urlField = urlInput.closest('.form-field') as HTMLElement;

  // Replace native <select> with custom folder picker
  const nativeSelect = document.getElementById('edit-folder') as HTMLSelectElement;
  const folderField = nativeSelect.closest('.form-field') as HTMLElement;
  nativeSelect.remove();
  initFolderPicker(folderField);

  // Listen for edit-bookmark events from context menu
  document.addEventListener('edit-bookmark', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.id) openEdit(detail.id);
  });

  // Listen for create-bookmark events (optionally scoped to a folder)
  document.addEventListener('create-bookmark', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    openCreate(detail?.parentId);
  });

  // Listen for create-folder events (optionally scoped to a folder)
  document.addEventListener('create-folder', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    openCreateFolder(detail?.parentId);
  });

  // Listen for edit-folder (rename) events
  document.addEventListener('edit-folder', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.id) openEditFolder(detail.id);
  });

  cancelBtn.addEventListener('click', () => {
    dialogEl.close();
  });

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (mode === 'edit') {
      await saveBookmark();
    } else if (mode === 'edit-folder') {
      await saveFolder();
    } else if (mode === 'create-folder') {
      await createFolder();
    } else {
      await createBookmark();
    }
    dialogEl.close();
  });
}

// ─── Custom Folder Picker ───

function initFolderPicker(container: HTMLElement): void {
  pickerEl = document.createElement('div');
  pickerEl.className = 'folder-picker';

  pickerTrigger = document.createElement('button');
  pickerTrigger.type = 'button';
  pickerTrigger.className = 'folder-picker-trigger';
  pickerTrigger.innerHTML = `
    ${FOLDER_ICON}
    <span class="folder-picker-label">Select folder</span>
    <span class="folder-picker-chevron">${CHEVRON_ICON}</span>
  `;
  pickerLabel = pickerTrigger.querySelector('.folder-picker-label')!;

  pickerDropdown = document.createElement('div');
  pickerDropdown.className = 'folder-picker-dropdown';

  pickerEl.appendChild(pickerTrigger);
  pickerEl.appendChild(pickerDropdown);
  container.appendChild(pickerEl);

  // Toggle dropdown on trigger click
  pickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pickerOpen) closePicker(); else openPickerDropdown();
  });

  // Close on click outside (within dialog)
  dialogEl.addEventListener('click', (e) => {
    if (pickerOpen && !pickerEl.contains(e.target as Node)) {
      closePicker();
    }
  });

  // Close on Escape
  pickerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pickerOpen) {
      e.stopPropagation();
      closePicker();
      pickerTrigger.focus();
    }
  });
}

function openPickerDropdown(): void {
  pickerOpen = true;
  pickerEl.classList.add('open');
  // Scroll selected option into view
  const active = pickerDropdown.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function closePicker(): void {
  pickerOpen = false;
  pickerEl.classList.remove('open');
}

function selectFolder(id: string, title: string): void {
  selectedFolderId = id;
  pickerLabel.textContent = title;

  // Update active state
  pickerDropdown.querySelectorAll('.folder-picker-option').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-folder-id') === id);
  });

  closePicker();
}

function populateFolderDropdown(currentParentId: string): void {
  selectedFolderId = currentParentId;
  pickerDropdown.innerHTML = '';

  const folders = store.get('folders');
  const flat = flattenFolders(folders);
  let selectedTitle = 'Select folder';

  for (const folder of flat) {
    const option = document.createElement('div');
    option.className = 'folder-picker-option';
    if (folder.id === currentParentId) {
      option.classList.add('active');
      selectedTitle = folder.title;
    }
    option.setAttribute('data-folder-id', folder.id);
    option.style.paddingLeft = `${12 + folder.depth * 20}px`;
    option.innerHTML = `${FOLDER_ICON}<span>${escapeHtml(folder.title)}</span>`;

    option.addEventListener('click', (e) => {
      e.stopPropagation();
      selectFolder(folder.id, folder.title);
    });

    pickerDropdown.appendChild(option);
  }

  pickerLabel.textContent = selectedTitle;
}

// ─── Modal Modes ───

function showUrlField(visible: boolean): void {
  urlField.style.display = visible ? '' : 'none';
  urlInput.required = visible;
}

async function openEdit(bookmarkId: string): Promise<void> {
  mode = 'edit';
  currentBookmarkId = bookmarkId;
  currentFolderEditId = null;
  modalTitle.textContent = 'Edit Bookmark';
  submitBtn.textContent = 'Save';
  showUrlField(true);

  const nodes = await chrome.bookmarks.get(bookmarkId);
  if (nodes.length === 0) return;
  const bookmark = nodes[0];

  titleInput.value = bookmark.title;
  urlInput.value = bookmark.url || '';
  populateFolderDropdown(bookmark.parentId || '1');

  dialogEl.showModal();
  titleInput.focus();
}

function openCreate(parentId?: string): void {
  mode = 'create';
  currentBookmarkId = null;
  currentFolderEditId = null;
  modalTitle.textContent = 'New Bookmark';
  submitBtn.textContent = 'Create';
  showUrlField(true);

  titleInput.value = '';
  urlInput.value = '';
  populateFolderDropdown(parentId || store.get('currentFolderId'));

  dialogEl.showModal();
  titleInput.focus();
}

function openCreateFolder(parentId?: string): void {
  mode = 'create-folder';
  currentBookmarkId = null;
  currentFolderEditId = null;
  modalTitle.textContent = 'New Folder';
  submitBtn.textContent = 'Create';
  showUrlField(false);

  titleInput.value = '';
  urlInput.value = '';
  populateFolderDropdown(parentId || store.get('currentFolderId'));

  dialogEl.showModal();
  titleInput.focus();
}

async function openEditFolder(folderId: string): Promise<void> {
  mode = 'edit-folder';
  currentBookmarkId = null;
  currentFolderEditId = folderId;
  modalTitle.textContent = 'Rename Folder';
  submitBtn.textContent = 'Save';
  showUrlField(false);

  const nodes = await chrome.bookmarks.get(folderId);
  if (nodes.length === 0) return;
  const folder = nodes[0];

  titleInput.value = folder.title;
  urlInput.value = '';
  populateFolderDropdown(folder.parentId || '1');

  dialogEl.showModal();
  titleInput.focus();
}

// ─── CRUD Operations ───

async function saveBookmark(): Promise<void> {
  if (!currentBookmarkId) return;

  const newTitle = titleInput.value.trim();
  const newUrl = urlInput.value.trim();

  await chrome.bookmarks.update(currentBookmarkId, {
    title: newTitle,
    url: newUrl,
  });

  // Move to new folder if changed
  const nodes = await chrome.bookmarks.get(currentBookmarkId);
  if (nodes.length > 0 && nodes[0].parentId !== selectedFolderId) {
    await chrome.bookmarks.move(currentBookmarkId, { parentId: selectedFolderId });
  }

  currentBookmarkId = null;
}

async function createBookmark(): Promise<void> {
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();

  if (!title || !url) return;

  await chrome.bookmarks.create({ parentId: selectedFolderId, title, url });
  showToast({ message: 'Bookmark added' });
}

async function createFolder(): Promise<void> {
  const title = titleInput.value.trim();

  if (!title) return;

  await chrome.bookmarks.create({ parentId: selectedFolderId, title });
  showToast({ message: 'Folder added' });
}

async function saveFolder(): Promise<void> {
  if (!currentFolderEditId) return;

  const newTitle = titleInput.value.trim();

  if (!newTitle) return;

  await chrome.bookmarks.update(currentFolderEditId, { title: newTitle });

  // Move to new parent if changed
  const nodes = await chrome.bookmarks.get(currentFolderEditId);
  if (nodes.length > 0 && nodes[0].parentId !== selectedFolderId) {
    await chrome.bookmarks.move(currentFolderEditId, { parentId: selectedFolderId });
  }

  currentFolderEditId = null;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
