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
  let observer: MutationObserver | null = null;

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
      observer = new MutationObserver(() => {
        if (document.title !== appliedTitle) {
          originalTitle = document.title;
          appliedTitle = resolveTemplate(titleTemplate, originalTitle);
          document.title = appliedTitle;
        }
      });
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  // Apply icon
  if (iconDataUri) {
    document.querySelectorAll('link[data-tab-modifier]').forEach(el => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.setAttribute('data-tab-modifier', '');
    link.href = iconDataUri;
    document.head.appendChild(link);
  }

  // Register cleanup for next injection or removal
  (window as any).__tabModifierCleanup = () => {
    if (observer) observer.disconnect();
    observer = null;
    // Restore original title
    if (titleTemplate && originalTitle) {
      document.title = originalTitle;
    }
    // Remove injected favicon
    document.querySelectorAll('link[data-tab-modifier]').forEach(el => el.remove());
    delete (window as any).__tabModifierCleanup;
  };
}
