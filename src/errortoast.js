(function () {
'use strict';

// Errores que el usuario tiene que ver (no se guardó una nota, falló la base
// de datos...): el proceso principal los registra en userData/logs/mk.log y
// manda 'app:error'; acá se muestran como aviso abajo a la derecha, sin
// bloquear. Además, los errores de JS no capturados del renderer van al
// mismo log (sin aviso: suelen no afectar al usuario).

let host = null;

function show({ message, detail, logFile }) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'app-error-toasts';
    host.setAttribute('role', 'alert');
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'app-error-toast';
  const title = document.createElement('div');
  title.className = 'app-error-toast-title';
  title.textContent = '⚠ ' + message;
  const close = document.createElement('button');
  close.className = 'app-error-toast-close';
  close.textContent = '×';
  close.title = 'Cerrar';
  close.setAttribute('aria-label', 'Cerrar aviso');
  close.addEventListener('click', () => toast.remove());
  const body = document.createElement('div');
  body.className = 'app-error-toast-body';
  body.textContent = (detail ? detail + '\n' : '') + (logFile ? `Detalle en ${logFile}` : '');
  toast.append(close, title, body);
  host.appendChild(toast);
  setTimeout(() => toast.remove(), 20000);
}

window.mdEditor.onAppError(show);

window.addEventListener('error', (e) => {
  window.mdEditor.logError('window.onerror', `${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  window.mdEditor.logError('unhandledrejection', (r && r.stack) || String(r));
});

window.mdErrorToast = { show };

})();
