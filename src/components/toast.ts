// ─── Toast Notification Component ───
// Lightweight toast notifications anchored at the bottom of the screen.
// Lazy-initializes the container on first use (no initToast() needed).

import { store } from '../state';

export interface ToastOptions {
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

let containerEl: HTMLElement | null = null;
let activeTimeout: number | undefined;

function ensureContainer(): HTMLElement {
  if (!containerEl) {
    containerEl = document.createElement('div');
    containerEl.className = 'toast-container';
    document.body.appendChild(containerEl);
  }
  return containerEl;
}

export function showToast(options: ToastOptions): void {
  if (!store.get('settings').toastsEnabled) return;

  const container = ensureContainer();

  // Clear any existing toast
  clearTimeout(activeTimeout);
  container.textContent = '';

  const toast = document.createElement('div');
  toast.className = 'toast';

  const msg = document.createElement('span');
  msg.className = 'toast-message';
  msg.textContent = options.message;
  toast.appendChild(msg);

  if (options.action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = options.action.label;
    const onClick = options.action.onClick;
    btn.addEventListener('click', () => {
      onClick();
      dismiss(toast);
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  // Longer duration when there's an action button the user might click
  const duration = options.duration ?? (options.action ? 5000 : 3000);
  activeTimeout = window.setTimeout(() => dismiss(toast), duration);
}

function dismiss(toast: HTMLElement): void {
  clearTimeout(activeTimeout);
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove());
  // Fallback removal if animations are disabled
  setTimeout(() => toast.remove(), 300);
}
