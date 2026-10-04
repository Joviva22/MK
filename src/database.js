import { state, root, overlay, listEl, newBtn, emptyEl, contentEl, nameInput, deleteBtn, filterInput, addColumnBtn, addRowBtn, filtersBtn } from './database-state.js';
import { activePopover, closePopover, loadRelatedData } from './database-helpers.js';
import { chartData, duplicateRow, openFiltersPopover, renderView, renderViewTabs } from './database-views.js';
import { openColumnEditor, openRowEditor } from './database-cells.js';
import { chooseDatabase, renderWelcome } from './database-onboarding.js';
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
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'database-list-item' + (d.id === state.databaseId ? ' database-list-item-active' : '');
    item.textContent = (d.icon ? d.icon + ' ' : '') + d.name;
    item.title = d.name;
    item.setAttribute('aria-current', String(d.id === state.databaseId));
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
  closePopover();
  if (!root()) { await open(); return; }
  const db = await chooseDatabase();
  if (!db) return;
  await loadDatabases();
  await selectDatabase(db.id);
  nameInput.focus();
  nameInput.select();
  window.mdNotify.success('Base de datos creada', db.name, 'database-created');
}

async function deleteCurrentDatabase() {
  if (!state.databaseId) return;
  const db = state.databases.find((d) => d.id === state.databaseId);
  if (!await window.mdConfirm(`Eliminar ${db ? db.name : 'esta base'}`, { description: 'Se eliminarán todas sus filas, columnas y vistas. Esta acción no se puede deshacer.', actionLabel: 'Eliminar base', danger: true })) return;
  await window.mdEditor.db.deleteDatabase(root(), state.databaseId);
  state.databaseId = null;
  await loadDatabases();
  if (state.databases.length) await selectDatabase(state.databases[0].id);
  else { emptyEl.hidden = false; contentEl.hidden = true; renderWelcome(createDatabase, openFolder); }
  window.mdNotify.success('Base de datos eliminada', db?.name, 'database-deleted');
}

// ---- wiring ----

newBtn.addEventListener('click', createDatabase);
deleteBtn.addEventListener('click', deleteCurrentDatabase);
addColumnBtn.addEventListener('click', () => openColumnEditor(addColumnBtn, null));
addRowBtn.addEventListener('click', async () => {
  const rowId = await window.mdEditor.db.createRow(root(), state.databaseId, null);
  state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
  renderView();
  const input = [...document.querySelectorAll('#database-view-body .database-table tbody tr')].find(tr => tr.dataset.rowId === rowId)?.querySelector('input, button');
  if (input) { input.focus(); input.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  else openRowEditor(state.rows.find(r => r.id === rowId));
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

const guide = document.getElementById('database-guide');
guide.innerHTML = '<strong>Una tabla para organizar lo que necesites</strong><p><b>Fila:</b> un libro, proyecto o tema. <b>Columna:</b> un dato de ese elemento, como su nombre, estado o fecha.</p><p>1. Añade una fila y completa sus datos. 2. Añade columnas cuando necesites otro dato. 3. Elige una vista: tabla, tablero por estado o calendario por fecha.</p><p>Las vistas muestran las mismas filas. Los filtros solo cambian qué filas ves, sin borrarlas. Los cambios se guardan automáticamente en la carpeta abierta.</p>';
document.getElementById('database-help-btn').addEventListener('click', () => {
  guide.hidden = !guide.hidden;
  document.getElementById('database-help-btn').setAttribute('aria-expanded', String(!guide.hidden));
});
async function openFolder() {
  const result = await window.mdEditor.openFolder();
  if (!result) return;
  await window.mdEditor.setConfig({ lastFolder: result.rootPath });
  window.mdSidebar.renderFolder(result);
  await open();
}

export async function open(databaseId) {
  if (databaseId) state.databaseId = databaseId;
  const location = document.getElementById('database-location');
  location.textContent = root() ? `Carpeta: ${root().split('/').pop()}` : 'Sin carpeta abierta';
  location.title = root() || '';
  if (!root()) {
    listEl.replaceChildren();
    newBtn.disabled = true;
    document.getElementById('database-import-btn').disabled = true;
    overlay.hidden = false;
    emptyEl.hidden = false;
    renderWelcome(createDatabase, openFolder);
    contentEl.hidden = true;
    return;
  }
  overlay.hidden = false;
  newBtn.disabled = false;
  document.getElementById('database-import-btn').disabled = false;
  await loadDatabases();
  if (state.databases.some(db => db.id === state.databaseId)) {
    await selectDatabase(state.databaseId);
  } else if (state.databases.length) {
    await selectDatabase(state.databases[0].id);
  } else {
    state.databaseId = null;
    emptyEl.hidden = false;
    contentEl.hidden = true;
    renderWelcome(createDatabase, openFolder);
  }
}

export function close() {
  closePopover();
  overlay.hidden = true;
}

window.mdDatabase = { widgetTotal, open, openWithFilter, searchRows, renderEmbed, parseEmbedSpec, close, parseCsv, inferColumn, duplicateRow, chartData };
