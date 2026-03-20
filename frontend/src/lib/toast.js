// Q31/Q32 — Lightweight toast notification system (no external deps)
let _setToasts = null;

export function registerToastSetter(fn) {
  _setToasts = fn;
}

export function toast(message, type = 'success', duration = 3500) {
  if (!_setToasts) return;
  const id = Date.now() + Math.random();
  _setToasts(prev => [...prev, { id, message, type }]);
  setTimeout(() => {
    _setToasts(prev => prev.filter(t => t.id !== id));
  }, duration);
}

export const toastSuccess = (msg) => toast(msg, 'success');
export const toastError   = (msg) => toast(msg, 'error');
