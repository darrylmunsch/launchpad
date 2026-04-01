// ─── Tab Modifier — Shared Types & Logic ───
// Used by both the tools-panel UI and the service worker.

export const TAB_RULES_KEY = 'tabModifierRules';

// ─── Types ───

export type MatchType = 'contains' | 'exact' | 'starts_with' | 'domain' | 'regex';

export type IconShape = 'circle' | 'square' | 'diamond' | 'triangle';

export interface TabRuleIcon {
  shape: IconShape;
  color: string;
}

export interface TabRule {
  id: string;
  enabled: boolean;
  name: string;
  matchType: MatchType;
  matchPattern: string;
  titleTemplate: string;   // e.g. "{title} [LOCAL]" — supports {title}, {domain}, {url}
  icon: TabRuleIcon | null; // null = keep original favicon
}

// ─── Preset Palette ───

export const ICON_COLORS = [
  { name: 'Red',    value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green',  value: '#22c55e' },
  { name: 'Cyan',   value: '#06b6d4' },
  { name: 'Blue',   value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink',   value: '#ec4899' },
] as const;

export const ICON_SHAPES: IconShape[] = ['circle', 'square', 'diamond', 'triangle'];

// ─── URL Matching ───

export function matchesRule(url: string, rule: TabRule): boolean {
  if (!rule.enabled || !rule.matchPattern) return false;

  try {
    switch (rule.matchType) {
      case 'contains':
        return url.toLowerCase().includes(rule.matchPattern.toLowerCase());
      case 'exact':
        return url === rule.matchPattern;
      case 'starts_with':
        return url.toLowerCase().startsWith(rule.matchPattern.toLowerCase());
      case 'domain': {
        const hostname = new URL(url).hostname;
        return hostname === rule.matchPattern || hostname.endsWith('.' + rule.matchPattern);
      }
      case 'regex':
        return new RegExp(rule.matchPattern).test(url);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// ─── Title Template ───

export function applyTitleTemplate(template: string, originalTitle: string, url: string): string {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { /* ignore */ }

  return template
    .replace(/\{title\}/g, originalTitle)
    .replace(/\{domain\}/g, hostname)
    .replace(/\{url\}/g, url);
}

// ─── Icon Generation ───

const SHAPE_SVG: Record<IconShape, (color: string) => string> = {
  circle:   (c) => `<circle cx="8" cy="8" r="7" fill="${c}"/>`,
  square:   (c) => `<rect x="1" y="1" width="14" height="14" rx="2" fill="${c}"/>`,
  diamond:  (c) => `<rect x="2.3" y="2.3" width="8" height="8" rx="1" fill="${c}" transform="rotate(45 8 8)"/>`,
  triangle: (c) => `<polygon points="8,1 15,15 1,15" fill="${c}"/>`,
};

export function generateIconSvg(icon: TabRuleIcon): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${SHAPE_SVG[icon.shape](icon.color)}</svg>`;
}

export function generateIconDataUri(icon: TabRuleIcon): string {
  return 'data:image/svg+xml,' + encodeURIComponent(generateIconSvg(icon));
}

// ─── Storage Helpers ───

export async function loadRules(): Promise<TabRule[]> {
  const result = await chrome.storage.local.get(TAB_RULES_KEY);
  return (result[TAB_RULES_KEY] as TabRule[] | undefined) ?? [];
}

export async function saveRules(rules: TabRule[]): Promise<void> {
  await chrome.storage.local.set({ [TAB_RULES_KEY]: rules });
}

// ─── ID Generation ───

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
