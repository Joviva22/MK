(function () {
'use strict';

const containerEl = document.querySelector('.container');

let currentLayoutMode = 'normal';

function setLayoutMode(mode) {
  containerEl.classList.remove('mode-focus', 'mode-read');
  currentLayoutMode = mode;
  if (mode === 'focus') containerEl.classList.add('mode-focus');
  if (mode === 'read') containerEl.classList.add('mode-read');
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
}

function toggleMode(mode) {
  setLayoutMode(currentLayoutMode === mode ? 'normal' : mode);
}

document.getElementById('btn-focus').addEventListener('click', () => {
  const next = currentLayoutMode === 'normal' ? 'focus' : currentLayoutMode === 'focus' ? 'read' : 'normal';
  setLayoutMode(next);
});

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
  if (e.key.toLowerCase() === 'e') {
    e.preventDefault();
    toggleMode('focus');
  } else if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    toggleMode('read');
  }
});

// F11 (ver F11.md): pantalla completa real de la ventana + oculta
// toolbar/statusbar para un modo "escritura sin distracciones". No toca
// sidebar/modo enfoque-lectura, así vuelven tal cual estaban al salir.
document.addEventListener('keydown', async (e) => {
  if (e.key !== 'F11') return;
  e.preventDefault();
  const isFullscreen = await window.mdEditor.toggleFullscreen();
  document.body.classList.toggle('fullscreen-write', isFullscreen);
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
});

})();
