(function () {
'use strict';

const overlay = document.getElementById('search-panel');
const input = document.getElementById('search-input');
const resultsEl = document.getElementById('search-results');

let debounceTimer = null;

function sectionTitle(text) {
  const el = document.createElement('div');
  el.className = 'search-section-title';
  el.textContent = text;
  resultsEl.appendChild(el);
}

function resultItem(pathText, snippetText, onPick) {
  const item = document.createElement('div');
  item.className = 'command-palette-item search-result-item';
  const path = document.createElement('div');
  path.className = 'search-result-path';
  path.textContent = pathText;
  const snippet = document.createElement('div');
  snippet.className = 'search-result-snippet';
  snippet.textContent = snippetText;
  item.append(path, snippet);
  item.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    closeSearch();
    await onPick();
  });
  resultsEl.appendChild(item);
}

// Tres fuentes: archivos de la carpeta, tareas del Home y filas de bases de
// datos (estas dos no son .md, antes no aparecían).
function renderResults({ files, tasks, rows }, query) {
  resultsEl.innerHTML = '';
  const empty = (text) => {
    const el = document.createElement('div');
    el.className = 'command-palette-empty';
    el.textContent = text;
    resultsEl.appendChild(el);
  };
  if ((query || '').trim().length < 2) {
    empty(window.mdState.rootFolder ? 'Escribí al menos 2 caracteres...' : 'Escribí al menos 2 caracteres... (sin carpeta abierta solo se buscan las tareas del Home)');
    return;
  }
  if (!files.length && !tasks.length && !rows.length) {
    empty('Sin resultados.');
    return;
  }
  if (files.length) {
    sectionTitle(`Archivos (${files.length})`);
    files.forEach((r) => resultItem(`${r.relPath}:${r.line}`, r.snippet, async () => {
      await window.openFileAtPath(r.filePath);
      const cm = window.mdCodeMirror;
      cm.setCursor({ line: r.line - 1, ch: 0 });
      cm.scrollIntoView({ line: r.line - 1, ch: 0 }, 100);
      cm.focus();
    }));
  }
  if (tasks.length) {
    sectionTitle(`Tareas del Home (${tasks.length})`);
    tasks.forEach((t) => {
      const when = t.date ? new Date(t.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'sin fecha';
      resultItem(`🏠 ${when}${t.recurring ? ' · 🔁' : ''}${t.done ? ' · ✓ hecha' : ''}`, t.title + (t.notes ? ` — ${t.notes}` : ''), () => window.mdHome.revealTask(t.id));
    });
  }
  if (rows.length) {
    sectionTitle(`Bases de datos (${rows.length})`);
    rows.forEach((r) => resultItem(`▤ ${r.databaseName} › ${r.title} · ${r.column}`, r.snippet, () => window.mdDatabase.openWithFilter(r.databaseId, input.value.trim())));
  }
}

async function runSearch() {
  const query = input.value;
  const root = window.mdState.rootFolder;
  if (query.trim().length < 2) {
    renderResults({ files: [], tasks: [], rows: [] }, query);
    return;
  }
  const [files, tasks, rows] = await Promise.all([
    root ? window.mdEditor.searchInFolder(root, query) : [],
    window.mdHome ? window.mdHome.searchTasks(query) : [],
    root && window.mdDatabase ? window.mdDatabase.searchRows(query).catch(() => []) : []
  ]);
  if (input.value !== query) return; // ya escribió otra cosa: esta respuesta quedó vieja
  renderResults({ files, tasks, rows }, query);
}

function openSearch() {
  overlay.hidden = false;
  renderResults({ files: [], tasks: [], rows: [] }, '');
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
