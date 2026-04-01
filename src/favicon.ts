// ─── Favicon URL Builder ───
// Uses Chrome's internal _favicon endpoint for cached site icons.

const FAVICON_SIZE = 32;

export function getFaviconUrl(pageUrl: string, size: number = FAVICON_SIZE): string {
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

/** Get the first letter of a domain for fallback display */
export function getDomainInitial(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove 'www.' prefix and get first letter
    const clean = hostname.replace(/^www\./, '');
    return clean.charAt(0).toUpperCase();
  } catch {
    return '?';
  }
}

/** Generate a deterministic color for a domain (for fallback icon bg) */
export function getDomainColor(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
      hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 45%, 55%)`;
  } catch {
    return 'hsl(220, 45%, 55%)';
  }
}

/** Create a favicon <img> element with fallback */
export function createFaviconElement(url: string, size: number = FAVICON_SIZE): HTMLElement {
  const img = document.createElement('img');
  img.className = 'bookmark-favicon';
  img.width = size;
  img.height = size;
  img.loading = 'lazy';
  img.src = getFaviconUrl(url, size);

  // On error, replace with initial-based fallback
  img.onerror = () => {
    const fallback = document.createElement('span');
    fallback.className = 'bookmark-favicon-fallback';
    fallback.style.width = `${size}px`;
    fallback.style.height = `${size}px`;
    fallback.style.background = getDomainColor(url);
    fallback.style.color = 'white';
    fallback.textContent = getDomainInitial(url);
    img.replaceWith(fallback);
  };

  return img;
}
