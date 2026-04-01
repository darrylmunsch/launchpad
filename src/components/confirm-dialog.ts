// ─── Confirm Dialog Component ───
// Reusable confirmation dialog using native <dialog>.
// Returns a Promise<boolean> so callers can `await` the result.

let dialogEl: HTMLDialogElement | null = null;
let titleEl: HTMLElement;
let messageEl: HTMLElement;
let cancelBtn: HTMLButtonElement;
let confirmBtn: HTMLButtonElement;
let resolvePromise: ((confirmed: boolean) => void) | null = null;

function ensureDialog(): void {
  if (dialogEl) return;

  dialogEl = document.createElement('dialog');
  dialogEl.className = 'modal confirm-dialog';
  dialogEl.innerHTML = `
    <div class="modal-form">
      <h2 class="modal-title confirm-dialog-title"></h2>
      <p class="confirm-dialog-message"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-role="cancel">Cancel</button>
        <button type="button" class="btn btn-danger" data-role="confirm">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialogEl);

  titleEl = dialogEl.querySelector('.confirm-dialog-title')!;
  messageEl = dialogEl.querySelector('.confirm-dialog-message')!;
  cancelBtn = dialogEl.querySelector('[data-role="cancel"]')! as HTMLButtonElement;
  confirmBtn = dialogEl.querySelector('[data-role="confirm"]')! as HTMLButtonElement;

  cancelBtn.addEventListener('click', () => close(false));
  confirmBtn.addEventListener('click', () => close(true));

  // Escape / backdrop click = cancel
  dialogEl.addEventListener('cancel', (e) => {
    e.preventDefault();
    close(false);
  });
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) close(false);
  });
}

function close(result: boolean): void {
  dialogEl?.close();
  resolvePromise?.(result);
  resolvePromise = null;
}

export function confirmDelete(title: string, message: string): Promise<boolean> {
  ensureDialog();

  titleEl.textContent = title;
  messageEl.textContent = message;

  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
    dialogEl!.showModal();
    cancelBtn.focus();
  });
}
