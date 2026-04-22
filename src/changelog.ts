// ─── Changelog ───
// Bundled release notes. Newest version first. Update this file whenever
// manifest.json's version is bumped — the two are the source of truth together.

export type ChangeType = 'new' | 'improved' | 'fixed';

export interface ChangelogEntry {
  type: ChangeType;
  text: string;
}

export interface ChangelogVersion {
  version: string;
  date: string; // ISO yyyy-mm-dd
  entries: ChangelogEntry[];
}

export const CHANGELOG: ChangelogVersion[] = [
  {
    version: '1.1.0',
    date: '2026-04-22',
    entries: [
      { type: 'new', text: "What's New release notes, accessible from Settings → About" },
      { type: 'fixed', text: 'Dragging a bookmark onto another in a subfolder section now stays in that subfolder instead of moving to the top-level folder' },
      { type: 'fixed', text: 'Reordering is disabled while searching — shows a toast instead of shuffling items across folders' },
      { type: 'improved', text: 'Folder rows now match the bookmark grid column sizing in both row and column layouts' },
      { type: 'improved', text: 'Removed the divider between folders and bookmarks within the same section for a cleaner look' },
      { type: 'improved', text: 'Collapsed sidebar hides the folder tree entirely — only the logo and expand button show' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-01',
    entries: [
      { type: 'new', text: 'Fast new tab dashboard with folder-aware bookmark grid' },
      { type: 'new', text: 'Light, dark, and system theme support' },
      { type: 'new', text: 'Card and compact view modes with row or column layouts' },
      { type: 'new', text: 'Pin and hide bookmarks to curate your view' },
      { type: 'new', text: 'Full-text search across every subfolder' },
      { type: 'new', text: 'Tab modifier rules with a live URL tester' },
      { type: 'new', text: 'Keyboard-driven multi-select, move, and delete' },
    ],
  },
];

/** Currently installed extension version (from manifest.json). */
export function currentVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * Top of the bundled changelog — the version the user would be "caught up to"
 * after reading the What's New modal. Prefer this over currentVersion() for
 * ack-state writes so the feature is robust to manifest lag (e.g. dev-mode
 * reloads that haven't picked up the new manifest yet).
 */
export function latestChangelogVersion(): string {
  return CHANGELOG[0]?.version ?? currentVersion();
}

/**
 * True when `seen` is a version older than the top of the changelog.
 * Handles the empty-string (fresh install) case as "no unseen changes"
 * so the caller can seed without flashing a popup.
 */
export function hasUnseenChanges(seen: string, latest: string = CHANGELOG[0]?.version ?? ''): boolean {
  if (!seen) return false;
  if (!latest) return false;
  return compareVersions(seen, latest) < 0;
}

/** Returns -1, 0, or 1. Compares dotted-number version strings (e.g. "1.2.3"). */
export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(n => parseInt(n, 10) || 0);
  const bParts = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ai = aParts[i] ?? 0;
    const bi = bParts[i] ?? 0;
    if (ai !== bi) return ai < bi ? -1 : 1;
  }
  return 0;
}
