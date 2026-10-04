(function () {
'use strict';

// Errores que el usuario tiene que ver (no se guardó una nota, falló la base
// de datos...): el proceso principal los registra en userData/logs/mk.log y
// manda 'app:error'; acá se muestran como aviso abajo a la derecha, sin
// bloquear. Además, los errores de JS no capturados del renderer van al
// mismo log (sin aviso: suelen no afectar al usuario).

let host = null;

function show({ message, detail, logFile, kind = 'error', actionLabel, onAction, key, duration = kind === 'success' ? 4500 : 0 }) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'app-error-toasts';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = `app-error-toast app-toast-${kind}`;
  toast.dataset.key = key || `${message}\n${detail || ''}`;
  [...host.children].filter(el => el.dataset.key === toast.dataset.key).forEach(el => el.remove());
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-atomic', 'true');
  const title = document.createElement('div');
  title.className = 'app-error-toast-title';
  title.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'app-error-toast-close';
  close.textContent = '×';
  close.title = 'Cerrar';
  close.setAttribute('aria-label', 'Cerrar aviso');
  const previousFocus = document.activeElement;
  function dismiss() { const focused = toast.contains(document.activeElement); clearTimeout(timer); toast.remove(); if (focused && previousFocus?.isConnected) previousFocus.focus(); }
  close.addEventListener('click', dismiss);
  const body = document.createElement('div');
  body.className = 'app-error-toast-body';
  const explanation = /ENOSPC/i.test(detail || '') ? 'El disco no tiene espacio disponible. Libera espacio y vuelve a intentarlo.' : /EACCES|EPERM/i.test(detail || '') ? 'No hay permiso para escribir aquí. Elige otra ubicación o revisa los permisos.' : /ENOENT/i.test(detail || '') ? 'La ubicación ya no está disponible. Actualiza la carpeta o elige otra ubicación.' : '';
  body.textContent = [explanation, detail, logFile ? `Registro: ${logFile}` : ''].filter(Boolean).join('\n');
  body.hidden = !body.textContent;
  toast.append(close, title, body);
  if (actionLabel && onAction) {
    const action = document.createElement('button'); action.type = 'button'; action.className = 'toolbar-button app-toast-action'; action.textContent = actionLabel;
    action.addEventListener('click', async () => { action.disabled = true; try { await onAction(); dismiss(); } catch (error) { show({ message: 'No se pudo completar la acción', detail: error.message }); } finally { action.disabled = false; } });
    toast.appendChild(action);
  } else if (kind === 'error') {
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'toolbar-button app-toast-action'; copy.textContent = 'Copiar detalles';
    copy.addEventListener('click', async () => { try { await window.mdEditor.clipboardWriteText(`${message}\n${body.textContent}`); copy.textContent = 'Detalles copiados'; } catch (error) { copy.textContent = 'No se pudo copiar'; window.mdEditor.logError('aviso:copiar', error.message); } });
    toast.appendChild(copy);
  }
  host.appendChild(toast);
  while (host.children.length > 5) host.firstElementChild.remove();
  let timer;
  const resume = () => { clearTimeout(timer); if (duration && !toast.matches(':hover') && !toast.contains(document.activeElement)) timer = setTimeout(dismiss, duration); };
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('focusin', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', resume); toast.addEventListener('focusout', () => setTimeout(resume, 0));
  toast.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismiss(); } });
  resume();
  return toast;
}

window.mdEditor.onAppError(show);

window.addEventListener('error', (e) => {
  // Aviso inofensivo de Chromium (un ResizeObserver no alcanzó a dibujar en
  // el mismo cuadro): no es un error de MK y tapaba los de verdad en el log.
  if (/^ResizeObserver loop/.test(e.message || '')) return;
  window.mdEditor.logError('window.onerror', `${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  window.mdEditor.logError('unhandledrejection', (r && r.stack) || String(r));
});

window.mdErrorToast = { show };
window.mdNotify = {
  show,
  success: (message, detail, key) => show({ message, detail, key, kind: 'success' }),
  saved: path => show({ message: `Guardado: ${path.split(/[\\/]/).pop()}`, detail: window.mdEditor.dirName(path), kind: 'success', key: 'file-saved', actionLabel: 'Copiar ruta', onAction: () => window.mdEditor.clipboardWriteText(path) })
};

})();
