(function () {
'use strict';

const containerEl = document.querySelector('.container');

let currentLayoutMode = 'normal';

// Un PDF/imagen fuerza modo lectura solo (ver preview.js), pero eso no
// tiene que "pegarse": si después se abre un archivo de verdad (promover
// el panel secundario, clic en otro archivo, un wikilink...), ese modo
// forzado se tiene que soltar solo — si no, el archivo nuevo se abre en
// modo lectura sin querer (editor oculto) en vez de modo normal. Un modo
// lectura elegido A MANO por el usuario (Ctrl+Shift+R) no se toca nunca.
let pdfForcedReadMode = false;

function setLayoutMode(mode, opts) {
  containerEl.classList.remove('mode-focus', 'mode-read');
  currentLayoutMode = mode;
  if (mode === 'focus') containerEl.classList.add('mode-focus');
  if (mode === 'read') containerEl.classList.add('mode-read');
  pdfForcedReadMode = !!(opts && opts.forcedByPdf);
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
}

function toggleMode(mode) {
  setLayoutMode(currentLayoutMode === mode ? 'normal' : mode);
}

// Llamado desde tabs.js cada vez que un archivo de verdad pasa a ser
// principal (el único punto en común para "abrir archivo", venga de donde
// venga) — si el modo lectura actual era forzado por un PDF, lo suelta.
function releasePdfForcedReadMode() {
  if (pdfForcedReadMode) setLayoutMode('normal');
}

window.mdModes = { setLayoutMode, getLayoutMode: () => currentLayoutMode, releasePdfForcedReadMode };

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
