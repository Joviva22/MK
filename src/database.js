import { state, root, overlay, listEl, newBtn, emptyEl, contentEl, nameInput, deleteBtn, filterInput, addColumnBtn, addRowBtn, filtersBtn } from './database-state.js';
import { activePopover, closePopover, loadRelatedData } from './database-helpers.js';
import { chartData, duplicateRow, openFiltersPopover, renderView, renderViewTabs } from './database-views.js';
import { openColumnEditor } from './database-cells.js';
import { exportCsv, importCsv, inferColumn, parseCsv } from './database-csv.js';
import { openWithFilter, parseEmbedSpec, renderEmbed, searchRows, widgetTotal } from './database-embed.js';

'use strict';

// Panel de "Bases de datos" tipo Notion: columnas tipadas, relaciones entre
// bases (FK real en SQLite, ver src/dbengine.js), fórmulas y rollups
// calculados en database-helpers.js (el motor solo guarda valores crudos), y
// vistas en database-views.js. Este archivo es el núcleo: sidebar de bases,
// abrir/cerrar el panel y el cableado de sus botones.
//
// Partido en varios módulos ES (ver OBJETIVOS.md): database-state.js (DOM,
// constantes, estado), database-helpers.js (valores de celda, popover
// genérico), database-views.js (vistas), database-cells.js (celdas y
// editor de columnas), database-csv.js (CSV), database-embed.js (bloque
// ```database``` en notas). Se cargan solos: alcanza con el <script
// type="module"> de este archivo, los imports resuelven el resto.

export async function loadDatabases() {
  state.databases = await window.mdEditor.db.listDatabases(root());
  renderSidebar();
}

function renderSidebar() {
  listEl.innerHTML = '';
  state.databases.forEach((d) => {
    const item = document.createElement('div');
    item.className = 'database-list-item' + (d.id === state.databaseId ? ' database-list-item-active' : '');
    item.textContent = (d.icon ? d.icon + ' ' : '') + d.name;
    item.addEventListener('click', () => selectDatabase(d.id));
    listEl.appendChild(item);
  });
}

export async function selectDatabase(id) {
  state.databaseId = id;
  state.filter = '';
  filterInput.value = '';
  const db = state.databases.find((d) => d.id === id);

  const [columns, rows, views] = await Promise.all([
    window.mdEditor.db.listColumns(root(), id),
    window.mdEditor.db.listRows(root(), id),
    window.mdEditor.db.listViews(root(), id)
  ]);
  state.columns = columns;
  state.rows = rows;
  state.views = views;
  state.viewId = views.length ? views[0].id : null;

  await loadRelatedData();

  emptyEl.hidden = true;
  contentEl.hidden = false;
  nameInput.value = db ? db.name : '';
  renderSidebar();
  renderViewTabs();
  renderView();
}

async function createDatabase() {
  const db = await window.mdEditor.db.createDatabase(root(), 'Nueva base de datos');
  await loadDatabases();
  await selectDatabase(db.id);
  nameInput.focus();
  nameInput.select();
}

async function deleteCurrentDatabase() {
  if (!state.databaseId) return;
  const db = state.databases.find((d) => d.id === state.databaseId);
  if (!confirm(`¿Eliminar la base de datos "${db ? db.name : ''}"? Esta acción no se puede deshacer.`)) return;
  await window.mdEditor.db.deleteDatabase(root(), state.databaseId);
  state.databaseId = null;
  await loadDatabases();
  emptyEl.hidden = false;
  contentEl.hidden = true;
}

// ---- wiring ----

newBtn.addEventListener('click', createDatabase);
deleteBtn.addEventListener('click', deleteCurrentDatabase);
addColumnBtn.addEventListener('click', () => openColumnEditor(addColumnBtn, null));
addRowBtn.addEventListener('click', async () => {
  await window.mdEditor.db.createRow(root(), state.databaseId, null);
  state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
  renderView();
});
filtersBtn.addEventListener('click', () => openFiltersPopover());
document.getElementById('database-export-btn').addEventListener('click', exportCsv);
document.getElementById('database-import-btn').addEventListener('click', importCsv);
filterInput.addEventListener('input', () => { state.filter = filterInput.value; renderView(); });
nameInput.addEventListener('change', async () => {
  if (!state.databaseId) return;
  await window.mdEditor.db.renameDatabase(root(), state.databaseId, nameInput.value.trim() || 'Sin título');
  await loadDatabases();
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden && !activePopover) close();
});

export async function open(databaseId) {
  if (databaseId) state.databaseId = databaseId;
  if (!root()) {
    overlay.hidden = false;
    emptyEl.hidden = false;
    emptyEl.textContent = 'Abrí una carpeta primero: las bases de datos se guardan dentro de ella (.mk/databases.sqlite3).';
    contentEl.hidden = true;
    return;
  }
  overlay.hidden = false;
  await loadDatabases();
  if (state.databaseId) {
    await selectDatabase(state.databaseId);
  } else if (state.databases.length) {
    await selectDatabase(state.databases[0].id);
  } else {
    emptyEl.hidden = false;
    contentEl.hidden = true;
  }
}

export function close() {
  closePopover();
  overlay.hidden = true;
}

window.mdDatabase = { widgetTotal, open, openWithFilter, searchRows, renderEmbed, parseEmbedSpec, close, parseCsv, inferColumn, duplicateRow, chartData };
