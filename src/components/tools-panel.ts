// ─── Tools Panel Component ───
// Right-side slide-out drawer housing developer tools.
// Uses native <dialog> for backdrop, focus trapping, and Escape handling.
// Tools register via ToolDescriptor and are lazy-loaded on first selection.

import { registerShortcut } from '../utils/keyboard';

// ─── Tool Registry ───

export interface ToolDescriptor {
  id: string;
  name: string;
  description?: string;
  icon: string; // SVG string (18x18 recommended)
  load: () => Promise<{
    render: (container: HTMLElement) => void;
    cleanup?: () => void;
  }>;
}

const toolRegistry: ToolDescriptor[] = [];

export function registerTool(tool: ToolDescriptor): void {
  toolRegistry.push(tool);
}

// ─── Component State ───

let dialogEl: HTMLDialogElement;
let contentEl: HTMLElement;
let backBarEl: HTMLElement;
let activeToolId: string | null = null;
let activeCleanup: (() => void) | undefined;
let isClosing = false;
const loadedTools = new Map<string, {
  render: (container: HTMLElement) => void;
  cleanup?: () => void;
}>();

// ─── SVG Icons ───

const CLOSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
</svg>`;

const BACK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
</svg>`;

// ─── Dialog Creation ───

function createDialog(): void {
  dialogEl = document.createElement('dialog');
  dialogEl.id = 'tools-panel';

  dialogEl.innerHTML = `
    <div class="tools-panel-layout">
      <div class="tools-panel-topbar">
        <button class="tools-panel-back-btn hidden" title="Back to tools">${BACK_ICON}<span>Tools</span></button>
        <button class="tools-panel-close" title="Close (Esc)">${CLOSE_ICON}</button>
      </div>
      <div class="tools-panel-content"></div>
    </div>
  `;

  document.body.appendChild(dialogEl);

  backBarEl = dialogEl.querySelector('.tools-panel-back-btn')!;
  contentEl = dialogEl.querySelector('.tools-panel-content')!;

  // Back button
  backBarEl.addEventListener('click', goBack);

  // Close button
  dialogEl.querySelector('.tools-panel-close')!
    .addEventListener('click', close);

  // Escape key — intercept cancel event so we run cleanup
  dialogEl.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });

  // Backdrop click — click on <dialog> itself (not children) = backdrop
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) close();
  });
}

// ─── Open / Close ───

function open(): void {
  if (activeToolId) {
    showToolView(activeToolId);
  } else {
    showListView();
  }
  dialogEl.showModal();
}

function close(): void {
  if (isClosing) return;
  isClosing = true;

  activeCleanup?.();
  activeCleanup = undefined;

  // Animate out, then actually close the dialog
  dialogEl.classList.add('closing');
  dialogEl.addEventListener('animationend', () => {
    dialogEl.classList.remove('closing');
    isClosing = false;
    dialogEl.close();
    document.getElementById('tools-btn')?.focus();
  }, { once: true });
}

function toggle(): void {
  if (dialogEl.open) {
    close();
  } else {
    open();
  }
}

// ─── Back Navigation ───

function goBack(): void {
  activeCleanup?.();
  activeCleanup = undefined;
  activeToolId = null;
  showListView();
}

// ─── List View (no tool selected) ───

function showListView(): void {
  backBarEl.classList.add('hidden');
  contentEl.textContent = '';

  // Header
  const header = document.createElement('div');
  header.className = 'tools-panel-list-header';
  header.innerHTML = `
    <div class="tools-panel-list-heading">Additional Tools</div>
    <div class="tools-panel-list-subtitle">Select a tool to get started.</div>
    <div class="tools-panel-list-hint">Toggle with <kbd>Ctrl</kbd> + <kbd>/</kbd></div>
  `;
  contentEl.appendChild(header);

  // Tool list
  if (toolRegistry.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tools-panel-list-empty';
    empty.textContent = 'No tools installed yet. Coming soon!';
    contentEl.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'tools-panel-tool-list';
  for (const tool of toolRegistry) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'tools-panel-tool-item';
    const desc = tool.description
      ? `<span class="tools-panel-tool-desc">${tool.description}</span>`
      : '';
    btn.innerHTML = `<span class="tools-panel-tool-icon">${tool.icon}</span><span class="tools-panel-tool-text"><span class="tools-panel-tool-name">${tool.name}</span>${desc}</span>`;
    btn.addEventListener('click', () => selectTool(tool.id));
    li.appendChild(btn);
    list.appendChild(li);
  }
  contentEl.appendChild(list);
}

// ─── Tool Selection ───

async function selectTool(id: string): Promise<void> {
  const tool = toolRegistry.find(t => t.id === id);
  if (!tool) return;

  activeToolId = id;
  await showToolView(id);
}

async function showToolView(id: string): Promise<void> {
  const tool = toolRegistry.find(t => t.id === id);
  if (!tool) return;

  // Cleanup previous tool
  activeCleanup?.();
  activeCleanup = undefined;
  contentEl.textContent = '';

  // Show back bar
  backBarEl.classList.remove('hidden');

  // Lazy-load tool module
  let loaded = loadedTools.get(id);
  if (!loaded) {
    try {
      loaded = await tool.load();
      loadedTools.set(id, loaded);
    } catch (err) {
      contentEl.innerHTML = `<div class="tools-panel-placeholder">
        <div class="tools-panel-placeholder-title">Failed to load tool</div>
        <div class="tools-panel-placeholder-hint">${err instanceof Error ? err.message : String(err)}</div>
      </div>`;
      return;
    }
  }

  loaded.render(contentEl);
  activeCleanup = loaded.cleanup;
}

// ─── Init ───

export function initToolsPanel(): void {
  // Import registered tools (barrel file)
  import('../tools/index');

  createDialog();

  // Sidebar button
  const toolsBtn = document.getElementById('tools-btn');
  toolsBtn?.addEventListener('click', toggle);

  // Keyboard shortcut: Ctrl+/
  registerShortcut({
    key: '/',
    ctrl: true,
    handler: toggle,
  });
}
