(function () {
'use strict';

// Barra de estado: estado de guardado de la pestaña activa, rama de git de
// la carpeta abierta y palabras/caracteres (de la selección si hay una).
// El modo (Markdown, Python…) y Ln/Col siguen en editor.js / tabs.js.

const cm = window.mdCodeMirror;
const saveEl = document.getElementById('status-save');
const gitEl = document.getElementById('status-git');
const wordsEl = document.getElementById('status-words');

function countWords(text) {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu);
  return m ? m.length : 0;
}

let wordsTimer = null;
function updateWords() {
  clearTimeout(wordsTimer);
  wordsTimer = setTimeout(() => {
    const sel = cm.getSelection();
    const text = sel || cm.getValue();
    const words = countWords(text);
    const chars = text.length;
    wordsEl.textContent = `${sel ? 'Selección: ' : ''}${words.toLocaleString()} palabra${words === 1 ? '' : 's'} · ${chars.toLocaleString()} caracteres`;
  }, 150);
}

function updateSave() {
  const info = window.mdTabs && window.mdTabs.getActiveState();
  if (!info) {
    saveEl.textContent = '';
    return;
  }
  let text;
  if (info.conflict) text = '⚠ Cambió afuera';
  else if (!info.filePath) text = info.modified ? '● Sin guardar (nuevo)' : 'Sin guardar (nuevo)';
  else text = info.modified ? '● Sin guardar' : '✓ Guardado';
  saveEl.textContent = text;
  saveEl.classList.toggle('is-dirty', !!info.modified || !!info.conflict);
}

let gitRoot = null;
async function updateGit() {
  const root = window.mdState.rootFolder;
  gitRoot = root;
  if (!root) {
    gitEl.hidden = true;
    return;
  }
  const branch = await window.mdEditor.gitBranch(root);
  if (root !== gitRoot) return; // cambió de carpeta mientras preguntaba
  gitEl.hidden = !branch;
  gitEl.textContent = branch ? `⎇ ${branch}` : '';
}

gitEl.addEventListener('click', () => {
  if (window.mdGitPanel) window.mdGitPanel.open();
});

cm.on('changes', () => { updateWords(); updateSave(); });
cm.on('cursorActivity', updateWords);
cm.on('swapDoc', () => { updateWords(); updateSave(); });
document.addEventListener('mk:modified-changed', updateSave);
// Cambios afuera (git checkout, otra app): la rama puede haber cambiado.
document.addEventListener('mk:folder-changed', () => updateGit());
window.addEventListener('focus', () => { updateGit(); updateSave(); });
setInterval(updateGit, 60 * 1000);

// Carpeta nueva: el sidebar la abre por renderFolder (sin evento propio).
let lastRoot;
setInterval(() => {
  if (window.mdState.rootFolder !== lastRoot) {
    lastRoot = window.mdState.rootFolder;
    updateGit();
  }
  updateSave();
}, 1000);

updateWords();
updateSave();
updateGit();

window.mdStatusBar = { updateWords, updateSave, updateGit, countWords };

})();
