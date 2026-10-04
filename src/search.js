(function () {
'use strict';

const overlay = document.getElementById('search-panel');
const input = document.getElementById('search-input');
const resultsEl = document.getElementById('search-results');

let debounceTimer = null;
let requestId = 0;
let selectedIndex = 0;
let picks = [];
let previousFocus = null;

function sectionTitle(text) {
  const el = document.createElement('div');
  el.className = 'search-section-title';
  el.textContent = text;
  resultsEl.appendChild(el);
}

function resultItem(pathText, snippetText, onPick, nameText, query) {
  const item = document.createElement('div');
  item.className = 'command-palette-item search-result-item';
  item.id = `search-result-${picks.length}`;
  item.setAttribute('role', 'option');
  const path = document.createElement('div');
  path.className = 'search-result-path';
  path.textContent = pathText;
  item.title = pathText;
  const name = document.createElement('div');
  name.className = 'search-result-name';
  window.mdSearchPresentation.highlight(name, nameText, query);
  const snippet = document.createElement('div');
  snippet.className = 'search-result-snippet';
  window.mdSearchPresentation.highlight(snippet, snippetText, query);
  item.append(name, path, snippet);
  picks.push({ item, onPick });
  item.addEventListener('mousedown', (e) => {
    e.preventDefault();
    pickResult(onPick);
  });
  resultsEl.appendChild(item);
}

// Tres fuentes: archivos de la carpeta, tareas del Home y filas de bases de
// datos (estas dos no son .md, antes no aparecían).
function renderResults({ files, tasks, rows }, query) {
  input.removeAttribute('aria-activedescendant');
  resultsEl.innerHTML = '';
  picks = [];
  selectedIndex = 0;
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
    empty('No hay coincidencias. Prueba con menos palabras o con otro término.');
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
    }, r.relPath.split(/[\\/]/).pop(), query));
  }
  if (tasks.length) {
    sectionTitle(`Tareas del Home (${tasks.length})`);
    tasks.forEach((t) => {
      const when = t.date ? new Date(t.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'sin fecha';
      resultItem(`🏠 ${when}${t.recurring ? ' · 🔁' : ''}${t.done ? ' · ✓ hecha' : ''}${t.archived ? ' · 🗄 archivada (vuelve al Home)' : ''}`, t.notes || '', () => window.mdHome.revealTask(t.id), t.title, query);
    });
  }
  if (rows.length) {
    sectionTitle(`Bases de datos (${rows.length})`);
    rows.forEach((r) => resultItem(`▤ ${r.databaseName} › ${r.title} · ${r.column}`, r.snippet, () => window.mdDatabase.openWithFilter(r.databaseId, query.trim()), r.title, query));
  }
  selectResult(0);
}

async function pickResult(onPick) {
  closeSearch();
  try { await onPick(); } catch (error) {
    window.mdErrorToast.show({ message: 'No se pudo abrir el resultado', detail: error.message });
  }
}

function selectResult(index) {
  selectedIndex = Math.max(0, Math.min(index, picks.length - 1));
  picks.forEach(({ item }, i) => {
    item.classList.toggle('selected', i === selectedIndex);
    item.setAttribute('aria-selected', String(i === selectedIndex));
  });
  if (picks[selectedIndex]) input.setAttribute('aria-activedescendant', picks[selectedIndex].item.id);
  else input.removeAttribute('aria-activedescendant');
  picks[selectedIndex]?.item.scrollIntoView({ block: 'nearest' });
}

async function runSearch() {
  const id = ++requestId;
  const query = input.value;
  const root = window.mdState.rootFolder;
  if (query.trim().length < 2) {
    renderResults({ files: [], tasks: [], rows: [] }, query);
    return;
  }
  resultsEl.setAttribute('aria-busy', 'true');
  try {
    const [files, tasks, rows] = await Promise.all([
      root ? window.mdEditor.searchInFolder(root, query) : [],
      window.mdHome ? window.mdHome.searchTasks(query) : [],
      root && window.mdDatabase ? window.mdDatabase.searchRows(query).catch(() => []) : []
    ]);
    if (id !== requestId || overlay.hidden || input.value !== query) return; // ya escribió otra cosa: esta respuesta quedó vieja
    renderResults({ files, tasks, rows }, query);
  } catch {
    if (id !== requestId || overlay.hidden) return;
    resultsEl.textContent = '';
    input.removeAttribute('aria-activedescendant');
    picks = [];
    const message = document.createElement('div');
    message.className = 'command-palette-empty';
    message.textContent = 'No se pudo completar la búsqueda. Prueba de nuevo.';
    resultsEl.appendChild(message);
  } finally {
    if (id === requestId) resultsEl.setAttribute('aria-busy', 'false');
  }
}

function openSearch() {
  previousFocus = document.activeElement;
  requestId++;
  overlay.hidden = false;
  renderResults({ files: [], tasks: [], rows: [] }, '');
  input.value = '';
  input.focus();
}

function closeSearch() {
  overlay.hidden = true;
  requestId++;
  resultsEl.setAttribute('aria-busy', 'false');
  if (previousFocus?.isConnected) previousFocus.focus();
  clearTimeout(debounceTimer);
}

input.addEventListener('input', () => {
  requestId++;
  input.removeAttribute('aria-activedescendant');
  picks = [];
  resultsEl.setAttribute('aria-busy', 'false');
  resultsEl.textContent = '';
  const message = document.createElement('div');
  message.className = 'command-palette-empty';
  message.textContent = input.value.trim().length < 2 ? 'Escribe al menos 2 caracteres para buscar.' : 'Buscando…';
  resultsEl.appendChild(message);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 300);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    selectResult(selectedIndex + (e.key === 'ArrowDown' ? 1 : -1));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const pick = picks[selectedIndex];
    if (pick) pickResult(pick.onPick);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
  }
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) closeSearch();
});

document.getElementById('btn-search').addEventListener('click', openSearch);
document.getElementById('search-replace-btn').addEventListener('click', () => {
  const q = input.value.trim();
  closeSearch();
  window.mdReplaceFolder.open(q);
});

document.addEventListener('keydown', (e) => {
  if (window.mdShortcuts) return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    if (overlay.hidden) openSearch(); else closeSearch();
  }
});

window.mdSearch = { open: openSearch, close: closeSearch };

})();
