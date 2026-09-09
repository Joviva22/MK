(function () {
'use strict';

const overlay = document.getElementById('search-panel');
const input = document.getElementById('search-input');
const resultsEl = document.getElementById('search-results');

let debounceTimer = null;

function renderResults(results) {
  resultsEl.innerHTML = '';
  if (!window.mdState.rootFolder) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'Abrí una carpeta primero (📁 Carpeta) para poder buscar en sus archivos.';
    resultsEl.appendChild(empty);
    return;
  }
  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = input.value.trim().length < 2 ? 'Escribí al menos 2 caracteres...' : 'Sin resultados.';
    resultsEl.appendChild(empty);
    return;
  }
  results.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item search-result-item';

    const path = document.createElement('div');
    path.className = 'search-result-path';
    path.textContent = `${r.relPath}:${r.line}`;

    const snippet = document.createElement('div');
    snippet.className = 'search-result-snippet';
    snippet.textContent = r.snippet;

    item.appendChild(path);
    item.appendChild(snippet);
    item.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      closeSearch();
      await window.openFileAtPath(r.filePath);
      const cm = window.mdCodeMirror;
      cm.setCursor({ line: r.line - 1, ch: 0 });
      cm.scrollIntoView({ line: r.line - 1, ch: 0 }, 100);
      cm.focus();
    });
    resultsEl.appendChild(item);
  });
}

async function runSearch() {
  const query = input.value;
  const root = window.mdState.rootFolder;
  if (!root || query.trim().length < 2) {
    renderResults([]);
    return;
  }
  const results = await window.mdEditor.searchInFolder(root, query);
  renderResults(results);
}

function openSearch() {
  overlay.hidden = false;
  renderResults([]);
  input.value = '';
  input.focus();
}

function closeSearch() {
  overlay.hidden = true;
  clearTimeout(debounceTimer);
}

input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 300);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
  }
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) closeSearch();
});

document.getElementById('btn-search').addEventListener('click', openSearch);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    if (overlay.hidden) openSearch(); else closeSearch();
  }
});

window.mdSearch = { open: openSearch, close: closeSearch };

})();
