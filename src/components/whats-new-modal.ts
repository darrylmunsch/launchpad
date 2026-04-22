// ─── What's New Modal ───
// Lazy-created <dialog> that renders the bundled CHANGELOG. Open it via
// the custom 'open-whats-new' event or the `openWhatsNewModal` export.
// Marks lastSeenWhatsNewVersion on close so future auto-show logic has
// accurate state.

import type { ChangeType, ChangelogEntry, ChangelogVersion } from '../changelog';
import { CHANGELOG, hasUnseenChanges, latestChangelogVersion } from '../changelog';
import { updateSetting } from '../settings';
import { store } from '../state';

let dialogEl: HTMLDialogElement | null = null;
let bodyEl: HTMLElement;

export function initWhatsNewModal(): void {
  document.addEventListener('open-whats-new', () => openWhatsNewModal());

  // Reactively reflect unseen-changes state on the sidebar cog and About tab.
  // Fires whenever settings change (including when handleClose updates
  // lastSeenWhatsNewVersion), so the dot clears itself.
  store.subscribe('settings', updateUnseenIndicators);
  updateUnseenIndicators();
}

function updateUnseenIndicators(): void {
  const seen = store.get('settings').lastSeenWhatsNewVersion;
  const hasUnseen = hasUnseenChanges(seen);

  const sidebarBtn = document.getElementById('settings-btn');
  sidebarBtn?.classList.toggle('has-unseen-whats-new', hasUnseen);

  const aboutTab = document.querySelector<HTMLElement>('.settings-tab[data-tab="about"]');
  aboutTab?.classList.toggle('has-unseen-whats-new', hasUnseen);

  // Only present when About tab is rendered; safe no-op otherwise.
  const whatsNewBtn = document.getElementById('settings-whats-new');
  whatsNewBtn?.classList.toggle('has-unseen-whats-new', hasUnseen);
}

export function openWhatsNewModal(): void {
  ensureDialog();
  render();
  dialogEl!.showModal();
}

function ensureDialog(): void {
  if (dialogEl) return;

  dialogEl = document.createElement('dialog');
  dialogEl.className = 'modal whats-new-modal';
  dialogEl.innerHTML = `
    <div class="whats-new-layout">
      <header class="whats-new-header">
        <h2 class="modal-title">What's New</h2>
        <button class="modal-close" data-role="close" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>
      <div class="whats-new-body" data-role="body"></div>
      <footer class="whats-new-footer">
        <button type="button" class="btn btn-primary" data-role="acknowledge">Got it</button>
      </footer>
    </div>
  `;
  document.body.appendChild(dialogEl);

  bodyEl = dialogEl.querySelector('[data-role="body"]')!;

  const closeBtn = dialogEl.querySelector('[data-role="close"]') as HTMLButtonElement;
  const ackBtn = dialogEl.querySelector('[data-role="acknowledge"]') as HTMLButtonElement;
  closeBtn.addEventListener('click', handleClose);
  ackBtn.addEventListener('click', handleClose);

  // Escape / backdrop click
  dialogEl.addEventListener('cancel', (e) => {
    e.preventDefault();
    handleClose();
  });
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) handleClose();
  });
}

function handleClose(): void {
  dialogEl?.close();
  // Record acknowledgment against the changelog's latest version (not the
  // manifest) so the ack state always matches the "latest" used by
  // hasUnseenChanges. Robust to manifest/changelog version drift.
  updateSetting('lastSeenWhatsNewVersion', latestChangelogVersion());
}

function render(): void {
  if (CHANGELOG.length === 0) {
    bodyEl.innerHTML = `<p class="whats-new-empty">No release notes yet.</p>`;
    return;
  }

  bodyEl.innerHTML = CHANGELOG.map(renderVersion).join('');
}

function renderVersion(version: ChangelogVersion): string {
  const entriesByType = groupByType(version.entries);
  const sections: string[] = [];

  if (entriesByType.new.length) sections.push(renderGroup('New', 'new', entriesByType.new));
  if (entriesByType.improved.length) sections.push(renderGroup('Improved', 'improved', entriesByType.improved));
  if (entriesByType.fixed.length) sections.push(renderGroup('Fixed', 'fixed', entriesByType.fixed));

  return `
    <section class="whats-new-version">
      <div class="whats-new-version-head">
        <span class="whats-new-version-number">v${escapeHtml(version.version)}</span>
        <span class="whats-new-version-date">${escapeHtml(formatDate(version.date))}</span>
      </div>
      ${sections.join('')}
    </section>
  `;
}

function renderGroup(title: string, type: ChangeType, entries: ChangelogEntry[]): string {
  const items = entries
    .map(e => `<li class="whats-new-item">${escapeHtml(e.text)}</li>`)
    .join('');
  return `
    <div class="whats-new-group">
      <span class="whats-new-badge whats-new-badge-${type}">${title}</span>
      <ul class="whats-new-list">${items}</ul>
    </div>
  `;
}

function groupByType(entries: ChangelogEntry[]): Record<ChangeType, ChangelogEntry[]> {
  const groups: Record<ChangeType, ChangelogEntry[]> = { new: [], improved: [], fixed: [] };
  for (const entry of entries) groups[entry.type].push(entry);
  return groups;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
