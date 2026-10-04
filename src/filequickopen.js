(function () {
'use strict';

// Abrir archivo rápido por nombre (Ctrl+P, tipo VSCode) — Ctrl+Shift+F ya
// busca por CONTENIDO, esto es para saltar directo a un archivo cuando ya
// sabés (o te acordás a medias) cómo se llama, sin escribir texto de
// adentro. Reusa el árbol que ya devuelve folder:read (el mismo que arma
// el sidebar) en vez de mantener un índice propio.

const overlay = document.getElementById('file-open-panel');
const input = document.getElementById('file-open-input');
const list = document.getElementById('file-open-results');

const MAX_RESULTS = 200;

let files = [];
let selectedIndex = 0;

function flattenFiles(nodes, acc) {
  for (const node of nodes) {
    if (node.esCarpeta) {
      flattenFiles(node.hijos || [], acc);
    } else {
      acc.push(node);
    }
  }
  return acc;
}

async function loadFiles() {
  const root = window.mdState.rootFolder;
  if (!root) {
    files = [];
    return;
  }
  const result = await window.mdEditor.readFolder(root);
  const flat = flattenFiles((result && result.tree) || [], []);
  files = flat.map((node) => {
    const relFull = node.ruta.slice(root.length).replace(/^[\\/]/, '');
    const relDir = relFull.slice(0, relFull.length - node.nombre.length).replace(/[\\/]$/, '');
    return { nombre: node.nombre, ruta: node.ruta, relDir };
  });
}

function render(filter) {
  list.innerHTML = '';

  if (!window.mdState.rootFolder) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'Abrí una carpeta primero (📁 Carpeta) para poder buscar archivos por nombre.';
    list.appendChild(empty);
    return [];
  }

  const q = filter.trim().toLowerCase();
  const filtered = (q ? files.filter((f) => f.nombre.toLowerCase().includes(q)) : files).slice(0, MAX_RESULTS);

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'Sin resultados.';
    list.appendChild(empty);
    return [];
  }

  filtered.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item search-result-item' + (i === selectedIndex ? ' selected' : '');

    const name = document.createElement('div');
    name.className = 'search-result-name';
    window.mdSearchPresentation.highlight(name, f.nombre, filter);
    item.appendChild(name);

    if (f.relDir) {
      const dir = document.createElement('div');
      dir.className = 'search-result-snippet';
      dir.textContent = f.relDir;
      item.appendChild(dir);
    }

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      openFile(f);
    });
    list.appendChild(item);
  });

  list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  return filtered;
}

function openFile(f) {
  close();
  window.openFileAtPath(f.ruta);
}

async function open() {
  overlay.hidden = false;
  selectedIndex = 0;
  input.value = '';
  await loadFiles();
  render('');
  input.focus();
}

function close() {
  overlay.hidden = true;
}

input.addEventListener('input', () => {
  selectedIndex = 0;
  render(input.value);
});

input.addEventListener('keydown', (e) => {
  const filtered = render(input.value);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.max(0, Math.min(selectedIndex + 1, filtered.length - 1));
    render(input.value);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    render(input.value);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filtered[selectedIndex]) openFile(filtered[selectedIndex]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});

document.addEventListener('keydown', (e) => {
  if (window.mdShortcuts) return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    if (overlay.hidden) open(); else close();
  }
});

window.mdFileOpen = { open, close };

})();
