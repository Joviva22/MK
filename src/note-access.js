(function () {
'use strict';

const MAX_RECENT = 20;
const MAX_FAVORITES = 200;
let state = { recent: [], favorites: [] };
let host;
let treePaths = new Set();
let recentOpen = true;
let favoritesOpen = true;
let queue = Promise.resolve();
const isFile = path => typeof path === 'string' && path.startsWith('/') && path.length > 1 && !path.includes('\0');
const inFolder = path => {
  const root = window.mdState.rootFolder;
  return !!root && path.startsWith(root.replace(/\/$/, '') + '/');
};
function normalize(value) {
  const list = (items, limit) => [...new Set(Array.isArray(items) ? items.filter(isFile) : [])].slice(0, limit);
  return { recent: list(value?.recent, MAX_RECENT), favorites: list(value?.favorites, MAX_FAVORITES) };
}
const ready = window.mdEditor.getConfig().then(async config => {
  state = normalize(config.noteAccess);
  if (config.noteAccess && JSON.stringify(state) !== JSON.stringify(config.noteAccess)) {
    const saved = await window.mdEditor.setConfig({ noteAccess: state });
    if (JSON.stringify(normalize(saved?.noteAccess)) !== JSON.stringify(state)) throw new Error('No se confirmó la actualización del historial.');
  }
  render();
});

function change(update) {
  const job = queue.then(async () => {
    await ready;
    const next = update({ recent: [...state.recent], favorites: [...state.favorites] });
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    const saved = await window.mdEditor.setConfig({ noteAccess: next });
    if (JSON.stringify(normalize(saved?.noteAccess)) !== JSON.stringify(next)) throw new Error('No se confirmó el guardado. Vuelve a intentarlo.');
    state = next;
    render();
  });
  queue = job.catch(error => window.mdErrorToast.show({ message: 'No se pudo guardar el acceso rápido', detail: error.message }));
  return queue;
}

function record(path) {
  if (!isFile(path)) return Promise.resolve();
  return change(next => { next.recent = [path, ...next.recent.filter(p => p !== path)].slice(0, MAX_RECENT); return next; });
}
function toggle(path) {
  if (!isFile(path) || !inFolder(path)) return Promise.resolve();
  return change(next => {
    if (next.favorites.includes(path)) next.favorites = next.favorites.filter(p => p !== path);
    else if (next.favorites.length >= MAX_FAVORITES) throw new Error('Puedes guardar hasta 200 favoritas. Quita alguna para añadir otra.');
    else next.favorites.push(path);
    return next;
  });
}
function relocate(from, to) {
  const map = path => path === from ? to : path.startsWith(from + '/') ? to + path.slice(from.length) : path;
  return change(next => normalize({ recent: next.recent.map(map), favorites: next.favorites.map(map) }));
}
function remove(path) {
  const keep = p => p !== path && !p.startsWith(path + '/');
  return change(next => ({ recent: next.recent.filter(keep), favorites: next.favorites.filter(keep) }));
}

function group(title, paths, kind) {
  const details = document.createElement('details');
  details.className = 'note-access-group';
  details.dataset.kind = kind;
  details.open = kind === 'recent' ? recentOpen : favoritesOpen;
  details.addEventListener('toggle', () => {
    if (!details.isConnected) return;
    if (kind === 'recent') recentOpen = details.open; else favoritesOpen = details.open;
  });
  const summary = document.createElement('summary');
  summary.textContent = `${title} · ${paths.length}`;
  details.appendChild(summary);
  if (!paths.length) {
    const empty = document.createElement('p');
    empty.className = 'note-access-empty';
    empty.textContent = kind === 'recent' ? 'Aquí aparecerán los archivos que abras.' : 'Marca un archivo con la estrella para tenerlo a mano.';
    details.appendChild(empty);
  }
  paths.forEach(path => {
    const row = document.createElement('div');
    row.className = 'note-access-row';
    row.dataset.path = path;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'note-access-open';
    open.disabled = !treePaths.has(path);
    open.title = open.disabled ? `${path}\nNo aparece en la carpeta. Actualiza el explorador o quita el acceso.` : path;
    open.setAttribute('aria-label', `Abrir ${path}`);
    const name = path.split('/').pop();
    const text = document.createElement('span');
    text.className = 'note-access-label';
    const label = document.createElement('span');
    label.textContent = name;
    const dir = document.createElement('small');
    dir.textContent = path.slice(window.mdState.rootFolder.replace(/\/$/, '').length + 1, -name.length).replace(/\/$/, '') || 'En esta carpeta';
    text.append(label, dir);
    open.appendChild(text);
    open.addEventListener('click', async () => {
      try {
        await window.openFileAtPath(path);
        if (window.mdState.currentFilePath === path && window.mdCodeMirror.getWrapperElement().getClientRects().length) window.mdCodeMirror.focus();
      } catch (error) {
        window.mdErrorToast.show({ message: 'No se pudo abrir el archivo', detail: error.message });
      }
    });
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'note-access-star';
    const favorite = state.favorites.includes(path);
    star.title = favorite ? 'Quitar de favoritas' : 'Añadir a favoritas';
    star.setAttribute('aria-label', `${star.title}: ${name}`);
    star.setAttribute('aria-pressed', String(favorite));
    window.mdIcons.button(star, 'star');
    star.addEventListener('click', () => toggle(path));
    row.classList.toggle('note-access-active', path === window.mdState.currentFilePath);
    row.append(open, star);
    details.appendChild(row);
  });
  return details;
}

function render() {
  if (!host?.isConnected) return;
  const focused = host.contains(document.activeElement) ? document.activeElement : null;
  const focusedPath = focused?.closest('.note-access-row')?.dataset.path;
  const focusedKind = focused?.closest('.note-access-group')?.dataset.kind;
  const focusedStar = focused?.classList.contains('note-access-star');
  host.replaceChildren();
  host.hidden = !window.mdState.rootFolder;
  if (host.hidden) return;
  const heading = document.createElement('div');
  heading.className = 'note-access-heading';
  const title = document.createElement('strong');
  title.textContent = 'Acceso rápido';
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'note-access-star';
  const path = window.mdState.currentFilePath;
  pin.disabled = !isFile(path) || !inFolder(path);
  const favorite = state.favorites.includes(path);
  pin.title = pin.disabled ? 'Abre o guarda un archivo en esta carpeta para marcarla' : favorite ? 'Quitar el archivo actual de favoritas' : 'Añadir el archivo actual a favoritas';
  pin.setAttribute('aria-pressed', String(favorite));
  window.mdIcons.button(pin, 'star');
  pin.addEventListener('click', () => toggle(path));
  heading.append(title, pin);
  host.append(heading, group('Favoritas', state.favorites.filter(inFolder), 'favorites'), group('Recientes', state.recent.filter(p => inFolder(p) && treePaths.has(p)).slice(0, 8), 'recent'));
  if (focused) {
    const rows = [...host.querySelectorAll('.note-access-row')];
    const row = rows.find(el => el.dataset.path === focusedPath && el.closest('details').dataset.kind === focusedKind);
    const target = focusedPath ? row?.querySelector(focusedStar ? '.note-access-star' : '.note-access-open') || host.querySelector(`details[data-kind="${focusedKind}"] > summary`) : pin;
    target?.focus();
  }
}
function mount(pane, tree = []) {
  treePaths = new Set();
  const walk = nodes => nodes.forEach(node => { if (node.esCarpeta) walk(node.hijos || []); else treePaths.add(node.ruta); });
  walk(tree);
  host = document.createElement('section');
  host.className = 'note-access';
  host.setAttribute('aria-label', 'Archivos favoritos y recientes de esta carpeta');
  pane.prepend(host);
  render();
}
document.addEventListener('mk:active-file-changed', () => { render(); record(window.mdState.currentFilePath); });
window.mdNoteAccess = { mount, toggle, record, relocate, remove, isFavorite: path => state.favorites.includes(path), whenIdle: () => queue };
ready.then(() => record(window.mdState.currentFilePath)).catch(error => window.mdErrorToast.show({ message: 'No se pudo cargar el acceso rápido', detail: error.message }));
})();
