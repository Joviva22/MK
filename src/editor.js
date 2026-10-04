(function () {
'use strict';

const editorPane = document.getElementById('editor-pane');
const statusMode = document.getElementById('status-mode');
const statusCursor = document.getElementById('status-cursor');

const cm = CodeMirror(editorPane, {
  mode: 'markdown',
  lineWrapping: true,
  lineNumbers: true,
  spellcheck: true,
  value: ''
});

window.mdState = { currentFilePath: null };
window.mdCodeMirror = cm;
window.mdStatusMode = statusMode;

cm.on('cursorActivity', () => {
  const pos = cm.getCursor();
  statusCursor.textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
});

document.getElementById('btn-open').addEventListener('click', () => window.mdTabs.openViaDialog());
document.getElementById('btn-save').addEventListener('click', () => window.mdTabs.saveActive(false));
document.getElementById('btn-save-as').addEventListener('click', () => window.mdTabs.saveActive(true));

// Sin menú nativo (se sacó para el modo F11 sin distracciones): estos atajos antes dependían de los
// accelerators del menú de Electron. Van a nivel de documento (no en el
// keymap de CodeMirror) para que funcionen tenga el foco el editor u otra
// parte de la app (sidebar, búsqueda, etc.).
document.addEventListener('keydown', (e) => {
  if (window.mdShortcuts) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const key = e.key.toLowerCase();
  if (key === 's' && e.shiftKey) {
    e.preventDefault();
    window.mdTabs.saveActive(true);
  } else if (key === 's') {
    e.preventDefault();
    window.mdTabs.saveActive(false);
  } else if (key === 'o') {
    e.preventDefault();
    window.mdTabs.openViaDialog();
  } else if (key === 'n') {
    e.preventDefault();
    window.mdTabs.newTab();
  }
});

})();
