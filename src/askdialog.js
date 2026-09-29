(function () {
'use strict';

// Reemplazo de prompt(): Electron NO lo soporta (tira "prompt() is and will
// not be supported"), así que todo lo que lo usaba — plantillas con
// {{titulo}}, "Insertar tabla", crear/renombrar desde el sidebar — fallaba.
// window.mdAsk(mensaje, valorInicial) → Promise<string | null> (null =
// cancelado con Escape, ✕ o clic afuera). Enter acepta.

let current = null; // { overlay, resolve }

function finish(value) {
  if (!current) return;
  const { overlay, resolve, previousFocus } = current;
  current = null;
  overlay.remove();
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  resolve(value);
}

function mdAsk(message, defaultValue) {
  if (current) finish(null); // un solo diálogo a la vez
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay palette-overlay ask-overlay';
    const box = document.createElement('div');
    box.className = 'command-palette ask-dialog';
    const label = document.createElement('div');
    label.className = 'ask-message';
    label.textContent = message;
    const input = document.createElement('input');
    input.className = 'ask-input';
    input.value = defaultValue != null ? String(defaultValue) : '';
    input.spellcheck = false;
    const actions = document.createElement('div');
    actions.className = 'ask-actions';
    const cancel = document.createElement('button');
    cancel.className = 'toolbar-button';
    cancel.textContent = 'Cancelar';
    const ok = document.createElement('button');
    ok.className = 'toolbar-button ask-ok';
    ok.textContent = 'Aceptar';
    actions.append(cancel, ok);
    box.append(label, input, actions);
    overlay.appendChild(box);

    cancel.addEventListener('click', () => finish(null));
    ok.addEventListener('click', () => finish(input.value));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) finish(null); });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // que los atajos globales no reaccionen mientras se escribe
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });

    current = { overlay, resolve, previousFocus: document.activeElement };
    document.body.appendChild(overlay);
    input.focus();
    // Nombre de archivo: seleccionar sin la extensión, como en los exploradores.
    const dot = input.value.lastIndexOf('.');
    if (dot > 0) input.setSelectionRange(0, dot); else input.select();
  });
}

window.mdAsk = mdAsk;

})();
