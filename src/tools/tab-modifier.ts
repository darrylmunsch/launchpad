// ─── Tab Modifier Tool ───
// UI for managing tab-modification rules inside the tools panel.

import { registerTool } from '../components/tools-panel';
import {
  ICON_COLORS, ICON_SHAPES,
  generateIconSvg, generateId, loadRules, saveRules,
} from './tab-modifier-types';
import type { TabRule, TabRuleIcon, MatchType, IconShape } from './tab-modifier-types';

// ─── State ───

let container: HTMLElement;
let rules: TabRule[] = [];
let editingRuleId: string | null = null;

// ─── Registration ───

registerTool({
  id: 'tab-modifier',
  name: 'Tab Modifier',
  description: 'Customize tab titles and icons with pattern-based rules.',
  icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 7h16M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M4 7l2-3h12l2 3"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
  </svg>`,
  load: async () => ({ render, cleanup }),
});

// ─── Render ───

async function render(el: HTMLElement): Promise<void> {
  container = el;
  rules = await loadRules();
  renderList();
}

function cleanup(): void {
  editingRuleId = null;
}

// ─── List View ───

function renderList(): void {
  const hasRules = rules.length > 0;

  container.innerHTML = `
    <div class="tm-header">
      <h3 class="tm-title">Tab Modifier</h3>
      <div class="tm-header-actions">
        <button class="btn btn-secondary tm-btn-sm" data-action="import" title="Import rules from JSON">Import</button>
        <button class="btn btn-secondary tm-btn-sm" data-action="export" title="Export rules as JSON" ${hasRules ? '' : 'disabled'}>Export</button>
        <button class="btn btn-primary tm-btn-sm" data-action="add">+ Add Rule</button>
      </div>
    </div>
    ${hasRules
      ? `<ul class="tm-rule-list">${rules.map(ruleCardHTML).join('')}</ul>`
      : `<div class="tm-empty">
          <p class="tm-empty-title">No rules yet</p>
          <p class="tm-empty-hint">Add a rule to rename tabs or change their icons based on URL patterns.</p>
        </div>`
    }
  `;

  // Header action buttons
  container.querySelector('[data-action="add"]')!.addEventListener('click', () => {
    editingRuleId = null;
    renderForm(createDefaultRule());
  });
  container.querySelector('[data-action="import"]')!.addEventListener('click', handleImport);
  container.querySelector('[data-action="export"]')!.addEventListener('click', handleExport);

  // Per-rule event delegation
  container.querySelectorAll<HTMLElement>('.tm-rule-card').forEach(card => {
    const id = card.dataset.ruleId!;
    card.querySelector('[data-action="toggle"]')?.addEventListener('click', () => toggleRule(id));
    card.querySelector('[data-action="edit"]')?.addEventListener('click', () => editRule(id));
    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteRule(id));
  });
}

function ruleCardHTML(rule: TabRule): string {
  const iconPreview = rule.icon
    ? `<span class="tm-rule-icon-preview">${generateIconSvg(rule.icon)}</span>`
    : '';
  const matchLabel = rule.matchType.replace('_', ' ');

  return `
    <li class="tm-rule-card ${rule.enabled ? '' : 'disabled'}" data-rule-id="${rule.id}">
      <div class="tm-rule-card-main">
        <button class="tm-toggle ${rule.enabled ? 'on' : ''}" data-action="toggle" title="${rule.enabled ? 'Disable' : 'Enable'}">
          <span class="tm-toggle-track"><span class="tm-toggle-thumb"></span></span>
        </button>
        <div class="tm-rule-info">
          <div class="tm-rule-name">${iconPreview}${escapeHTML(rule.name || 'Untitled rule')}</div>
          <div class="tm-rule-detail">
            <span class="tm-rule-match-type">${matchLabel}</span>
            <code class="tm-rule-pattern">${escapeHTML(rule.matchPattern)}</code>
            ${rule.titleTemplate ? `<span class="tm-rule-arrow">&rarr;</span> <code class="tm-rule-pattern">${escapeHTML(rule.titleTemplate)}</code>` : ''}
          </div>
        </div>
        <div class="tm-rule-actions">
          <button class="tm-icon-btn" data-action="edit" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="tm-icon-btn tm-icon-btn-danger" data-action="delete" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </li>
  `;
}

// ─── Form View ───

function renderForm(rule: TabRule): void {
  const isEditing = editingRuleId !== null;

  container.innerHTML = `
    <div class="tm-header">
      <button class="tm-back-btn" data-action="back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h3 class="tm-title">${isEditing ? 'Edit Rule' : 'Add Rule'}</h3>
    </div>
    <form class="tm-form" autocomplete="off">
      <label class="form-field">
        <span class="form-label">Rule Name</span>
        <input type="text" class="form-input" name="name" value="${escapeAttr(rule.name)}" placeholder="e.g. MyApp Local">
      </label>

      <div class="tm-form-row">
        <label class="form-field tm-form-match-type">
          <span class="form-label">Match Type</span>
          <select class="form-select" name="matchType">
            <option value="contains" ${rule.matchType === 'contains' ? 'selected' : ''}>Contains</option>
            <option value="exact" ${rule.matchType === 'exact' ? 'selected' : ''}>Exact</option>
            <option value="starts_with" ${rule.matchType === 'starts_with' ? 'selected' : ''}>Starts with</option>
            <option value="domain" ${rule.matchType === 'domain' ? 'selected' : ''}>Domain</option>
            <option value="regex" ${rule.matchType === 'regex' ? 'selected' : ''}>Regex</option>
          </select>
        </label>
        <label class="form-field" style="flex:1">
          <span class="form-label">Pattern</span>
          <input type="text" class="form-input" name="matchPattern" value="${escapeAttr(rule.matchPattern)}" placeholder="${getPatternPlaceholder(rule.matchType)}">
        </label>
      </div>

      <label class="form-field">
        <span class="form-label">Title Template</span>
        <input type="text" class="form-input" name="titleTemplate" value="${escapeAttr(rule.titleTemplate)}" placeholder="{title} [LOCAL]">
        <span class="tm-field-hint">Variables: <code>{title}</code> <code>{domain}</code> <code>{url}</code></span>
      </label>

      <fieldset class="tm-icon-fieldset">
        <legend class="form-label">Tab Icon</legend>
        <label class="tm-radio-label">
          <input type="radio" name="iconMode" value="keep" ${rule.icon === null ? 'checked' : ''}>
          <span>Keep original</span>
        </label>
        <label class="tm-radio-label">
          <input type="radio" name="iconMode" value="custom" ${rule.icon !== null ? 'checked' : ''}>
          <span>Custom icon</span>
        </label>
        <div class="tm-icon-picker ${rule.icon === null ? 'hidden' : ''}">
          <div class="tm-picker-section">
            <span class="tm-picker-label">Shape</span>
            <div class="tm-shape-picker">
              ${ICON_SHAPES.map(shape => `
                <button type="button" class="tm-shape-btn ${rule.icon?.shape === shape ? 'active' : ''}" data-shape="${shape}" title="${shape}">
                  ${generateIconSvg({ shape, color: 'currentColor' })}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="tm-picker-section">
            <span class="tm-picker-label">Color</span>
            <div class="tm-color-picker">
              <input type="color" class="tm-color-input" name="iconColor" value="${rule.icon?.color ?? ICON_COLORS[0].value}">
              <span class="tm-color-value">${rule.icon?.color ?? ICON_COLORS[0].value}</span>
            </div>
          </div>
          ${rule.icon ? `<div class="tm-icon-preview-large">${generateIconSvg(rule.icon)}</div>` : ''}
        </div>
      </fieldset>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `;

  const form = container.querySelector<HTMLFormElement>('.tm-form')!;
  const matchTypeSelect = form.querySelector<HTMLSelectElement>('[name="matchType"]')!;
  const patternInput = form.querySelector<HTMLInputElement>('[name="matchPattern"]')!;

  // Back / Cancel
  container.querySelector('[data-action="back"]')!.addEventListener('click', () => renderList());
  container.querySelector('[data-action="cancel"]')!.addEventListener('click', () => renderList());

  // Update placeholder when match type changes
  matchTypeSelect.addEventListener('change', () => {
    patternInput.placeholder = getPatternPlaceholder(matchTypeSelect.value as MatchType);
  });

  // Icon mode radio toggle
  form.querySelectorAll<HTMLInputElement>('[name="iconMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const picker = container.querySelector('.tm-icon-picker')!;
      picker.classList.toggle('hidden', radio.value === 'keep' && radio.checked);
    });
  });

  // Shape picker
  let selectedShape: IconShape = rule.icon?.shape ?? 'circle';
  let selectedColor: string = rule.icon?.color ?? ICON_COLORS[0].value;

  form.querySelectorAll<HTMLButtonElement>('.tm-shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.tm-shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedShape = btn.dataset.shape as IconShape;
      updateIconPreview();
    });
  });

  // Color picker
  const colorInput = form.querySelector<HTMLInputElement>('.tm-color-input')!;
  const colorValue = form.querySelector<HTMLElement>('.tm-color-value')!;
  colorInput.addEventListener('input', () => {
    selectedColor = colorInput.value;
    colorValue.textContent = selectedColor;
    updateIconPreview();
  });

  function updateIconPreview(): void {
    let preview = form.querySelector('.tm-icon-preview-large');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'tm-icon-preview-large';
      container.querySelector('.tm-icon-picker')!.appendChild(preview);
    }
    preview.innerHTML = generateIconSvg({ shape: selectedShape, color: selectedColor });
  }

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const useCustomIcon = formData.get('iconMode') === 'custom';

    const updatedRule: TabRule = {
      id: rule.id,
      enabled: rule.enabled,
      name: (formData.get('name') as string).trim(),
      matchType: formData.get('matchType') as MatchType,
      matchPattern: (formData.get('matchPattern') as string).trim(),
      titleTemplate: (formData.get('titleTemplate') as string).trim(),
      icon: useCustomIcon ? { shape: selectedShape, color: selectedColor } : null,
    };

    if (!updatedRule.matchPattern) {
      patternInput.focus();
      return;
    }

    if (isEditing) {
      const idx = rules.findIndex(r => r.id === rule.id);
      if (idx !== -1) rules[idx] = updatedRule;
    } else {
      rules.push(updatedRule);
    }

    await saveRules(rules);
    editingRuleId = null;
    renderList();
  });
}

// ─── Rule Actions ───

async function toggleRule(id: string): Promise<void> {
  const rule = rules.find(r => r.id === id);
  if (!rule) return;
  rule.enabled = !rule.enabled;
  await saveRules(rules);
  renderList();
}

function editRule(id: string): void {
  const rule = rules.find(r => r.id === id);
  if (!rule) return;
  editingRuleId = id;
  renderForm({ ...rule });
}

async function deleteRule(id: string): Promise<void> {
  rules = rules.filter(r => r.id !== id);
  await saveRules(rules);
  renderList();
}

// ─── Import / Export ───

function handleExport(): void {
  const json = JSON.stringify(rules, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tab-modifier-rules.json';
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (!Array.isArray(imported)) {
        alert('Invalid format: expected an array of rules.');
        return;
      }

      // Validate and assign new IDs to avoid collisions
      const newRules: TabRule[] = imported.map((r: any) => ({
        id: generateId(),
        enabled: r.enabled !== false,
        name: String(r.name ?? ''),
        matchType: validateMatchType(r.matchType) ? r.matchType : 'contains',
        matchPattern: String(r.matchPattern ?? ''),
        titleTemplate: String(r.titleTemplate ?? ''),
        icon: r.icon && r.icon.shape && r.icon.color
          ? { shape: r.icon.shape as IconShape, color: String(r.icon.color) }
          : null,
      }));

      rules = [...rules, ...newRules];
      await saveRules(rules);
      renderList();
    } catch {
      alert('Failed to parse JSON file.');
    }
  });
  input.click();
}

// ─── Helpers ───

function createDefaultRule(): TabRule {
  return {
    id: generateId(),
    enabled: true,
    name: '',
    matchType: 'contains',
    matchPattern: '',
    titleTemplate: '{title} [LOCAL]',
    icon: null,
  };
}

function getPatternPlaceholder(matchType: MatchType): string {
  switch (matchType) {
    case 'contains':    return 'localhost:3000';
    case 'exact':       return 'http://localhost:3000/';
    case 'starts_with': return 'http://localhost';
    case 'domain':      return 'dev.myapp.com';
    case 'regex':       return 'localhost:\\d+';
  }
}

function validateMatchType(v: unknown): v is MatchType {
  return typeof v === 'string' && ['contains', 'exact', 'starts_with', 'domain', 'regex'].includes(v);
}

function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
