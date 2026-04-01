import type { BookmarkItem, SortMode } from '../types';

type Comparator = (a: BookmarkItem, b: BookmarkItem) => number;

const comparators: Record<SortMode, Comparator> = {
  manual: () => 0, // Preserve Chrome's internal order (as returned by getChildren)
  alpha: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  dateAdded: (a, b) => b.dateAdded - a.dateAdded,
  url: (a, b) => {
    try {
      const hostA = new URL(a.url).hostname;
      const hostB = new URL(b.url).hostname;
      return hostA.localeCompare(hostB) || a.title.localeCompare(b.title);
    } catch {
      return a.url.localeCompare(b.url);
    }
  },
};

export function sortBookmarks(items: BookmarkItem[], mode: SortMode): BookmarkItem[] {
  return [...items].sort(comparators[mode]);
}
