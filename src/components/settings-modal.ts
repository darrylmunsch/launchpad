// ─── Settings Modal Component ───
// Tabbed settings dialog using native <dialog>.

import type { Theme, ViewMode, LayoutMode } from '../types';
import { store } from '../state';
import { updateSetting } from '../settings';
import { $ } from '../utils/dom';

let dialogEl: HTMLDialogElement;
let contentEl: HTMLElement;
let activeTab = 'general';

export function initSettingsModal(): void {
  dialogEl = document.getElementById('settings-modal') as HTMLDialogElement;
  contentEl = document.getElementById('settings-content') as HTMLElement;

  // Open button
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn?.addEventListener('click', () => {
    dialogEl.showModal();
    renderTab(activeTab);
  });

  // Close button
  const closeBtn = document.getElementById('settings-close');
  closeBtn?.addEventListener('click', () => dialogEl.close());

  // Tab navigation
  dialogEl.querySelectorAll<HTMLButtonElement>('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.getAttribute('data-tab') || 'general';
      // Update active tab visual
      dialogEl.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderTab(activeTab);
    });
  });
}

function renderTab(tab: string): void {
  switch (tab) {
    case 'general':
      renderGeneralTab();
      break;
    case 'appearance':
      renderAppearanceTab();
      break;
    case 'about':
      renderAboutTab();
      break;
  }
}

function renderGeneralTab(): void {
  const settings = store.get('settings');
  contentEl.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-section-title">Search</h3>
      <div class="settings-row">
        <label class="settings-row-label" for="settings-default-sort">Default sort order</label>
        <select class="sort-select" id="settings-default-sort">
          <option value="manual"${settings.sortMode === 'manual' ? ' selected' : ''}>Manual</option>
          <option value="alpha"${settings.sortMode === 'alpha' ? ' selected' : ''}>Alphabetical</option>
          <option value="dateAdded"${settings.sortMode === 'dateAdded' ? ' selected' : ''}>Date Added</option>
          <option value="url"${settings.sortMode === 'url' ? ' selected' : ''}>By URL</option>
        </select>
      </div>
    </div>
    <div class="settings-section">
      <h3 class="settings-section-title">Bookmarks</h3>
      <div class="settings-row">
        <span class="settings-row-label">Open bookmarks in new tab</span>
        <label class="toggle-switch">
          <input type="checkbox" id="settings-open-new-tab" ${settings.openInNewTab ? 'checked' : ''}>
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
    </div>
    <div class="settings-section">
      <h3 class="settings-section-title">Notifications</h3>
      <div class="settings-row">
        <span class="settings-row-label">Toast notifications</span>
        <label class="toggle-switch">
          <input type="checkbox" id="settings-toasts" ${settings.toastsEnabled ? 'checked' : ''}>
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
    </div>
  `;

  const sortSelect = document.getElementById('settings-default-sort') as HTMLSelectElement;
  sortSelect?.addEventListener('change', () => {
    updateSetting('sortMode', sortSelect.value as import('../types').SortMode);
  });

  const openNewTabToggle = document.getElementById('settings-open-new-tab') as HTMLInputElement;
  openNewTabToggle?.addEventListener('change', () => {
    updateSetting('openInNewTab', openNewTabToggle.checked);
  });

  const toastsToggle = document.getElementById('settings-toasts') as HTMLInputElement;
  toastsToggle?.addEventListener('change', () => {
    updateSetting('toastsEnabled', toastsToggle.checked);
  });
}

function renderAppearanceTab(): void {
  const settings = store.get('settings');
  contentEl.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-section-title">View</h3>
      <div class="option-cards">
        <button class="option-card${settings.viewMode === 'card' ? ' active' : ''}" data-set-view="card">
          <div class="option-card-preview">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span>Card</span>
        </button>
        <button class="option-card${settings.viewMode === 'compact' ? ' active' : ''}" data-set-view="compact">
          <div class="option-card-preview">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </div>
          <span>Compact</span>
        </button>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-section-title">Font Size</h3>
      <div class="settings-row">
        <span class="settings-row-label">${settings.fontSize}px</span>
        <input type="range" min="12" max="20" step="1" value="${settings.fontSize}" id="settings-font-size" style="width: 160px; accent-color: var(--color-accent);">
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-row">
        <span class="settings-row-label">Disable animations</span>
        <label class="toggle-switch">
          <input type="checkbox" id="settings-animations" ${!settings.animationsEnabled ? 'checked' : ''}>
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-section-title">Theme</h3>
      <div class="option-cards">
        <button class="option-card${settings.theme === 'system' ? ' active' : ''}" data-set-theme="system">
          <div class="option-card-preview" style="background: linear-gradient(135deg, #f8f9fa 50%, #1f2128 50%);">
          </div>
          <span>System</span>
        </button>
        <button class="option-card${settings.theme === 'light' ? ' active' : ''}" data-set-theme="light">
          <div class="option-card-preview" style="background: #f8f9fa;">
          </div>
          <span>Light</span>
        </button>
        <button class="option-card${settings.theme === 'dark' ? ' active' : ''}" data-set-theme="dark">
          <div class="option-card-preview" style="background: #1f2128;">
          </div>
          <span>Dark</span>
        </button>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-section-title">Layout</h3>
      <div class="option-cards">
        <button class="option-card${settings.layoutMode === 'row' ? ' active' : ''}" data-set-layout="row">
          <div class="option-card-preview">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/>
              <rect x="3" y="17" width="18" height="4" rx="1"/>
            </svg>
          </div>
          <span>Row</span>
        </button>
        <button class="option-card${settings.layoutMode === 'column' ? ' active' : ''}" data-set-layout="column">
          <div class="option-card-preview">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/>
              <rect x="17" y="3" width="4" height="18" rx="1"/>
            </svg>
          </div>
          <span>Column</span>
        </button>
      </div>
    </div>
  `;

  // Wire up view mode
  contentEl.querySelectorAll<HTMLButtonElement>('[data-set-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('viewMode', btn.getAttribute('data-set-view') as ViewMode);
      renderAppearanceTab(); // re-render to update active state
    });
  });

  // Wire up theme
  contentEl.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('theme', btn.getAttribute('data-set-theme') as Theme);
      renderAppearanceTab();
    });
  });

  // Wire up layout
  contentEl.querySelectorAll<HTMLButtonElement>('[data-set-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('layoutMode', btn.getAttribute('data-set-layout') as LayoutMode);
      renderAppearanceTab();
    });
  });

  // Wire up font size
  const fontSlider = document.getElementById('settings-font-size') as HTMLInputElement;
  fontSlider?.addEventListener('input', () => {
    updateSetting('fontSize', parseInt(fontSlider.value));
    const label = fontSlider.closest('.settings-row')?.querySelector('.settings-row-label');
    if (label) label.textContent = `${fontSlider.value}px`;
  });

  // Wire up animations toggle
  const animToggle = document.getElementById('settings-animations') as HTMLInputElement;
  animToggle?.addEventListener('change', () => {
    updateSetting('animationsEnabled', !animToggle.checked);
  });
}

function renderAboutTab(): void {
  contentEl.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-section-title">Launchpad</h3>
      <p style="color: var(--color-text-secondary); font-size: 0.9rem; line-height: 1.6;">
        A fast, developer-focused new tab dashboard.<br>
        Version 1.0.0
      </p>
    </div>
    <div class="settings-section">
      <h3 class="settings-section-title">Keyboard Shortcuts</h3>
      <div class="settings-row">
        <span class="settings-row-label">Search bookmarks</span>
        <span style="font-size: 0.8rem; color: var(--color-text-tertiary);">Ctrl + F</span>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Close modal / menu</span>
        <span style="font-size: 0.8rem; color: var(--color-text-tertiary);">Escape</span>
      </div>
    </div>
  `;
}
