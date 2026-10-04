(function () {
'use strict';

const sidebarPane = document.getElementById('sidebar-pane');

// Iconos por defecto por extensión, mismo set de lucide que usa el picker
// de iconos personalizados (así el árbol se ve consistente elijas o no un
// icono a mano).
const ICONS_BY_EXT = {
  md: 'file-text', markdown: 'file-text',
  tex: 'sigma',
  js: 'file-code',
  html: 'code-2',
  css: 'palette',
  json: 'file-json',
  pdf: 'file',
  docx: 'file-type-2',
  svg: 'image'
};
const DEFAULT_FILE_ICON = 'paperclip';
// Fotos, video y audio: ver media.js (una sola lista para todo MK).

// Iconos personalizados por archivo (lucide), guardados en config.json bajo
// fileIcons: { "ruta/relativa/a/la/raiz.md": "star" }. Se guarda por ruta
// relativa (no absoluta) para que sobreviva a mover/renombrar la carpeta
// entera — sigue perdiéndose si renombrás el archivo suelto, y en teoría
// puede colisionar entre dos carpetas distintas con el mismo archivo
// relativo, pero es preferible a que se rompa cada vez que se mueve el
// proyecto de lugar. Se cargan una vez al arrancar.
let fileIcons = {};
let currentTreeResult = null;

// Selección múltiple con Ctrl/Cmd+clic: guarda el nodo completo (no solo la
// ruta) para poder mover/eliminar en bloque sin tener que volver a buscarlo
// en el árbol. Se limpia sola al hacer clic normal (sin Ctrl) en cualquier
// lado, o con Escape — mismo criterio que el menú contextual.
let selectedNodes = new Map(); // ruta -> node

function clearSelection() {
  if (!selectedNodes.size) return;
  selectedNodes.clear();
  document.querySelectorAll('.tree-row-selected').forEach((el) => el.classList.remove('tree-row-selected'));
}

// Ancla para Shift+clic: la última fila clicada (con o sin Ctrl).
let selectionAnchor = null;

// Filas visibles del árbol en orden (las de carpetas plegadas no cuentan).
function visibleRows() {
  return Array.from(document.querySelectorAll('#sidebar-pane .tree-row'))
    .filter((r) => r._node && !r.closest('ul.collapsed'));
}

// Shift+clic: selecciona todo el rango entre el ancla y esta fila.
function selectRange(row) {
  const rows = visibleRows();
  const to = rows.indexOf(row);
  let from = selectionAnchor ? rows.findIndex((r) => r._node.ruta === selectionAnchor) : -1;
  if (from === -1) from = to;
  clearSelection();
  const [a, b] = from <= to ? [from, to] : [to, from];
  for (let i = a; i <= b; i++) {
    selectedNodes.set(rows[i]._node.ruta, rows[i]._node);
    rows[i].classList.add('tree-row-selected');
  }
}

// Clic con modificador: true si ya se manejó como selección.
function handleSelectionClick(e, row, node) {
  if (e.shiftKey) {
    selectRange(row);
    return true;
  }
  if (e.ctrlKey || e.metaKey) {
    toggleSelection(row, node);
    selectionAnchor = node.ruta;
    return true;
  }
  selectionAnchor = node.ruta;
  return false;
}

function toggleSelection(row, node) {
  if (selectedNodes.has(node.ruta)) {
    selectedNodes.delete(node.ruta);
    row.classList.remove('tree-row-selected');
  } else {
    selectedNodes.set(node.ruta, node);
    row.classList.add('tree-row-selected');
  }
}

function extOf(node) {
  return node.nombre.split('.').pop().toLowerCase();
}

function relKeyFor(node) {
  const root = window.mdState.rootFolder;
  return root ? window.mdEditor.relativeToRoot(root, node.ruta) : node.ruta;
}

const MEDIA_ICONS = { image: 'image', video: 'video', audio: 'music' };

function iconFor(node) {
  if (node.esCarpeta) return 'folder';
  return fileIcons[relKeyFor(node)] || ICONS_BY_EXT[extOf(node)] || MEDIA_ICONS[window.mdMedia.kindOf(node.nombre)] || DEFAULT_FILE_ICON;
}

async function setFileIcon(node, iconName) {
  const key = relKeyFor(node);
  if (iconName) {
    fileIcons[key] = iconName;
  } else {
    delete fileIcons[key];
  }
  await window.mdEditor.setConfig({ fileIcons });
  if (currentTreeResult) renderFolder(currentTreeResult);
}

// Carpetas desplegadas: sobreviven a refreshTree() (crear/mover/renombrar
// redibuja el árbol entero, y antes quedaba todo plegado: un archivo nuevo
// dentro de una subcarpeta "desaparecía").
const expandedDirs = new Set();
let highlightPath = null; // recién creado/movido: se resalta un momento

// Despliega todas las carpetas desde la raíz hasta filePath (incluida la suya).
function revealPath(filePath) {
  const root = currentTreeResult && currentTreeResult.rootPath;
  if (!root || !filePath) return;
  let dir = window.mdEditor.dirName(filePath);
  while (dir && dir !== root && dir.startsWith(root)) {
    expandedDirs.add(dir);
    const parent = window.mdEditor.dirName(dir);
    if (parent === dir) break;
    dir = parent;
  }
  highlightPath = filePath;
}

async function refreshTree() {
  if (!currentTreeResult) return;
  const fresh = await window.mdEditor.readFolder(currentTreeResult.rootPath);
  if (fresh) renderFolder(fresh);
}

// ---- cambios hechos afuera de MK (ver folderwatch.js) ----
// git, otra app o una IA en la terminal crean/borran/mueven archivos: el
// árbol se rehace solo; si cambió el contenido de un archivo abierto, la
// pestaña se recarga (o queda ⚠ si tenía cambios sin guardar).
let watchedRoot = null;
let refreshRetry = null;

function watchRoot(root) {
  if (root === watchedRoot) return;
  watchedRoot = root;
  window.mdEditor.watchFolder(root);
}

async function refreshFromDisk() {
  // Renombrando/creando en el árbol (hay un <input>): esperar, si no se
  // pierde lo que se está escribiendo.
  if (sidebarPane.querySelector('input')) {
    clearTimeout(refreshRetry);
    refreshRetry = setTimeout(refreshFromDisk, 1000);
    return;
  }
  await refreshTree();
}

window.mdEditor.onFolderChanged((payload) => {
  if (!currentTreeResult || payload.root !== currentTreeResult.rootPath) return;
  if (payload.structural) refreshFromDisk();
  if (window.mdTabs) window.mdTabs.syncPaths(payload.changes.map((c) => c.path));
  document.dispatchEvent(new CustomEvent('mk:folder-changed', { detail: payload }));
});

// Sube un nivel: abre la carpeta padre de la que está abierta ahora como
// nueva raíz (igual que "Abrir carpeta" pero sin diálogo, y persiste el
// cambio para la próxima sesión).
async function goToParent() {
  if (!currentTreeResult) return;
  const parent = window.mdEditor.dirName(currentTreeResult.rootPath);
  if (!parent || parent === currentTreeResult.rootPath) return;
  const result = await window.mdEditor.readFolder(parent);
  if (!result) return;
  await window.mdEditor.setConfig({ lastFolder: parent });
  renderFolder(result);
}

async function createEntry(dirPath, isFolder) {
  let name = await window.mdAsk(isFolder ? 'Nombre de la nueva carpeta:' : 'Nombre del nuevo archivo:', isFolder ? '' : 'nota.md');
  if (!name || !name.trim()) return;
  // "Mi nota" → "Mi nota.md": sin extensión el archivo no se abría como Markdown.
  if (!isFolder && !/\.[a-z0-9]{1,8}$/i.test(name.trim())) name = name.trim() + '.md';
  const result = isFolder
    ? await window.mdEditor.createFolder(dirPath, name.trim())
    : await window.mdEditor.createFile(dirPath, name.trim());
  if (result.error) {
    alert(result.error);
    return;
  }
  revealPath(result.path);
  if (isFolder) expandedDirs.add(result.path);
  await refreshTree();
  highlightPath = null;
  if (!isFolder) window.openFileAtPath(result.path);
}

// Común a renombrar y mover: el archivo/carpeta pasó de node.ruta a
// newPath. Migra la clave del icono personalizado (guardada por ruta
// relativa a la raíz) y, si el archivo está abierto en una pestaña,
// actualiza esa pestaña para que no siga apuntando a la ruta vieja.
// Separado de refreshTree() para poder mover/eliminar varios de una y
// refrescar el árbol una sola vez al final, no una vez por elemento.
async function relocateEntryQuiet(node, newPath) {
  if (node.esCarpeta) {
    // Pestañas de archivos que estaban DENTRO de la carpeta movida/renombrada:
    // si no, al guardar recreaban el archivo en la ruta vieja.
    if (window.mdTabs && window.mdTabs.updateTabPathsUnder) window.mdTabs.updateTabPathsUnder(node.ruta, newPath);
    // La carpeta (y sus subcarpetas) siguen desplegadas con la ruta nueva.
    Array.from(expandedDirs).forEach((d) => {
      if (d === node.ruta || d.startsWith(node.ruta + '/')) {
        expandedDirs.delete(d);
        expandedDirs.add(newPath + d.slice(node.ruta.length));
      }
    });
  } else {
    const oldKey = relKeyFor(node);
    if (fileIcons[oldKey]) {
      const newKey = relKeyFor({ ruta: newPath });
      fileIcons[newKey] = fileIcons[oldKey];
      delete fileIcons[oldKey];
      await window.mdEditor.setConfig({ fileIcons });
    }
    if (window.mdTabs) window.mdTabs.updateTabPath(node.ruta, newPath);
  }
}

async function renameEntry(node) {
  const newName = await window.mdAsk('Nuevo nombre:', node.nombre);
  if (!newName || !newName.trim() || newName.trim() === node.nombre) return;
  const result = await window.mdEditor.renamePath(node.ruta, newName.trim());
  if (result.error) {
    alert(result.error);
    return;
  }
  await relocateEntryQuiet(node, result.path);
  await window.mdNoteAccess.relocate(node.ruta, result.path);
  revealPath(result.path);
  await refreshTree();
  highlightPath = null;
}

async function moveEntry(node, destDir) {
  if (window.mdEditor.dirName(node.ruta) === destDir) return; // ya está ahí
  const result = await window.mdEditor.movePath(node.ruta, destDir);
  if (result.error) {
    alert(result.error);
    return;
  }
  await relocateEntryQuiet(node, result.path);
  await window.mdNoteAccess.relocate(node.ruta, result.path);
  revealPath(result.path);
  await refreshTree();
  highlightPath = null;
}

// Arrastre de una selección múltiple: mismo movePath uno por uno, un solo
// refreshTree al final.
async function moveEntries(nodes, destDir) {
  for (const node of nodes) {
    if (window.mdEditor.dirName(node.ruta) === destDir) continue;
    const result = await window.mdEditor.movePath(node.ruta, destDir);
    if (result.error) {
      alert(`${node.nombre}: ${result.error}`);
      continue;
    }
    await relocateEntryQuiet(node, result.path);
    await window.mdNoteAccess.relocate(node.ruta, result.path);
    revealPath(result.path); // queda resaltado el último movido, con su carpeta abierta
  }
  await refreshTree();
  highlightPath = null;
  clearSelection();
}

async function deleteEntryQuiet(node) {
  const result = await window.mdEditor.deletePath(node.ruta, node.esCarpeta);
  if (result.error) {
    alert(`${node.nombre}: ${result.error}`);
    return;
  }
  const key = relKeyFor(node);
  await window.mdNoteAccess.remove(node.ruta);
  if (fileIcons[key]) {
    delete fileIcons[key];
    await window.mdEditor.setConfig({ fileIcons });
  }
}

async function deleteEntry(node) {
  const label = node.esCarpeta ? `la carpeta "${node.nombre}" y todo su contenido` : `el archivo "${node.nombre}"`;
  if (!confirm(`¿Eliminar ${label}? Se intenta mandar a la papelera del sistema (se puede restaurar desde ahí); si no hay papelera disponible, se borra directo.`)) return;
  await deleteEntryQuiet(node);
  await refreshTree();
}

async function deleteEntries(nodes) {
  if (!confirm(`¿Eliminar ${nodes.length} elementos seleccionados? Se intenta mandar a la papelera del sistema (se puede restaurar desde ahí); si no hay papelera disponible, se borra directo.`)) return;
  for (const node of nodes) await deleteEntryQuiet(node);
  await refreshTree();
  clearSelection();
}

// Menú contextual del árbol: iconos (solo archivos) + crear/renombrar/borrar.
const sidebarMenuEl = document.createElement('div');
sidebarMenuEl.className = 'context-menu';
sidebarMenuEl.hidden = true;
document.body.appendChild(sidebarMenuEl);

function hideSidebarMenu() {
  sidebarMenuEl.hidden = true;
}

function addMenuItem(label, handler) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', () => {
    hideSidebarMenu();
    handler();
  });
  sidebarMenuEl.appendChild(btn);
}

function positionSidebarMenu(x, y) {
  sidebarMenuEl.style.left = `${x}px`;
  sidebarMenuEl.style.top = `${y}px`;
  sidebarMenuEl.hidden = false;

  const rect = sidebarMenuEl.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 4;
  const maxY = window.innerHeight - rect.height - 4;
  if (x > maxX) sidebarMenuEl.style.left = `${Math.max(4, maxX)}px`;
  if (y > maxY) sidebarMenuEl.style.top = `${Math.max(4, maxY)}px`;
}

// node === null → click derecho en la raíz de la carpeta (solo crear, no
// tiene sentido "renombrar/eliminar" la carpeta que la app tiene abierta).
// multiNodes (2+) → clic derecho sobre una selección múltiple activa: menú
// reducido, solo lo que tiene sentido en bloque (eliminar; mover ya se hace
// arrastrando la selección entera, no hace falta un ítem de menú aparte).
function showSidebarMenu(x, y, node, multiNodes) {
  sidebarMenuEl.innerHTML = '';

  if (multiNodes && multiNodes.length > 1) {
    addMenuItem(`Eliminar ${multiNodes.length} elementos seleccionados`, () => deleteEntries(multiNodes));
    positionSidebarMenu(x, y);
    return;
  }

  const dirPath = node ? (node.esCarpeta ? node.ruta : window.mdState.rootFolder) : window.mdState.rootFolder;

  if (!node || node.esCarpeta) {
    addMenuItem('Nuevo archivo...', () => createEntry(dirPath, false));
    addMenuItem('Nueva carpeta...', () => createEntry(dirPath, true));
  }

  if (node && !node.esCarpeta) {
    addMenuItem(window.mdNoteAccess.isFavorite(node.ruta) ? 'Quitar de favoritas' : 'Añadir a favoritas', () => window.mdNoteAccess.toggle(node.ruta));
    addMenuItem('Abrir en panel secundario', () => window.mdSecondaryPane.open(node.ruta));
    addMenuItem('Abrir con la aplicación del sistema', () => window.mdEditor.openWithSystem(node.ruta));
    if (extOf(node) === 'pdf' && window.mdPdfHighlight) {
      addMenuItem('Escribir / subrayar en este PDF', () => {
        window.mdPdfHighlight.open();
        window.mdPdfHighlight.loadFromPath(node.ruta);
      });
    }
    addMenuItem('Cambiar icono...', () => window.mdIconPicker.open(node.nombre, (iconName) => setFileIcon(node, iconName)));
    if (fileIcons[relKeyFor(node)]) {
      addMenuItem('Quitar icono personalizado', () => setFileIcon(node, null));
    }
  }

  const target = node ? node.ruta : window.mdState.rootFolder;
  if (target) {
    addMenuItem('Copiar ruta', () => window.mdEditor.clipboardWriteText(target));
    if (node) addMenuItem('Copiar ruta relativa', () => window.mdEditor.clipboardWriteText(window.mdEditor.relativeToRoot(window.mdState.rootFolder, node.ruta)));
  }

  if (!node || node.esCarpeta) addMenuItem('🖼 Explorar multimedia de la carpeta', () => window.mdMediaBrowser && window.mdMediaBrowser.open());

  // Terminal integrada: en una carpeta (o la raíz) abre ahí; en un archivo,
  // en la carpeta que lo contiene. Y las IAs de terminal sobre ese archivo.
  if (window.mdTerminal && (!window.mdModules || window.mdModules.isOn('terminal'))) {
    const termDir = node && !node.esCarpeta ? window.mdEditor.dirName(node.ruta) : dirPath;
    addMenuItem('Abrir terminal aquí', () => window.mdTerminal.newTerminal(termDir));
    const aiTarget = node ? node.ruta : dirPath;
    const isFolder = !node || node.esCarpeta;
    if (aiTarget) {
      window.mdTerminal.AI_TOOLS.forEach((tool) => {
        addMenuItem(`🤖 Abrir con ${tool.label}`, () => window.mdTerminal.openWithAI(tool.id, aiTarget, { isFolder }));
      });
    }
  }

  if (node) {
    addMenuItem('Renombrar...', () => renameEntry(node));
    addMenuItem('Eliminar', () => deleteEntry(node));
  }

  positionSidebarMenu(x, y);
}

document.addEventListener('click', (e) => {
  if (!sidebarMenuEl.contains(e.target)) hideSidebarMenu();
  if (!e.target.closest('.tree-row')) clearSelection();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideSidebarMenu();
    clearSelection();
  }
});

// Refrescar el árbol contra el disco: si agregaste/borraste/renombraste
// algo desde afuera de MK (terminal, otro programa) mientras la carpeta
// ya estaba abierta, el sidebar no se entera solo — este botón vuelve a
// leer la carpeta actual y redibuja. No hace nada si no hay carpeta abierta.
document.getElementById('btn-refresh-tree').addEventListener('click', () => refreshTree());

const DRAG_MIME = 'application/x-mk-node';

// Indirección propia (no llamar window.mdEditor.startFileDrag directo acá
// abajo) solo para poder testear que se dispara: window.mdEditor viene de
// contextBridge y sale congelado (Object.isFrozen), no se puede mockear
// reasignando sus propiedades como sí se hace con window.alert/confirm.
let startFileDrag = (filePath) => window.mdEditor.startFileDrag(filePath);

// Arrastrar cualquier fila (archivo o carpeta) para soltarla sobre una
// carpeta (o la raíz) y moverla ahí. Solo carpetas son destino válido. Si la
// fila arrastrada es parte de una selección múltiple activa, se arrastran
// todas juntas — si no, solo esa (el payload siempre es un array, para no
// tener dos formatos de datos distintos según el caso).
function makeDraggable(row, node) {
  row.draggable = true;
  row.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    const nodes = selectedNodes.size > 1 && selectedNodes.has(node.ruta)
      ? Array.from(selectedNodes.values())
      : [node];
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(nodes.map((n) => ({ ruta: n.ruta, esCarpeta: n.esCarpeta, nombre: n.nombre }))));
    // Soltarlo AFUERA de MK (explorador de archivos, navegador, otra app):
    // text/uri-list es el formato estándar de "archivo arrastrado".
    e.dataTransfer.setData('text/uri-list', nodes.map((n) => 'file://' + encodeURI(n.ruta)).join('\r\n'));
    e.dataTransfer.setData('text/plain', nodes.map((n) => n.ruta).join('\n'));

    // Alt+arrastrar un archivo: drag NATIVO del sistema (webContents.startDrag),
    // para apps que no aceptan text/uri-list. Solo con Alt: antes se lanzaba
    // siempre, y en Electron 44 el drag nativo reemplaza al interno — mover
    // un archivo a otra carpeta del sidebar dejaba de funcionar.
    if (e.altKey && nodes.length === 1 && !node.esCarpeta) {
      e.preventDefault();
      startFileDrag(node.ruta);
    }
  });
}

function makeDropTarget(el, getDestDir) {
  el.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-over');
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    moveEntries(Array.isArray(parsed) ? parsed : [parsed], getDestDir());
  });
}

function buildTree(nodes) {
  const ul = document.createElement('ul');
  ul.className = 'tree';

  for (const node of nodes) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'tree-row';
    row._node = node;
    row.classList.toggle('tree-row-active', node.ruta === window.mdState.currentFilePath);
    if (highlightPath && node.ruta === highlightPath) {
      row.classList.add('tree-row-new');
      setTimeout(() => row.classList.remove('tree-row-new'), 1800);
      requestAnimationFrame(() => row.scrollIntoView({ block: 'nearest' }));
    }
    if (selectedNodes.has(node.ruta)) row.classList.add('tree-row-selected'); // sobrevive a un refreshTree() de otra acción
    if (!node.esCarpeta && unsavedPaths().has(node.ruta)) row.classList.add('tree-row-unsaved');
    makeDraggable(row, node);

    const iconEl = document.createElement('span');
    iconEl.className = 'tree-icon';
    iconEl.innerHTML = `<i data-lucide="${iconFor(node)}"></i>`;
    row.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.className = 'tree-name';
    labelEl.textContent = node.nombre;
    row.appendChild(labelEl);

    const actions = document.createElement('button');
    actions.type = 'button';
    actions.className = 'tree-actions';
    actions.title = `Acciones de ${node.nombre}`;
    actions.setAttribute('aria-label', actions.title);
    actions.innerHTML = '<i data-lucide="ellipsis"></i>';
    actions.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = actions.getBoundingClientRect();
      if (selectedNodes.size > 1 && selectedNodes.has(node.ruta)) {
        showSidebarMenu(rect.left, rect.bottom, null, Array.from(selectedNodes.values()));
      } else {
        clearSelection();
        showSidebarMenu(rect.left, rect.bottom, node);
      }
    });
    row.appendChild(actions);

    li.appendChild(row);
    li.setAttribute('role', 'none');
    row.setAttribute('role', 'treeitem');
    row.tabIndex = -1;
    row.setAttribute('aria-label', node.nombre);

    // Ctrl/Cmd+clic en cualquier fila (archivo o carpeta) la suma/saca de la
    // selección múltiple, y Shift+clic selecciona el rango desde la última
    // fila clicada, en vez de abrirla/plegarla — ver handleSelectionClick.
    if (node.esCarpeta) {
      row.classList.add('tree-folder');
      const childrenUl = buildTree(node.hijos || []);
      const startsOpen = expandedDirs.has(node.ruta);
      if (!startsOpen) childrenUl.classList.add('collapsed');
      else iconEl.innerHTML = '<i data-lucide="folder-open"></i>';
      childrenUl.setAttribute('role', 'group');
      row.setAttribute('aria-expanded', String(startsOpen));
      li.appendChild(childrenUl);
      row.addEventListener('click', (e) => {
        if (handleSelectionClick(e, row, node)) return;
        clearSelection();
        const collapsed = childrenUl.classList.toggle('collapsed');
        row.setAttribute('aria-expanded', String(!collapsed));
        if (collapsed) expandedDirs.delete(node.ruta); else expandedDirs.add(node.ruta);
        iconEl.innerHTML = `<i data-lucide="${collapsed ? 'folder' : 'folder-open'}"></i>`;
        if (window.lucide) window.lucide.createIcons({ attrs: { width: 14, height: 14, 'stroke-width': 2 }, root: iconEl });
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedNodes.size > 1 && selectedNodes.has(node.ruta)) {
          showSidebarMenu(e.clientX, e.clientY, null, Array.from(selectedNodes.values()));
        } else {
          clearSelection();
          showSidebarMenu(e.clientX, e.clientY, node);
        }
      });
      makeDropTarget(row, () => node.ruta);
    } else {
      row.classList.add('tree-file');
      row.addEventListener('click', (e) => {
        if (handleSelectionClick(e, row, node)) return;
        clearSelection();
        if (extOf(node) === 'pdf') {
          window.showPdfPreview(node.ruta);
        } else if (window.mdMedia.kindOf(node.nombre)) {
          window.showMediaPreview(node.ruta);
        } else {
          window.openFileAtPath(node.ruta);
        }
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedNodes.size > 1 && selectedNodes.has(node.ruta)) {
          showSidebarMenu(e.clientX, e.clientY, null, Array.from(selectedNodes.values()));
        } else {
          clearSelection();
          showSidebarMenu(e.clientX, e.clientY, node);
        }
      });
    }

    ul.appendChild(li);
  }

  return ul;
}

function renderFolder(result) {
  currentTreeResult = result;
  window.mdState.rootFolder = result.rootPath;
  watchRoot(result.rootPath);
  if (window.mdHome) window.mdHome.rootChanged(); // el Home puede vivir en la carpeta
  sidebarPane.innerHTML = '';

  const parentPath = window.mdEditor.dirName(result.rootPath);
  if (parentPath && parentPath !== result.rootPath) {
    const upRow = document.createElement('div');
    upRow.className = 'tree-row tree-up';
    upRow.title = 'Subir a la carpeta superior';
    upRow.innerHTML = '<span class="tree-icon"><i data-lucide="arrow-up"></i></span><span>..</span>';
    upRow.addEventListener('click', goToParent);
    makeDropTarget(upRow, () => parentPath);
    sidebarPane.appendChild(upRow);
  }

  const rootLabel = document.createElement('div');
  rootLabel.className = 'tree-root-label';
  const rootIconEl = document.createElement('span');
  rootIconEl.className = 'tree-icon';
  rootIconEl.innerHTML = '<i data-lucide="folder-open"></i>';
  rootLabel.appendChild(rootIconEl);
  rootLabel.appendChild(document.createTextNode(result.rootPath.split(/[\\/]/).pop()));
  rootLabel.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showSidebarMenu(e.clientX, e.clientY, null);
  });
  makeDropTarget(rootLabel, () => result.rootPath);
  sidebarPane.appendChild(rootLabel);
  const treeEl = buildTree(result.tree);
  treeEl.setAttribute('role', 'tree');
  treeEl.setAttribute('aria-label', 'Archivos de la carpeta');
  sidebarPane.appendChild(treeEl);
  if (!result.tree.length) {
    const empty = document.createElement('div');
    empty.className = 'sidebar-empty';
    const message = document.createElement('p');
    message.textContent = 'Esta carpeta está vacía.';
    const create = document.createElement('button');
    create.className = 'toolbar-button';
    create.textContent = 'Crear nota';
    create.addEventListener('click', () => createEntry(result.rootPath, false));
    empty.append(message, create);
    sidebarPane.appendChild(empty);
  }
  const firstRow = treeEl.querySelector('.tree-row');
  window.mdNoteAccess.mount(sidebarPane, result.tree);
  if (firstRow) firstRow.tabIndex = 0; // Tab entra al árbol; las flechas se mueven adentro

  if (window.lucide) {
    window.lucide.createIcons({ attrs: { width: 14, height: 14, 'stroke-width': 2 }, root: sidebarPane });
  }
}

document.getElementById('btn-open-folder').addEventListener('click', async () => {
  const result = await window.mdEditor.openFolder();
  if (!result) return;
  renderFolder(result);
});

(async () => {
  const config = await window.mdEditor.getConfig();
  fileIcons = config.fileIcons || {};
  const result = await window.mdEditor.getLastFolder();
  if (result) renderFolder(result);
})();

// Punto junto a los archivos con cambios sin guardar (ver tabs.js).
function unsavedPaths() {
  return new Set(window.mdTabs && window.mdTabs.getModifiedPaths ? window.mdTabs.getModifiedPaths() : []);
}

document.addEventListener('mk:modified-changed', () => {
  const unsaved = unsavedPaths();
  sidebarPane.querySelectorAll('.tree-row').forEach((row) => {
    row.classList.toggle('tree-row-unsaved', !!(row._node && !row._node.esCarpeta && unsaved.has(row._node.ruta)));
  });
});

document.addEventListener('mk:active-file-changed', () => {
  sidebarPane.querySelectorAll('.tree-row').forEach((row) => {
    row.classList.toggle('tree-row-active', !!row._node && row._node.ruta === window.mdState.currentFilePath);
  });
});

// Teclado en el árbol: ↑/↓ recorren las filas visibles, Enter/Espacio abren,
// → despliega una carpeta, ← la pliega (o sube a la carpeta que la contiene).
function visibleRows() {
  return Array.from(sidebarPane.querySelectorAll('.tree-row[role="treeitem"]')).filter((r) => !r.closest('ul.collapsed'));
}

function focusRow(row) {
  if (!row) return;
  sidebarPane.querySelectorAll('.tree-row[tabindex="0"]').forEach((r) => { r.tabIndex = -1; });
  row.tabIndex = 0;
  row.focus();
  row.scrollIntoView({ block: 'nearest' });
}

sidebarPane.addEventListener('keydown', (e) => {
  const row = e.target.closest && e.target.closest('.tree-row[role="treeitem"]');
  if (!row || e.target.closest('input, button')) return;
  const rows = visibleRows();
  const i = rows.indexOf(row);
  const expanded = row.getAttribute('aria-expanded');
  if (e.key === 'ArrowDown') focusRow(rows[i + 1]);
  else if (e.key === 'ArrowUp') focusRow(rows[i - 1]);
  else if (e.key === 'Home') focusRow(rows[0]);
  else if (e.key === 'End') focusRow(rows[rows.length - 1]);
  else if (e.key === 'Enter' || e.key === ' ') row.click();
  else if (e.key === 'ArrowRight' && expanded === 'false') row.click();
  else if (e.key === 'ArrowLeft' && expanded === 'true') row.click();
  else if (e.key === 'ArrowLeft') {
    const parentUl = row.closest('ul[role="group"]');
    focusRow(parentUl && parentUl.parentElement && parentUl.parentElement.querySelector(':scope > .tree-row'));
  } else return;
  e.preventDefault();
});

window.mdSidebar = {
  renderFolder, setFileIcon, createEntry, renameEntry, deleteEntry, moveEntry, goToParent, refreshTree,
  moveEntries, deleteEntries,
  // Solo para test/renderer-checks.js: togglear selección sin simular
  // Ctrl+clic de verdad.
  toggleSelectionForTest: (node) => {
    const row = Array.from(sidebarPane.querySelectorAll('.tree-row')).find((r) => r.textContent.trim() === node.nombre);
    if (row) toggleSelection(row, node);
  },
  getSelectedForTest: () => Array.from(selectedNodes.values()),
  setStartFileDragForTest: (fn) => { startFileDrag = fn; }
};

})();
