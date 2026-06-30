// ─── Tab Modifier Tool ───
// UI for managing tab-modification rules inside the tools panel.

import { registerTool } from '../components/tools-panel';
import {
  ICON_COLORS, ICON_SHAPES,
  generateIconSvg, generateId, loadRules, saveRules,
  matchesRule, applyTitleTemplate, normalizeIcon,
} from './tab-modifier-types';
import type { TabRule, TabRuleIcon, MatchType, IconShape } from './tab-modifier-types';

// ─── Host Permission ───
// <all_urls> is an optional permission — request it when the user first needs it.
// chrome.permissions.request() is a no-op if already granted (no dialog shown).

async function ensureHostPermission(): Promise<boolean> {
  return chrome.permissions.request({ origins: ['<all_urls>'] });
}

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
    ? `<span class="tm-rule-icon-preview">${iconPreviewHTML(rule.icon)}</span>`
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

  const iconMode: 'keep' | 'shape' | 'image' = rule.icon === null ? 'keep' : rule.icon.type;
  const initialShape: IconShape = rule.icon?.type === 'shape' ? rule.icon.shape : 'circle';
  const initialColor: string = rule.icon?.type === 'shape' ? rule.icon.color : ICON_COLORS[0].value;
  const initialImage: string | null = rule.icon?.type === 'image' ? rule.icon.dataUri : null;
  const initialImageName: string = rule.icon?.type === 'image' && rule.icon.name ? rule.icon.name : '';

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

      <div class="tm-url-tester">
        <label class="form-field">
          <span class="form-label">Test URL</span>
          <div class="tm-url-tester-input-row">
            <input type="text" class="form-input" name="testUrl" placeholder="https://localhost:3000/dashboard" autocomplete="off">
            <span class="tm-url-tester-indicator"></span>
          </div>
        </label>
        <div class="tm-url-tester-result hidden"></div>
      </div>

      <fieldset class="tm-icon-fieldset">
        <legend class="form-label">Tab Icon</legend>
        <label class="tm-radio-label">
          <input type="radio" name="iconMode" value="keep" ${iconMode === 'keep' ? 'checked' : ''}>
          <span>Keep original</span>
        </label>
        <label class="tm-radio-label">
          <input type="radio" name="iconMode" value="shape" ${iconMode === 'shape' ? 'checked' : ''}>
          <span>Shape</span>
        </label>
        <label class="tm-radio-label">
          <input type="radio" name="iconMode" value="image" ${iconMode === 'image' ? 'checked' : ''}>
          <span>Upload image</span>
        </label>

        <div class="tm-icon-picker tm-shape-panel ${iconMode === 'shape' ? '' : 'hidden'}">
          <div class="tm-picker-section">
            <span class="tm-picker-label">Shape</span>
            <div class="tm-shape-picker">
              ${ICON_SHAPES.map(shape => `
                <button type="button" class="tm-shape-btn ${initialShape === shape ? 'active' : ''}" data-shape="${shape}" title="${shape}">
                  ${generateIconSvg({ shape, color: 'currentColor' })}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="tm-picker-section">
            <span class="tm-picker-label">Color</span>
            <div class="tm-color-picker">
              <input type="color" class="tm-color-input" name="iconColor" value="${initialColor}">
              <span class="tm-color-value">${initialColor}</span>
            </div>
          </div>
          <div class="tm-icon-preview-large tm-shape-preview">${generateIconSvg({ shape: initialShape, color: initialColor })}</div>
        </div>

        <div class="tm-icon-picker tm-image-panel ${iconMode === 'image' ? '' : 'hidden'}">
          <div class="tm-picker-section">
            <span class="tm-picker-label">Image</span>
            <div class="tm-image-row">
              <div class="tm-image-preview ${initialImage ? '' : 'empty'}">
                ${initialImage ? `<img src="${escapeAttr(initialImage)}" alt="" />` : '<span class="tm-image-placeholder">No image</span>'}
              </div>
              <div class="tm-image-controls">
                <div class="tm-image-actions">
                  <button type="button" class="btn btn-secondary tm-btn-sm" data-action="upload-image">${initialImage ? 'Replace' : 'Upload image'}</button>
                  <button type="button" class="btn btn-secondary tm-btn-sm tm-image-remove ${initialImage ? '' : 'hidden'}" data-action="remove-image">Remove</button>
                </div>
                <span class="tm-image-name">${escapeHTML(initialImageName)}</span>
              </div>
            </div>
            <span class="tm-field-hint">PNG, JPG, SVG, GIF or WebP. Resized to a 64&times;64 icon.</span>
          </div>
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

  // Icon mode — reveal the matching sub-panel (or none for "keep")
  const shapePanel = form.querySelector<HTMLElement>('.tm-shape-panel')!;
  const imagePanel = form.querySelector<HTMLElement>('.tm-image-panel')!;
  form.querySelectorAll<HTMLInputElement>('[name="iconMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      shapePanel.classList.toggle('hidden', radio.value !== 'shape');
      imagePanel.classList.toggle('hidden', radio.value !== 'image');
    });
  });

  // ── Shape picker ──
  let selectedShape: IconShape = initialShape;
  let selectedColor: string = initialColor;

  form.querySelectorAll<HTMLButtonElement>('.tm-shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.tm-shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedShape = btn.dataset.shape as IconShape;
      updateIconPreview();
    });
  });

  const colorInput = form.querySelector<HTMLInputElement>('.tm-color-input')!;
  const colorValue = form.querySelector<HTMLElement>('.tm-color-value')!;
  colorInput.addEventListener('input', () => {
    selectedColor = colorInput.value;
    colorValue.textContent = selectedColor;
    updateIconPreview();
  });

  function updateIconPreview(): void {
    const preview = form.querySelector('.tm-shape-preview');
    if (preview) preview.innerHTML = generateIconSvg({ shape: selectedShape, color: selectedColor });
  }

  // ── Image upload ──
  let uploadedDataUri: string | null = initialImage;
  let uploadedName: string | undefined = initialImageName || undefined;

  function renderImagePanel(): void {
    const previewBox = form.querySelector<HTMLElement>('.tm-image-preview')!;
    const uploadBtn = form.querySelector<HTMLButtonElement>('[data-action="upload-image"]')!;
    const removeBtn = form.querySelector<HTMLButtonElement>('[data-action="remove-image"]')!;
    const nameEl = form.querySelector<HTMLElement>('.tm-image-name')!;
    if (uploadedDataUri) {
      previewBox.classList.remove('empty');
      previewBox.innerHTML = `<img src="${escapeAttr(uploadedDataUri)}" alt="" />`;
      uploadBtn.textContent = 'Replace';
      removeBtn.classList.remove('hidden');
      nameEl.textContent = uploadedName ?? '';
    } else {
      previewBox.classList.add('empty');
      previewBox.innerHTML = '<span class="tm-image-placeholder">No image</span>';
      uploadBtn.textContent = 'Upload image';
      removeBtn.classList.add('hidden');
      nameEl.textContent = '';
    }
  }

  form.querySelector('[data-action="upload-image"]')!.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        uploadedDataUri = await fileToIconDataUri(file);
        uploadedName = file.name;
        renderImagePanel();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Could not process that image.');
      }
    });
    input.click();
  });

  form.querySelector('[data-action="remove-image"]')!.addEventListener('click', () => {
    uploadedDataUri = null;
    uploadedName = undefined;
    renderImagePanel();
  });

  // URL tester — live match feedback
  const testUrlInput = form.querySelector<HTMLInputElement>('[name="testUrl"]')!;
  const testerIndicator = form.querySelector<HTMLElement>('.tm-url-tester-indicator')!;
  const testerResult = form.querySelector<HTMLElement>('.tm-url-tester-result')!;

  function updateTestResult(): void {
    const testUrl = testUrlInput.value.trim();
    if (!testUrl) {
      testerIndicator.className = 'tm-url-tester-indicator';
      testerIndicator.textContent = '';
      testerResult.classList.add('hidden');
      return;
    }

    const tempRule: TabRule = {
      id: '', enabled: true,
      name: '',
      matchType: matchTypeSelect.value as MatchType,
      matchPattern: patternInput.value.trim(),
      titleTemplate: '',
      icon: null,
    };

    const isMatch = matchesRule(testUrl, tempRule);
    testerIndicator.className = 'tm-url-tester-indicator ' + (isMatch ? 'match' : 'no-match');
    testerIndicator.textContent = isMatch ? '✓ Match' : '✗ No match';

    if (isMatch) {
      const titleInput = form.querySelector<HTMLInputElement>('[name="titleTemplate"]')!;
      const template = titleInput.value.trim() || '{title}';
      const preview = applyTitleTemplate(template, 'Page Title', testUrl);
      testerResult.textContent = `Title → ${preview}`;
      testerResult.classList.remove('hidden');
    } else {
      testerResult.classList.add('hidden');
    }
  }

  testUrlInput.addEventListener('input', updateTestResult);
  patternInput.addEventListener('input', updateTestResult);
  matchTypeSelect.addEventListener('change', updateTestResult);
  form.querySelector<HTMLInputElement>('[name="titleTemplate"]')!.addEventListener('input', updateTestResult);

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const iconMode = formData.get('iconMode');

    let icon: TabRuleIcon | null = null;
    if (iconMode === 'shape') {
      icon = { type: 'shape', shape: selectedShape, color: selectedColor };
    } else if (iconMode === 'image') {
      if (!uploadedDataUri) {
        alert('Upload an image or choose a different icon mode.');
        return;
      }
      icon = { type: 'image', dataUri: uploadedDataUri, ...(uploadedName ? { name: uploadedName } : {}) };
    }

    const updatedRule: TabRule = {
      id: rule.id,
      enabled: rule.enabled,
      name: (formData.get('name') as string).trim(),
      matchType: formData.get('matchType') as MatchType,
      matchPattern: (formData.get('matchPattern') as string).trim(),
      titleTemplate: (formData.get('titleTemplate') as string).trim(),
      icon,
    };

    if (!updatedRule.matchPattern) {
      patternInput.focus();
      return;
    }

    // Request host permission before saving (must precede any await to keep user gesture)
    await ensureHostPermission();

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
  if (rule.enabled) await ensureHostPermission();
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
        icon: normalizeIcon(r.icon),
      }));

      await ensureHostPermission();
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

// ─── Icon Image Upload ───

const MAX_ICON_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB source-file cap
const ICON_RENDER_PX = 64;                     // crisp on HiDPI, ~1–4 KB as PNG

// Read an uploaded image file and normalize it to a small square PNG data URI.
// Runs in the new-tab page (DOM context), so Image/canvas/FileReader are available.
// Done at upload time (not on submit) so the preview is instant and no async work
// sits between the submit gesture and chrome.permissions.request().
function fileToIconDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_ICON_UPLOAD_BYTES) {
      reject(new Error('Image is too large (max 2 MB). Try a smaller file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = ICON_RENDER_PX;
        canvas.height = ICON_RENDER_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas is unavailable.')); return; }

        // Contain + center on a transparent background (preserves alpha).
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (iw > 0 && ih > 0) {
          const scale = Math.min(ICON_RENDER_PX / iw, ICON_RENDER_PX / ih);
          const dw = iw * scale;
          const dh = ih * scale;
          ctx.drawImage(img, (ICON_RENDER_PX - dw) / 2, (ICON_RENDER_PX - dh) / 2, dw, dh);
        } else {
          // e.g. an SVG with no intrinsic size — fill the whole box.
          ctx.drawImage(img, 0, 0, ICON_RENDER_PX, ICON_RENDER_PX);
        }

        try {
          resolve(canvas.toDataURL('image/png'));
        } catch {
          reject(new Error('Could not process that image.'));
        }
      };
      img.onerror = () => reject(new Error('That file is not a supported image.'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Inline preview for the rule list. Shapes render as trusted inline SVG; uploaded
// images render as an <img> with an escaped data-URI src (defends against a crafted
// dataUri in an imported rule file breaking out of the attribute).
function iconPreviewHTML(icon: TabRuleIcon): string {
  if (icon.type === 'image') {
    return `<img src="${escapeAttr(icon.dataUri)}" alt="" />`;
  }
  return generateIconSvg(icon);
}

function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
