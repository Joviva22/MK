(function () {
'use strict';

// Explorador de multimedia: todas las fotos, videos y audios de la carpeta
// abierta en una cuadrícula, con filtros por tipo y búsqueda por nombre.
// Clic: abrir en el visor. "Insertar": en la nota actual (ruta relativa).
// Las miniaturas cargan a medida que se ven (loading="lazy").

const MAX_ITEMS = 3000;
let items = []; // { path, name, rel, kind }
let kindFilter = 'all';
let query = '';

const overlay = document.createElement('div');
overlay.className = 'modal-overlay media-browser-overlay';
overlay.hidden = true;
overlay.innerHTML = `<div class="media-browser" role="dialog" aria-modal="true" aria-labelledby="media-browser-title">
  <div class="media-browser-head">
    <h2 id="media-browser-title">🖼 Multimedia</h2>
    <input type="search" class="settings-text-input media-browser-search" placeholder="Buscar por nombre…" aria-label="Buscar por nombre" autocomplete="off" />
    <div class="media-browser-filters" role="group" aria-label="Tipo">
      <button type="button" class="toolbar-button" data-kind="all">Todo</button>
      <button type="button" class="toolbar-button" data-kind="image">Fotos</button>
      <button type="button" class="toolbar-button" data-kind="video">Videos</button>
      <button type="button" class="toolbar-button" data-kind="audio">Audio</button>
    </div>
    <span class="media-browser-count" role="status"></span>
    <button type="button" class="toolbar-button media-browser-close" aria-label="Cerrar">✕</button>
  </div>
  <div class="media-browser-grid"></div>
</div>`;
document.body.appendChild(overlay);
const grid = overlay.querySelector('.media-browser-grid');
const countEl = overlay.querySelector('.media-browser-count');
const searchEl = overlay.querySelector('.media-browser-search');

function collect(nodes, root, out) {
  for (const n of nodes || []) {
    if (out.length >= MAX_ITEMS) return;
    if (n.esCarpeta) {
      if (n.nombre === 'node_modules') continue;
      collect(n.hijos, root, out);
    } else {
      const kind = window.mdMedia.kindOf(n.nombre);
      if (kind) out.push({ path: n.ruta, name: n.nombre, rel: window.mdEditor.relativeToRoot(root, n.ruta), kind });
    }
  }
}

function insertIntoNote(it) {
  const active = window.mdState.currentFilePath;
  const ref = active ? window.mdEditor.relativePath(active, it.path) : it.path;
  const safe = /[\s()]/.test(ref) ? `<${ref}>` : ref;
  const snippet = it.kind === 'image' ? `![${it.name}](${safe})` : `![[${ref}]]`;
  const cm = window.mdCodeMirror;
  cm.replaceSelection(snippet + '\n');
  close();
  cm.focus();
}

function card(it) {
  const c = document.createElement('div');
  c.className = 'media-card';
  c.tabIndex = 0;
  c.setAttribute('role', 'button');
  c.setAttribute('aria-label', `${it.name} — abrir`);
  const thumb = document.createElement('div');
  thumb.className = 'media-thumb';
  const url = window.mdEditor.toLocalUrl(it.path);
  if (it.kind === 'image') {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = url;
    img.alt = '';
    img.addEventListener('error', () => { thumb.textContent = '🖼'; });
    thumb.appendChild(img);
  } else if (it.kind === 'video') {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.src = url + '#t=1';
    v.addEventListener('error', () => { thumb.textContent = '🎬'; });
    thumb.appendChild(v);
    thumb.appendChild(Object.assign(document.createElement('span'), { className: 'media-badge', textContent: '▶' }));
  } else {
    thumb.textContent = '🎵';
  }
  const name = document.createElement('div');
  name.className = 'media-name';
  name.textContent = it.name;
  name.title = it.rel;
  const ins = document.createElement('button');
  ins.type = 'button';
  ins.className = 'toolbar-button media-insert';
  ins.textContent = 'Insertar';
  ins.title = 'Insertar en la nota abierta';
  ins.addEventListener('click', (e) => { e.stopPropagation(); insertIntoNote(it); });
  const openIt = () => { close(); window.showMediaPreview(it.path); };
  c.addEventListener('click', openIt);
  c.addEventListener('keydown', (e) => { if (e.key === 'Enter') openIt(); });
  c.append(thumb, name, ins);
  return c;
}

function render() {
  const q = query.toLowerCase();
  const shown = items.filter((it) => (kindFilter === 'all' || it.kind === kindFilter) && (!q || it.rel.toLowerCase().includes(q)));
  grid.innerHTML = '';
  if (!shown.length) {
    const empty = document.createElement('div');
    empty.className = 'media-empty';
    empty.textContent = items.length ? 'Nada coincide.' : 'No hay fotos, videos ni audios en esta carpeta.';
    grid.appendChild(empty);
  } else {
    const frag = document.createDocumentFragment();
    shown.forEach((it) => frag.appendChild(card(it)));
    grid.appendChild(frag);
  }
  const by = (k) => items.filter((i) => i.kind === k).length;
  countEl.textContent = `${shown.length} de ${items.length} · ${by('image')} fotos · ${by('video')} videos · ${by('audio')} audios${items.length >= MAX_ITEMS ? ' (tope)' : ''}`;
  overlay.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('media-filter-on', b.dataset.kind === kindFilter));
}

async function open() {
  const root = window.mdState.rootFolder;
  overlay.hidden = false;
  if (!root) {
    items = [];
    grid.innerHTML = '<div class="media-empty">Abrí una carpeta primero.</div>';
    countEl.textContent = '';
    return;
  }
  grid.innerHTML = '<div class="media-empty">Buscando…</div>';
  const res = await window.mdEditor.readFolder(root);
  items = [];
  collect(res ? res.tree : [], root, items);
  render();
  searchEl.focus();
}

function close() {
  overlay.hidden = true;
  grid.innerHTML = ''; // suelta las miniaturas (memoria)
}

overlay.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { kindFilter = b.dataset.kind; render(); }));
searchEl.addEventListener('input', () => { query = searchEl.value.trim(); render(); });
overlay.querySelector('.media-browser-close').addEventListener('click', close);
overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });

window.mdMediaBrowser = { open, close, getItems: () => items.slice(), setFilter: (k) => { kindFilter = k; render(); } };

})();
