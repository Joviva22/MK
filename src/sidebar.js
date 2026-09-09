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
async function relocateEntry(node, newPath) {
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
  await refreshTree();
}

async function renameEntry(node) {
  const newName = prompt('Nuevo nombre:', node.nombre);
  if (!newName || !newName.trim() || newName.trim() === node.nombre) return;
  const result = await window.mdEditor.renamePath(node.ruta, newName.trim());
  if (result.error) {
    alert(result.error);
    return;
  }
  await relocateEntry(node, result.path);
}

async function moveEntry(node, destDir) {
  if (window.mdEditor.dirName(node.ruta) === destDir) return; // ya está ahí
  const result = await window.mdEditor.movePath(node.ruta, destDir);
  if (result.error) {
    alert(result.error);
    return;
  }
  await relocateEntry(node, result.path);
}

async function deleteEntry(node) {
  const label = node.esCarpeta ? `la carpeta "${node.nombre}" y todo su contenido` : `el archivo "${node.nombre}"`;
  if (!confirm(`¿Eliminar ${label}? Se intenta mandar a la papelera del sistema (se puede restaurar desde ahí); si no hay papelera disponible, se borra directo.`)) return;
  const result = await window.mdEditor.deletePath(node.ruta, node.esCarpeta);
  if (result.error) {
    alert(result.error);
    return;
  }
  const key = relKeyFor(node);
  if (fileIcons[key]) {
    delete fileIcons[key];
    await window.mdEditor.setConfig({ fileIcons });
  }
  await refreshTree();
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

// node === null → click derecho en la raíz de la carpeta (solo crear, no
// tiene sentido "renombrar/eliminar" la carpeta que la app tiene abierta).
function showSidebarMenu(x, y, node) {
  sidebarMenuEl.innerHTML = '';

  const dirPath = node ? (node.esCarpeta ? node.ruta : window.mdState.rootFolder) : window.mdState.rootFolder;

  if (!node || node.esCarpeta) {
    addMenuItem('Nuevo archivo...', () => createEntry(dirPath, false));
    addMenuItem('Nueva carpeta...', () => createEntry(dirPath, true));
  }

  if (node && !node.esCarpeta) {
    addMenuItem('Cambiar icono...', () => window.mdIconPicker.open(node.nombre, (iconName) => setFileIcon(node, iconName)));
    if (fileIcons[relKeyFor(node)]) {
      addMenuItem('Quitar icono personalizado', () => setFileIcon(node, null));
    }
  }

  if (node) {
    addMenuItem('Renombrar...', () => renameEntry(node));
    addMenuItem('Eliminar', () => deleteEntry(node));
  }

  sidebarMenuEl.style.left = `${x}px`;
  sidebarMenuEl.style.top = `${y}px`;
  sidebarMenuEl.hidden = false;

  const rect = sidebarMenuEl.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 4;
  const maxY = window.innerHeight - rect.height - 4;
  if (x > maxX) sidebarMenuEl.style.left = `${Math.max(4, maxX)}px`;
  if (y > maxY) sidebarMenuEl.style.top = `${Math.max(4, maxY)}px`;
}

document.addEventListener('click', (e) => {
  if (!sidebarMenuEl.contains(e.target)) hideSidebarMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideSidebarMenu();
});

const DRAG_MIME = 'application/x-mk-node';

// Arrastrar cualquier fila (archivo o carpeta) para soltarla sobre una
// carpeta (o la raíz) y moverla ahí. Solo carpetas son destino válido.
function makeDraggable(row, node) {
  row.draggable = true;
  row.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ ruta: node.ruta, esCarpeta: node.esCarpeta, nombre: node.nombre }));
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
    const draggedNode = JSON.parse(raw);
    moveEntry(draggedNode, getDestDir());
  });
}

function buildTree(nodes) {
  const ul = document.createElement('ul');
  ul.className = 'tree';

  for (const node of nodes) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'tree-row';
    makeDraggable(row, node);

    const iconEl = document.createElement('span');
    iconEl.className = 'tree-icon';
    iconEl.innerHTML = `<i data-lucide="${iconFor(node)}"></i>`;
    row.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.textContent = node.nombre;
    row.appendChild(labelEl);

    li.appendChild(row);

    if (node.esCarpeta) {
      const childrenUl = buildTree(node.hijos || []);
      childrenUl.classList.add('collapsed');
      li.appendChild(childrenUl);
      row.addEventListener('click', () => {
        const collapsed = childrenUl.classList.toggle('collapsed');
        iconEl.innerHTML = `<i data-lucide="${collapsed ? 'folder' : 'folder-open'}"></i>`;
        if (window.lucide) window.lucide.createIcons({ attrs: { width: 14, height: 14, 'stroke-width': 2 }, root: iconEl });
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSidebarMenu(e.clientX, e.clientY, node);
      });
      makeDropTarget(row, () => node.ruta);
    } else {
      row.classList.add('tree-file');
      row.addEventListener('click', () => {
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
        showSidebarMenu(e.clientX, e.clientY, node);
      });
    }

    ul.appendChild(li);
  }

  return ul;
}

function renderFolder(result) {
  currentTreeResult = result;
  window.mdState.rootFolder = result.rootPath;
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

window.mdSidebar = { renderFolder, setFileIcon, createEntry, renameEntry, deleteEntry, moveEntry, goToParent, refreshTree };

})();
