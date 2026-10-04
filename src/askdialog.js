(function () {
'use strict';

let current = null;
let serial = 0;

function finish(value) {
  if (!current) return;
  const { overlay, resolve, previousFocus } = current;
  current = null;
  overlay.remove();
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  resolve(value);
}

function mdAsk(message, defaultValue, options = {}) {
  if (current) finish(null); // un solo diálogo a la vez
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay palette-overlay ask-overlay';
    const box = document.createElement('div');
    box.className = 'command-palette ask-dialog';
    const id = `ask-dialog-${++serial}`;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', id);
    const label = document.createElement('h2');
    label.id = id;
    label.className = 'ask-message';
    label.textContent = message;
    box.appendChild(label);
    if (options.description) {
      const description = document.createElement('p');
      description.className = 'ask-description'; description.id = `${id}-description`; description.textContent = options.description;
      box.setAttribute('aria-describedby', description.id); box.appendChild(description);
    }
    if (options.context) {
      const context = document.createElement('div'); context.className = 'ask-context'; context.textContent = options.context; context.title = options.context;
      box.appendChild(context);
    }
    const input = document.createElement(options.choices ? 'select' : 'input');
    input.className = 'ask-input';
    input.id = `${id}-input`;
    if (options.choices) for (const choice of options.choices) {
      const item = document.createElement('option'); item.value = choice.value; item.textContent = choice.label; input.appendChild(item);
    }
    input.value = defaultValue != null ? String(defaultValue) : '';
    input.spellcheck = false;
    if (!options.confirm) {
      const fieldLabel = document.createElement('label'); fieldLabel.className = 'ask-field-label'; fieldLabel.htmlFor = input.id; fieldLabel.textContent = options.inputLabel || 'Nombre';
      box.append(fieldLabel, input);
    }
    const error = document.createElement('p'); error.className = 'ask-error'; error.id = `${id}-error`; error.setAttribute('role', 'alert'); error.hidden = true;
    input.setAttribute('aria-describedby', error.id);
    const actions = document.createElement('div');
    actions.className = 'ask-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'toolbar-button';
    cancel.textContent = 'Cancelar';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'toolbar-button ask-ok' + (options.danger ? ' ask-danger' : '');
    ok.textContent = options.actionLabel || 'Aceptar';
    actions.append(cancel, ok);
    box.append(error, actions);
    overlay.appendChild(box);

    cancel.addEventListener('click', () => finish(null));
    function accept() {
      const invalid = options.validate?.(input.value);
      if (invalid) { error.textContent = invalid; error.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      finish(options.confirm ? true : input.value);
    }
    ok.addEventListener('click', accept);
    input.addEventListener('input', () => { error.hidden = true; input.removeAttribute('aria-invalid'); });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) finish(null); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') e.stopPropagation();
      if (e.key === 'Enter' && e.target === input && !e.isComposing) {
        e.preventDefault();
        accept();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });

    current = { overlay, resolve, previousFocus: document.activeElement };
    document.body.appendChild(overlay);
    (options.confirm ? cancel : input).focus();
    // Nombre de archivo: seleccionar sin la extensión, como en los exploradores.
    if (!options.confirm && input.tagName === 'INPUT') {
      const dot = input.value.lastIndexOf('.');
      if (dot > 0) input.setSelectionRange(0, dot); else input.select();
    }
  });
}

window.mdAsk = mdAsk;
window.mdConfirm = (message, options = {}) => mdAsk(message, null, { ...options, confirm: true }).then(Boolean);

})();
