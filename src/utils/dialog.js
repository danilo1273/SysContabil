// Centralized Dialog & Toast Event Bus for modern UI popups and alerts

let dialogListener = null;
let toastListener = null;

export const setDialogListener = (fn) => {
  dialogListener = fn;
};

export const setToastListener = (fn) => {
  toastListener = fn;
};

/**
 * Show a modern confirmation modal.
 * @param {string} message - Message or prompt.
 * @param {object} options - { title, type: 'warning'|'danger'|'info'|'success', confirmText, cancelText }
 * @returns {Promise<boolean>}
 */
export const showConfirm = (message, options = {}) => {
  return new Promise((resolve) => {
    if (dialogListener) {
      dialogListener({
        isOpen: true,
        mode: 'confirm',
        message,
        title: options.title || 'Confirmação',
        type: options.type || (message.includes('exclu') || message.includes('delet') ? 'danger' : 'warning'),
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    } else {
      // Fallback
      resolve(window.confirm(message));
    }
  });
};

/**
 * Show a modern alert modal.
 * @param {string} message - Message to display.
 * @param {object} options - { title, type: 'success'|'warning'|'danger'|'info', confirmText }
 * @returns {Promise<void>}
 */
export const showAlert = (message, options = {}) => {
  return new Promise((resolve) => {
    if (dialogListener) {
      dialogListener({
        isOpen: true,
        mode: 'alert',
        message,
        title: options.title || (options.type === 'danger' ? 'Atenção / Erro' : options.type === 'success' ? 'Sucesso' : 'Aviso do Sistema'),
        type: options.type || (message.toLowerCase().includes('erro') ? 'danger' : message.toLowerCase().includes('sucesso') ? 'success' : 'info'),
        confirmText: options.confirmText || 'Entendido',
        onConfirm: () => resolve(),
        onCancel: () => resolve()
      });
    } else {
      window.alert(message);
      resolve();
    }
  });
};

/**
 * Show a modern floating toast notification.
 * @param {string} message 
 * @param {object} options - { type: 'success'|'error'|'info'|'warning', duration: number }
 */
export const showToast = (message, options = {}) => {
  if (toastListener) {
    toastListener({
      id: 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      message,
      type: options.type || (message.toLowerCase().includes('erro') ? 'error' : 'success'),
      duration: options.duration || 3500
    });
  }
};

// Global helpers on window
if (typeof window !== 'undefined') {
  window.$confirm = showConfirm;
  window.$alert = showAlert;
  window.$toast = showToast;
}
