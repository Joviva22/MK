(function () {
'use strict';

const editorPane = document.getElementById('editor-pane');
const statusMode = document.getElementById('status-mode');
const statusCursor = document.getElementById('status-cursor');

const cm = CodeMirror(editorPane, {
  mode: 'markdown',
  lineWrapping: true,
  lineNumbers: true,
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

window.mdEditor.onMenuNew(() => window.mdTabs.newTab());
window.mdEditor.onMenuOpen(() => window.mdTabs.openViaDialog());
window.mdEditor.onMenuSave(() => window.mdTabs.saveActive(false));
window.mdEditor.onMenuSaveAs(() => window.mdTabs.saveActive(true));

cm.setOption('extraKeys', {
  'Ctrl-S': () => window.mdTabs.saveActive(false),
  'Cmd-S': () => window.mdTabs.saveActive(false),
  'Ctrl-Shift-S': () => window.mdTabs.saveActive(true),
  'Cmd-Shift-S': () => window.mdTabs.saveActive(true),
  'Ctrl-O': () => window.mdTabs.openViaDialog(),
  'Cmd-O': () => window.mdTabs.openViaDialog(),
  'Ctrl-N': () => window.mdTabs.newTab(),
  'Cmd-N': () => window.mdTabs.newTab()
});

})();
