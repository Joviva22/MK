(function () {
'use strict';

// Panel informativo, sin lógica de carga real de plugins todavía (ver
// OBJETIVOS.md, largo plazo): un sistema de plugins de verdad implica cargar
// JS de terceros dentro de una app con acceso a disco, y eso se piensa
// aparte con cuidado en vez de improvisarlo acá.
const overlay = document.getElementById('plugins-panel');

function open() {
  overlay.hidden = false;
}

function close() {
  overlay.hidden = true;
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) close();
});

document.getElementById('btn-plugins').addEventListener('click', open);

window.mdPlugins = { open, close };

})();
