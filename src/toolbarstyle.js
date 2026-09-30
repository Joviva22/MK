(function () {
'use strict';

// Estilo de la barra superior (⚙ Ajustes → Apariencia):
// - Etiquetas: 'mixed' (como siempre: unos con texto, otros solo ícono),
//   'icons' (solo íconos, más limpio) o 'text' (todos con nombre).
// - Auto-ocultar: la barra se esconde y aparece al acercar el mouse arriba
//   (o con Ctrl+Shift+M, que también activa/desactiva el auto-ocultar).

const toolbar = document.querySelector('.toolbar');

// Nombres cortos para los botones que hoy son solo ícono.
const SHORT_LABELS = {
  'btn-toggle-sidebar': 'Archivos',
  'btn-refresh-tree': 'Refrescar',
  'btn-diff': 'Cambios',
  'btn-toc': 'Índice',
  'btn-search': 'Buscar',
  'btn-run-file': 'Ejecutar',
  'btn-terminal': 'Terminal',
  'btn-command-palette': 'Comandos',
  'btn-tags': 'Etiquetas',
  'btn-backlinks': 'Backlinks',
  'btn-plugins': 'Plugins',
  'btn-pdfpages': 'Páginas PDF',
  'btn-pdfhighlight': 'Escribir PDF',
  'btn-pomodoro': 'Pomodoro',
  'btn-media-prev': 'Anterior',
  'btn-media-playpause': 'Play',
  'btn-media-next': 'Siguiente',
  'btn-settings': 'Ajustes'
};

// Envuelve el texto de cada botón en <span class="tb-label"> (y el ▾ aparte,
// que se ve siempre) para poder ocultarlo; agrega nombre a los que no tienen.
function prepareButtons() {
  toolbar.querySelectorAll(':scope > .toolbar-button, :scope > .dropdown > .toolbar-button').forEach((btn) => {
    if (btn.id === 'btn-focus') { // lo arma modes.js (muestra el modo actual)
      btn.dataset.short = 'Modo de vista';
      return;
    }
    const text = Array.from(btn.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
    Array.from(btn.childNodes).forEach((n) => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
    const caret = /▾$/.test(text);
    const label = text.replace(/\s*▾$/, '').trim() || SHORT_LABELS[btn.id] || '';
    if (label) btn.dataset.short = label;
    if (label) {
      const span = document.createElement('span');
      span.className = 'tb-label' + (text.replace(/\s*▾$/, '').trim() ? '' : ' tb-added');
      span.textContent = label;
      btn.appendChild(span);
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', label);
    }
    if (caret) {
      const c = document.createElement('span');
      c.className = 'tb-caret';
      c.textContent = '▾';
      btn.appendChild(c);
    }
  });
}

function applyLabels(mode) {
  document.body.classList.toggle('tb-mode-icons', mode === 'icons');
  document.body.classList.toggle('tb-mode-text', mode === 'text');
}

// ---- auto-ocultar ----
const hotZone = document.createElement('div');
hotZone.className = 'toolbar-hotzone';
document.body.appendChild(hotZone);
let hideTimer = null;

function measure() {
  document.documentElement.style.setProperty('--toolbar-h', `${toolbar.offsetHeight}px`);
}

function peek(on) {
  clearTimeout(hideTimer);
  if (on) {
    document.body.classList.add('toolbar-peek');
  } else {
    // Un menú abierto (Nuevo ▾, Exportar ▾...) o el foco adentro: no esconder.
    hideTimer = setTimeout(() => {
      const menuOpen = !!toolbar.querySelector('.dropdown-menu:not([hidden])');
      if (menuOpen || toolbar.contains(document.activeElement)) return peek(false);
      document.body.classList.remove('toolbar-peek');
    }, 400);
  }
}

function applyAutohide(on) {
  measure();
  document.body.classList.toggle('toolbar-autohide', on);
  document.body.classList.remove('toolbar-peek');
  if (window.mdCodeMirror) setTimeout(() => window.mdCodeMirror.refresh(), 250);
}

hotZone.addEventListener('mouseenter', () => peek(true));
toolbar.addEventListener('mouseenter', () => peek(true));
toolbar.addEventListener('mouseleave', () => peek(false));
toolbar.addEventListener('focusin', () => peek(true));
window.addEventListener('resize', measure);

// ---- ajustes ----
const labelsSelect = document.getElementById('set-toolbar-labels');
const autohideToggle = document.getElementById('set-toolbar-autohide');
let autohide = false;

async function setAutohide(on) {
  autohide = on;
  if (autohideToggle) autohideToggle.checked = on;
  applyAutohide(on);
  await window.mdEditor.setConfig({ toolbarAutohide: on });
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    setAutohide(!autohide);
  }
});

if (labelsSelect) {
  labelsSelect.addEventListener('change', async () => {
    applyLabels(labelsSelect.value);
    measure();
    await window.mdEditor.setConfig({ toolbarLabels: labelsSelect.value });
  });
}
if (autohideToggle) autohideToggle.addEventListener('change', () => setAutohide(autohideToggle.checked));

prepareButtons();
(async () => {
  const config = await window.mdEditor.getConfig();
  const mode = ['mixed', 'icons', 'text'].includes(config.toolbarLabels) ? config.toolbarLabels : 'mixed';
  if (labelsSelect) labelsSelect.value = mode;
  applyLabels(mode);
  autohide = !!config.toolbarAutohide;
  if (autohideToggle) autohideToggle.checked = autohide;
  applyAutohide(autohide);
})();

window.mdToolbarStyle = { applyLabels, setAutohide, isAutohide: () => autohide };

})();
