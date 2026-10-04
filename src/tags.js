(function () {
'use strict';

const overlay = document.getElementById('tags-panel');
const input = document.getElementById('tags-input');
const list = document.getElementById('tags-list');

let allTags = [];

function render(filter) {
  const q = filter.trim().toLowerCase();
  list.innerHTML = '';

  if (!window.mdState.rootFolder) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'Abrí una carpeta primero (📁 Carpeta) para ver sus etiquetas.';
    list.appendChild(empty);
    return;
  }

  const filtered = allTags.filter((t) => t.tag.includes(q));
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = allTags.length ? 'Sin resultados.' : 'No se encontraron etiquetas #así en los archivos de la carpeta.';
    list.appendChild(empty);
    return;
  }

  filtered.forEach((t) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item';
    item.textContent = `#${t.tag} (${t.count})`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      close();
      window.mdSearch.open();
      const searchInput = document.getElementById('search-input');
      searchInput.value = `#${t.tag}`;
      searchInput.dispatchEvent(new Event('input'));
    });
    list.appendChild(item);
  });
}

async function open() {
  overlay.hidden = false;
  input.value = '';
  list.innerHTML = '';
  allTags = window.mdState.rootFolder ? await window.mdEditor.listTags(window.mdState.rootFolder) : [];
  render('');
  input.focus();
}

function close() {
  overlay.hidden = true;
}

input.addEventListener('input', () => render(input.value));
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});

document.getElementById('btn-tags').addEventListener('click', open);

document.addEventListener('keydown', (e) => {
  if (window.mdShortcuts) return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    if (overlay.hidden) open(); else close();
  }
});

window.mdTags = { open, close };

})();
