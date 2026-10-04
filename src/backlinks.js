(function () {
'use strict';

const overlay = document.getElementById('backlinks-panel');
const list = document.getElementById('backlinks-list');
const titleEl = document.getElementById('backlinks-title');

function baseNameOf(filePath) {
  return filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
}

function renderEmpty(text) {
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'command-palette-empty';
  empty.textContent = text;
  list.appendChild(empty);
}

// forPath: de otra nota (grafo → clic derecho → Ver backlinks); si no, la actual.
async function open(forPath) {
  overlay.hidden = false;
  const filePath = typeof forPath === 'string' ? forPath : window.mdState.currentFilePath;
  const root = window.mdState.rootFolder;

  if (!filePath) {
    titleEl.textContent = 'Backlinks';
    renderEmpty('Guardá este archivo primero para poder ver qué le enlaza.');
    return;
  }
  if (!root) {
    titleEl.textContent = 'Backlinks';
    renderEmpty('Abrí una carpeta primero (📁 Carpeta) para buscar backlinks.');
    return;
  }

  const target = baseNameOf(filePath);
  titleEl.textContent = `Backlinks de "${target}"`;
  renderEmpty('Buscando...');

  const results = await window.mdEditor.listBacklinks(root, target);
  list.innerHTML = '';
  if (!results.length) {
    renderEmpty(`Ningún archivo enlaza a "${target}" con [[${target}]] todavía.`);
    return;
  }

  results.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item search-result-item';

    const pathEl = document.createElement('div');
    pathEl.className = 'search-result-path';
    pathEl.textContent = `${r.relPath}:${r.line}`;

    const snippetEl = document.createElement('div');
    snippetEl.className = 'search-result-snippet';
    snippetEl.textContent = r.snippet;

    item.appendChild(pathEl);
    item.appendChild(snippetEl);
    item.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      close();
      await window.openFileAtPath(r.filePath);
      const cm = window.mdCodeMirror;
      cm.setCursor({ line: r.line - 1, ch: 0 });
      cm.scrollIntoView({ line: r.line - 1, ch: 0 }, 100);
      cm.focus();
    });
    list.appendChild(item);
  });
}

function close() {
  overlay.hidden = true;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) close();
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});

document.getElementById('btn-backlinks').addEventListener('click', open);

document.addEventListener('keydown', (e) => {
  if (!window.mdShortcuts && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    if (overlay.hidden) open(); else close();
  }
});

window.mdBacklinks = { open, close };

})();
