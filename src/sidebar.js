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
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  mp4: 'video', webm: 'video',
  mp3: 'music'
};
const DEFAULT_FILE_ICON = 'paperclip';
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

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

function iconFor(node) {
  if (node.esCarpeta) return 'folder';
  return fileIcons[relKeyFor(node)] || ICONS_BY_EXT[extOf(node)] || DEFAULT_FILE_ICON;
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

async function refreshTree() {
  if (!currentTreeResult) return;
  const fresh = await window.mdEditor.readFolder(currentTreeResult.rootPath);
  if (fresh) renderFolder(fresh);
}

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
  const name = prompt(isFolder ? 'Nombre de la nueva carpeta:' : 'Nombre del nuevo archivo:');
  if (!name || !name.trim()) return;
  const result = isFolder
    ? await window.mdEditor.createFolder(dirPath, name.trim())
    : await window.mdEditor.createFile(dirPath, name.trim());
  if (result.error) {
    alert(result.error);
    return;
  }
  await refreshTree();
  if (!isFolder) window.openFileAtPath(result.path);
}

// Común a renombrar y mover: el archivo/carpeta pasó de node.ruta a
// newPath. Migra la clave del icono personalizado (guardada por ruta
// relativa a la raíz) y, si el archivo está abierto en una pestaña,
// actualiza esa pestaña para que no siga apuntando a la ruta vieja.
// Separado de refreshTree() para poder mover/eliminar varios de una y
// refrescar el árbol una sola vez al final, no una vez por elemento.
async function relocateEntryQuiet(node, newPath) {
  if (!node.esCarpeta) {
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
  const newName = prompt('Nuevo nombre:', node.nombre);
  if (!newName || !newName.trim() || newName.trim() === node.nombre) return;
  const result = await window.mdEditor.renamePath(node.ruta, newName.trim());
  if (result.error) {
    alert(result.error);
    return;
  }
  await relocateEntryQuiet(node, result.path);
  await refreshTree();
}

async function moveEntry(node, destDir) {
  if (window.mdEditor.dirName(node.ruta) === destDir) return; // ya está ahí
  const result = await window.mdEditor.movePath(node.ruta, destDir);
  if (result.error) {
    alert(result.error);
    return;
  }
  await relocateEntryQuiet(node, result.path);
  await refreshTree();
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
  }
  await refreshTree();
  clearSelection();
}

async function deleteEntryQuiet(node) {
  const result = await window.mdEditor.deletePath(node.ruta, node.esCarpeta);
  if (result.error) {
    alert(`${node.nombre}: ${result.error}`);
    return;
  }
  const key = relKeyFor(node);
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
    addMenuItem('Abrir en panel secundario', () => window.mdSecondaryPane.open(node.ruta));
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

  // Terminal integrada: en una carpeta (o la raíz) abre ahí; en un archivo,
  // en la carpeta que lo contiene.
  if (window.mdTerminal) {
    const termDir = node && !node.esCarpeta ? window.mdEditor.dirName(node.ruta) : dirPath;
    addMenuItem('Abrir terminal aquí', () => window.mdTerminal.newTerminal(termDir));
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

    // Además del drag interno de arriba (mover entre carpetas, adentro de
    // MK), un solo archivo (no carpeta, no selección múltiple) también se
    // puede arrastrar AFUERA de la ventana — a otra app, el navegador,
    // Claude para adjuntarlo, etc. Necesita el drag nativo del SO
    // (webContents.startDrag en main.js), el drag HTML5 de arriba no sale
    // de la ventana. No se pisan: cada uno lee un tipo de dato distinto.
    if (nodes.length === 1 && !node.esCarpeta) {
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
    if (selectedNodes.has(node.ruta)) row.classList.add('tree-row-selected'); // sobrevive a un refreshTree() de otra acción
    makeDraggable(row, node);

    const iconEl = document.createElement('span');
    iconEl.className = 'tree-icon';
    iconEl.innerHTML = `<i data-lucide="${iconFor(node)}"></i>`;
    row.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.textContent = node.nombre;
    row.appendChild(labelEl);

    li.appendChild(row);

    // Ctrl/Cmd+clic en cualquier fila (archivo o carpeta) la suma/saca de la
    // selección múltiple, y Shift+clic selecciona el rango desde la última
    // fila clicada, en vez de abrirla/plegarla — ver handleSelectionClick.
    if (node.esCarpeta) {
      const childrenUl = buildTree(node.hijos || []);
      childrenUl.classList.add('collapsed');
      li.appendChild(childrenUl);
      row.addEventListener('click', (e) => {
        if (handleSelectionClick(e, row, node)) return;
        clearSelection();
        const collapsed = childrenUl.classList.toggle('collapsed');
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
        } else if (IMAGE_EXT.test(node.nombre)) {
          window.showImagePreview(node.ruta);
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
  sidebarPane.appendChild(buildTree(result.tree));

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
