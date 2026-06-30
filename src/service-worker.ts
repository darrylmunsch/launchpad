// ─── Launchpad Service Worker ───
// Watches tab updates and applies tab-modifier rules (title + favicon overrides).
// Runs as a Manifest V3 background service worker.

import { matchesRule, applyTitleTemplate, generateIconDataUri, loadRules, TAB_RULES_KEY } from './tools/tab-modifier-types';
import type { TabRule } from './tools/tab-modifier-types';

let rules: TabRule[] = [];

// ─── Rule Loading ───

async function reloadRules(): Promise<void> {
  rules = await loadRules();
}

// Load on startup
reloadRules();

// Reload when rules change from the UI
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[TAB_RULES_KEY]) {
    reloadRules().then(() => applyToAllTabs());
  }
});

// ─── Tab Matching & Injection ───

function findMatchingRule(url: string): TabRule | undefined {
  return rules.find(rule => matchesRule(url, rule));
}

function applyToTab(tabId: number, url: string): void {
  const rule = findMatchingRule(url);
  if (!rule) return;

  const titleTemplate = rule.titleTemplate || '';
  const iconDataUri = rule.icon ? generateIconDataUri(rule.icon) : '';

  chrome.scripting.executeScript({
    target: { tabId },
    func: injectTabModification,
    args: [titleTemplate, iconDataUri, url],
  }).catch(() => {
    // Silently ignore injection failures (e.g., chrome:// pages, restricted URLs)
  });
}

async function applyToAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url) {
      applyToTab(tab.id, tab.url);
    }
  }
}

// ─── Keyboard Commands ───
// Fires regardless of focus location (omnibox, page, etc.) once the user has
// bound a shortcut. Forwards to any open Launchpad new tab page via runtime
// messaging — the page's listener decides what to do.

chrome.commands.onCommand.addListener((command) => {
  if (command === 'focus-search') {
    chrome.runtime.sendMessage({ type: 'focus-search' }).catch(() => {
      // No receiver (no new tab page open) — silently ignore.
    });
  }
});

// ─── Tab Update Listener ───

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Apply when page finishes loading
  if (changeInfo.status === 'complete' && tab.url) {
    applyToTab(tabId, tab.url);
  }
});

// ─── Injected Content Script ───
// This function runs in the tab's page context — it must be entirely self-contained.
// No closures or external references allowed.

function injectTabModification(titleTemplate: string, iconDataUri: string, pageUrl: string): void {
  // Clean up previous injection
  if ((window as any).__tabModifierCleanup) {
    (window as any).__tabModifierCleanup();
  }

  let originalTitle = document.title;
  let appliedTitle = '';
  let titleObserver: MutationObserver | null = null;
  let iconObserver: MutationObserver | null = null;
  let removedIcons: Element[] = [];

  function resolveTemplate(template: string, title: string): string {
    let hostname = '';
    try { hostname = new URL(pageUrl).hostname; } catch { /* ignore */ }
    return template
      .replace(/\{title\}/g, title)
      .replace(/\{domain\}/g, hostname)
      .replace(/\{url\}/g, pageUrl);
  }

  // Apply title
  if (titleTemplate) {
    appliedTitle = resolveTemplate(titleTemplate, originalTitle);
    document.title = appliedTitle;

    // Watch for page-initiated title changes and re-apply
    const titleEl = document.querySelector('title');
    if (titleEl) {
      titleObserver = new MutationObserver(() => {
        if (document.title !== appliedTitle) {
          originalTitle = document.title;
          appliedTitle = resolveTemplate(titleTemplate, originalTitle);
          document.title = appliedTitle;
        }
      });
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  // Apply icon. Chrome prefers an existing scalable (SVG) favicon over an appended
  // raster one, so simply adding our <link> isn't enough — we must remove the page's
  // own icon links. We stash them so cleanup can restore the original favicon.
  const ICON_SELECTOR =
    'link[rel~="icon"]:not([data-tab-modifier]), link[rel="shortcut icon"]:not([data-tab-modifier])';

  function assertIcon(): void {
    document.querySelectorAll(ICON_SELECTOR).forEach(el => {
      removedIcons.push(el);
      el.remove();
    });
    // Re-create our link fresh (and last) so Chrome re-evaluates the favicon.
    document.querySelectorAll('link[data-tab-modifier]').forEach(el => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.setAttribute('data-tab-modifier', '');
    link.href = iconDataUri;
    document.head.appendChild(link);
  }

  if (iconDataUri) {
    assertIcon();
    // Re-assert if the page (e.g. a single-page app) injects its own favicon later,
    // but cap it: a site that continuously repaints its own favicon (animated or
    // notification-count favicons) must never make us busy-loop or flicker. After the
    // budget is spent we disconnect and let the page keep its icon.
    const MAX_ICON_REASSERTS = 3;
    let iconReasserts = 0;
    iconObserver = new MutationObserver(() => {
      if (!document.querySelector(ICON_SELECTOR)) return;
      iconReasserts++;
      assertIcon();
      if (iconReasserts >= MAX_ICON_REASSERTS && iconObserver) {
        iconObserver.disconnect();
        iconObserver = null;
      }
    });
    iconObserver.observe(document.head, { childList: true });
  }

  // Register cleanup for next injection or removal
  (window as any).__tabModifierCleanup = () => {
    if (titleObserver) titleObserver.disconnect();
    if (iconObserver) iconObserver.disconnect();
    titleObserver = null;
    iconObserver = null;
    // Restore original title
    if (titleTemplate && originalTitle) {
      document.title = originalTitle;
    }
    // Remove our injected favicon and restore the page's own icon links
    document.querySelectorAll('link[data-tab-modifier]').forEach(el => el.remove());
    removedIcons.forEach(el => { if (!el.isConnected) document.head.appendChild(el); });
    removedIcons = [];
    delete (window as any).__tabModifierCleanup;
  };
}
