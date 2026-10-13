// One toast at a time: a new one replaces the current one. Shown by <Toaster />.

export interface ToastOptions {
  tone?: 'default' | 'error';
  icon?: string;
  /** Shows an Undo button. Prefer undo over confirm dialogs for destructive actions. */
  undo?: () => void;
  ms?: number;
}

export interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

export const toasts = $state<{ current: ToastItem | null }>({ current: null });

let nextId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, opts: ToastOptions = {}): void {
  clearTimeout(timer);
  const item: ToastItem = { id: ++nextId, message, ...opts };
  toasts.current = item;
  timer = setTimeout(() => {
    if (toasts.current?.id === item.id) toasts.current = null;
  }, opts.ms ?? 5000);
}

export function dismissToast(): void {
  clearTimeout(timer);
  toasts.current = null;
}
