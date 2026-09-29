(function () {
'use strict';

// Panel de "Bases de datos" tipo Notion: columnas tipadas, relaciones entre
// bases (FK real en SQLite, ver src/dbengine.js), fórmulas y rollups
// calculados acá (el motor solo guarda valores crudos), y tres vistas por
// base de datos (tabla / tablero / galería). Mismo patrón que kanban.js:
// panel overlay + window.mdEditor para todo lo que toca disco.

const overlay = document.getElementById('database-panel');
const listEl = document.getElementById('database-list');
const newBtn = document.getElementById('database-new-btn');
const emptyEl = document.getElementById('database-empty');
const contentEl = document.getElementById('database-content');
const nameInput = document.getElementById('database-name-input');
const deleteBtn = document.getElementById('database-delete-btn');
const viewTabsEl = document.getElementById('database-view-tabs');
const filterInput = document.getElementById('database-filter-input');
const addColumnBtn = document.getElementById('database-add-column-btn');
const addRowBtn = document.getElementById('database-add-row-btn');
const viewBodyEl = document.getElementById('database-view-body');

const COLUMN_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'checkbox', label: 'Casilla' },
  { value: 'select', label: 'Selección única' },
  { value: 'multiselect', label: 'Selección múltiple' },
  { value: 'relation', label: 'Relación' },
  { value: 'formula', label: 'Fórmula' },
  { value: 'rollup', label: 'Rollup' },
  { value: 'created_time', label: 'Fecha de creación' }
];

const CHOICE_COLORS = ['#e07a5f', '#81b29a', '#3d5a80', '#f2cc8f', '#9d8189', '#118ab2', '#ef476f', '#6d597a'];

const AGGREGATIONS = [
  { value: 'count', label: 'Cantidad' },
  { value: 'sum', label: 'Suma' },
  { value: 'avg', label: 'Promedio' },
  { value: 'min', label: 'Mínimo' },
  { value: 'max', label: 'Máximo' },
  { value: 'unique', label: 'Valores únicos' }
];

const state = {
  databases: [],
  databaseId: null,
  columns: [],
  rows: [],
  views: [],
  viewId: null,
  relatedData: {}, // databaseId -> { columns, rows }
  filter: ''
};

function root() {
  return window.mdState.rootFolder;
}

// ---- helpers de datos ----

function parseOptions(column) {
  try {
    return column && column.options ? JSON.parse(column.options) : {};
  } catch (e) {
    return {};
  }
}

function parseView(view) {
  try {
    return view && view.config ? JSON.parse(view.config) : {};
  } catch (e) {
    return {};
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function findChoice(column, choiceId) {
  const opts = parseOptions(column);
  return (opts.choices || []).find((c) => c.id === choiceId) || null;
}

function currentViewObj() {
  return state.views.find((v) => v.id === state.viewId) || null;
}

function findColumn(columns, id) {
  return columns.find((c) => c.id === id) || null;
}

function relatedRowTitle(targetData, rowId) {
  if (!targetData) return '';
  const row = targetData.rows.find((r) => r.id === rowId);
  if (!row) return '(eliminada)';
  const titleCol = targetData.columns[0];
  if (!titleCol) return '(sin nombre)';
  const v = cellDisplayValue(titleCol, row, targetData.columns, { seen: new Set() });
  return Array.isArray(v) ? v.join(', ') : (v == null || v === '' ? '(sin nombre)' : String(v));
}

// Devuelve el valor "tipado" de una celda: string para texto/fecha/select,
// number para número, boolean para casilla, array de strings para multi-
// select/relación. Fórmulas y rollups se resuelven acá mismo recursivamente
// (con guarda anti-ciclos vía ctx.seen) porque el motor SQLite solo guarda
// valores crudos, no sabe de expresiones.
function cellDisplayValue(column, row, columns, ctx) {
  ctx = ctx || { seen: new Set() };
  switch (column.type) {
    case 'number': {
      const raw = row.cells[column.id];
      return raw != null && raw !== '' ? Number(raw) : null;
    }
    case 'checkbox':
      return row.cells[column.id] === '1';
    case 'date':
      return row.cells[column.id] || null;
    case 'select': {
      const choice = findChoice(column, row.cells[column.id]);
      return choice ? choice.label : '';
    }
    case 'multiselect': {
      const ids = parseJsonArray(row.cells[column.id]);
      return ids.map((id) => { const c = findChoice(column, id); return c ? c.label : null; }).filter(Boolean);
    }
    case 'relation': {
      const targetIds = row.relations[column.id] || [];
      const opts = parseOptions(column);
      const target = state.relatedData[opts.targetDatabaseId];
      return targetIds.map((rid) => relatedRowTitle(target, rid));
    }
    case 'created_time':
      return row.createdAt || null;
    case 'formula':
      return evalFormula(column, row, columns, ctx);
    case 'rollup':
      return evalRollup(column, row, columns, ctx);
    default:
      return row.cells[column.id] || '';
  }
}

function evalFormula(column, row, columns, ctx) {
  if (ctx.seen.has(column.id)) return null;
  const nextCtx = { seen: new Set(ctx.seen) };
  nextCtx.seen.add(column.id);
  const opts = parseOptions(column);
  const expr = opts.expr || '';
  if (!expr.trim()) return null;
  const byName = {};
  columns.forEach((c) => { byName[c.name] = c; });
  const propFn = (name) => {
    const c = byName[name];
    if (!c) return null;
    const v = cellDisplayValue(c, row, columns, nextCtx);
    return v;
  };
  try {
    const fn = new Function('prop', 'Math', '"use strict"; return (' + expr + ');');
    return fn(propFn, Math);
  } catch (e) {
    return '#ERROR';
  }
}

function evalRollup(column, row, columns, ctx) {
  if (ctx.seen.has(column.id)) return null;
  const opts = parseOptions(column);
  const relCol = findColumn(columns, opts.relationColumnId);
  if (!relCol) return null;
  const relOpts = parseOptions(relCol);
  const target = state.relatedData[relOpts.targetDatabaseId];
  if (!target) return null;
  const targetCol = findColumn(target.columns, opts.targetColumnId);
  if (!targetCol) return null;
  const targetRowIds = row.relations[relCol.id] || [];
  const nextCtx = { seen: new Set(ctx.seen) };
  nextCtx.seen.add(column.id);
  const values = targetRowIds
    .map((rid) => target.rows.find((r) => r.id === rid))
    .filter(Boolean)
    .map((trow) => cellDisplayValue(targetCol, trow, target.columns, nextCtx))
    .filter((v) => v != null && v !== '');

  switch (opts.aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + Number(b || 0), 0);
    case 'avg':
      return values.length ? values.reduce((a, b) => a + Number(b || 0), 0) / values.length : null;
    case 'min':
      return values.length ? Math.min(...values.map(Number)) : null;
    case 'max':
      return values.length ? Math.max(...values.map(Number)) : null;
    case 'unique':
      return new Set(values.map(String)).size;
    case 'count':
    default:
      return targetRowIds.length;
  }
}

function displayText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
  return String(value);
}

// ---- carga de datos relacionados (para relaciones/rollups) ----

async function loadRelatedData() {
  const targetIds = new Set();
  state.columns.forEach((col) => {
    const opts = parseOptions(col);
    if (col.type === 'relation' && opts.targetDatabaseId) targetIds.add(opts.targetDatabaseId);
    if (col.type === 'rollup' && opts.relationColumnId) {
      const relCol = findColumn(state.columns, opts.relationColumnId);
      const relOpts = relCol ? parseOptions(relCol) : {};
      if (relOpts.targetDatabaseId) targetIds.add(relOpts.targetDatabaseId);
    }
  });

  const entries = await Promise.all(Array.from(targetIds).map(async (dbId) => {
    const [columns, rows] = await Promise.all([
      window.mdEditor.db.listColumns(root(), dbId),
      window.mdEditor.db.listRows(root(), dbId)
    ]);
    return [dbId, { columns, rows }];
  }));

  state.relatedData = Object.fromEntries(entries);
  // La propia base también puede ser blanco de una relación hacia sí misma.
  state.relatedData[state.databaseId] = { columns: state.columns, rows: state.rows };
}

// ---- popover genérico ----

let activePopover = null;

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  document.removeEventListener('mousedown', onOutsideClick, true);
  document.removeEventListener('keydown', onPopoverKeydown, true);
}

function onOutsideClick(e) {
  if (activePopover && !activePopover.contains(e.target)) closePopover();
}

function onPopoverKeydown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closePopover();
  }
}

function openPopover(anchorEl, className, build) {
  closePopover();
  const pop = document.createElement('div');
  pop.className = 'database-popover ' + className;
  document.body.appendChild(pop);
  build(pop, closePopover);

  const rect = anchorEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  let left = rect.left;
  if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
  let top = rect.bottom + 4;
  if (top + popRect.height > window.innerHeight - 8) top = rect.top - popRect.height - 4;
  pop.style.left = Math.max(8, left) + 'px';
  pop.style.top = Math.max(8, top) + 'px';

  activePopover = pop;
  setTimeout(() => {
    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onPopoverKeydown, true);
  }, 0);
  return pop;
}

// ---- sidebar de bases de datos ----

async function loadDatabases() {
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

async function selectDatabase(id) {
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

// ---- vistas (tabla / tablero / galería) ----

function renderViewTabs() {
  viewTabsEl.innerHTML = '';
  state.views.forEach((v) => {
    const tab = document.createElement('button');
    tab.className = 'toolbar-button database-view-tab' + (v.id === state.viewId ? ' database-view-tab-active' : '');
    tab.textContent = viewTypeIcon(v.type) + ' ' + v.name;
    tab.addEventListener('click', () => { state.viewId = v.id; renderViewTabs(); renderView(); });
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openViewMenu(tab, v);
    });
    viewTabsEl.appendChild(tab);
  });
  const addTab = document.createElement('button');
  addTab.className = 'toolbar-button';
  addTab.title = 'Nueva vista';
  addTab.textContent = '+ Vista';
  addTab.addEventListener('click', () => openNewViewPopover(addTab));
  viewTabsEl.appendChild(addTab);
}

function viewTypeIcon(type) {
  return { table: '▤', board: '▥', gallery: '▦' }[type] || '▤';
}

function openNewViewPopover(anchorEl) {
  openPopover(anchorEl, 'database-view-popover', (pop, close) => {
    const title = document.createElement('div');
    title.className = 'database-popover-title';
    title.textContent = 'Nueva vista';
    pop.appendChild(title);
    [['table', 'Tabla'], ['board', 'Tablero'], ['gallery', 'Galería']].forEach(([type, label]) => {
      const btn = document.createElement('button');
      btn.className = 'toolbar-button database-popover-row';
      btn.textContent = viewTypeIcon(type) + ' ' + label;
      btn.addEventListener('click', async () => {
        close();
        const config = type === 'board' ? { groupBy: defaultGroupableColumn() } : {};
        const view = await window.mdEditor.db.createView(root(), state.databaseId, { name: label, type, config });
        state.views = await window.mdEditor.db.listViews(root(), state.databaseId);
        state.viewId = view.id;
        renderViewTabs();
        renderView();
      });
      pop.appendChild(btn);
    });
  });
}

function defaultGroupableColumn() {
  const col = state.columns.find((c) => c.type === 'select');
  return col ? col.id : null;
}

function openViewMenu(anchorEl, view) {
  openPopover(anchorEl, 'database-view-popover', (pop, close) => {
    if (view.type === 'board') {
      const label = document.createElement('div');
      label.className = 'database-popover-title';
      label.textContent = 'Agrupar por';
      pop.appendChild(label);
      state.columns.filter((c) => c.type === 'select').forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'toolbar-button database-popover-row';
        btn.textContent = c.name;
        btn.addEventListener('click', async () => {
          close();
          const cfg = parseView(view);
          cfg.groupBy = c.id;
          await window.mdEditor.db.updateView(root(), view.id, { config: cfg });
          state.views = await window.mdEditor.db.listViews(root(), state.databaseId);
          renderView();
        });
        pop.appendChild(btn);
      });
    }
    const del = document.createElement('button');
    del.className = 'toolbar-button database-popover-row database-popover-danger';
    del.textContent = 'Eliminar vista';
    del.addEventListener('click', async () => {
      close();
      if (state.views.length <= 1) { alert('No se puede borrar la última vista.'); return; }
      await window.mdEditor.db.deleteView(root(), view.id);
      state.views = await window.mdEditor.db.listViews(root(), state.databaseId);
      state.viewId = state.views[0].id;
      renderViewTabs();
      renderView();
    });
    pop.appendChild(del);
  });
}

function filteredRows() {
  const q = state.filter.trim().toLowerCase();
  if (!q) return state.rows;
  return state.rows.filter((row) => state.columns.some((col) => {
    const v = cellDisplayValue(col, row, state.columns);
    return displayText(v).toLowerCase().includes(q);
  }));
}

function renderView() {
  viewBodyEl.innerHTML = '';
  const view = currentViewObj();
  if (!view) return;
  if (view.type === 'board') renderBoardView();
  else if (view.type === 'gallery') renderGalleryView();
  else renderTableView();
}

// ---- vista tabla ----

function renderTableView() {
  const rows = filteredRows();
  const table = document.createElement('table');
  table.className = 'database-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  state.columns.forEach((col) => {
    const th = document.createElement('th');
    th.className = 'database-th';
    th.textContent = col.name;
    th.title = 'Clic: editar columna';
    th.addEventListener('click', () => openColumnEditor(th, col));
    headRow.appendChild(th);
  });
  const thAdd = document.createElement('th');
  thAdd.className = 'database-th database-th-add';
  thAdd.textContent = '+';
  thAdd.title = 'Nueva columna';
  thAdd.addEventListener('click', () => openColumnEditor(thAdd, null));
  headRow.appendChild(thAdd);
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-mk-db-row', row.id);
    });
    tr.addEventListener('dragover', (e) => { e.preventDefault(); tr.classList.add('database-row-drag-over'); });
    tr.addEventListener('dragleave', () => tr.classList.remove('database-row-drag-over'));
    tr.addEventListener('drop', async (e) => {
      e.preventDefault();
      tr.classList.remove('database-row-drag-over');
      const draggedId = e.dataTransfer.getData('application/x-mk-db-row');
      if (!draggedId || draggedId === row.id) return;
      const ids = rows.map((r) => r.id);
      const from = ids.indexOf(draggedId);
      const to = ids.indexOf(row.id);
      ids.splice(from, 1);
      ids.splice(to, 0, draggedId);
      await window.mdEditor.db.reorderRows(root(), state.databaseId, ids);
      state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
      renderView();
    });

    state.columns.forEach((col) => {
      const td = document.createElement('td');
      td.className = 'database-td';
      renderCell(td, col, row);
      tr.appendChild(td);
    });
    const tdDel = document.createElement('td');
    tdDel.className = 'database-td database-td-del';
    const delBtn = document.createElement('button');
    delBtn.className = 'database-row-del';
    delBtn.textContent = '×';
    delBtn.title = 'Eliminar fila';
    delBtn.addEventListener('click', async () => {
      await window.mdEditor.db.deleteRow(root(), row.id);
      state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
      renderView();
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  viewBodyEl.appendChild(table);

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = state.rows.length ? 'Sin filas que coincidan con el filtro.' : 'Sin filas todavía — "+ Fila" para agregar la primera.';
    viewBodyEl.appendChild(empty);
  }
}

// ---- vista tablero (agrupa por una columna "select") ----

function renderBoardView() {
  const view = currentViewObj();
  const cfg = parseView(view);
  const groupCol = findColumn(state.columns, cfg.groupBy);
  if (!groupCol) {
    const msg = document.createElement('div');
    msg.className = 'command-palette-empty';
    msg.textContent = 'Elegí una columna de selección única para agrupar (clic derecho en la pestaña de la vista).';
    viewBodyEl.appendChild(msg);
    return;
  }
  const opts = parseOptions(groupCol);
  const choices = opts.choices || [];
  const rows = filteredRows();
  const groups = choices.map((c) => ({ choice: c, rows: rows.filter((r) => r.cells[groupCol.id] === c.id) }));
  groups.push({ choice: null, rows: rows.filter((r) => !r.cells[groupCol.id] || !choices.some((c) => c.id === r.cells[groupCol.id])) });

  const board = document.createElement('div');
  board.className = 'database-board';
  groups.forEach((group) => {
    const col = document.createElement('div');
    col.className = 'database-board-column';
    const title = document.createElement('div');
    title.className = 'database-board-column-title';
    title.textContent = (group.choice ? group.choice.label : 'Sin valor') + ` (${group.rows.length})`;
    if (group.choice) title.style.borderLeft = `3px solid ${group.choice.color}`;
    col.appendChild(title);

    const list = document.createElement('div');
    list.className = 'database-board-list';
    group.rows.forEach((row) => {
      const card = document.createElement('div');
      card.className = 'database-board-card';
      card.draggable = true;
      card.textContent = displayText(cellDisplayValue(state.columns[0], row, state.columns)) || '(sin nombre)';
      card.addEventListener('click', () => openRowEditor(row));
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-mk-db-row', row.id);
      });
      list.appendChild(card);
    });
    col.appendChild(list);

    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const rowId = e.dataTransfer.getData('application/x-mk-db-row');
      if (!rowId) return;
      await window.mdEditor.db.setCell(root(), rowId, groupCol.id, group.choice ? group.choice.id : null);
      state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
      renderView();
    });

    board.appendChild(col);
  });
  viewBodyEl.appendChild(board);
}

// ---- vista galería ----

function renderGalleryView() {
  const rows = filteredRows();
  const grid = document.createElement('div');
  grid.className = 'database-gallery';
  rows.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'database-gallery-card';
    card.addEventListener('click', () => openRowEditor(row));

    const title = document.createElement('div');
    title.className = 'database-gallery-title';
    title.textContent = displayText(cellDisplayValue(state.columns[0], row, state.columns)) || '(sin nombre)';
    card.appendChild(title);

    state.columns.slice(1, 5).forEach((col) => {
      const line = document.createElement('div');
      line.className = 'database-gallery-line';
      const label = document.createElement('span');
      label.className = 'database-gallery-label';
      label.textContent = col.name + ': ';
      line.appendChild(label);
      line.appendChild(document.createTextNode(displayText(cellDisplayValue(col, row, state.columns))));
      card.appendChild(line);
    });

    grid.appendChild(card);
  });
  viewBodyEl.appendChild(grid);

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'Sin filas que mostrar.';
    viewBodyEl.appendChild(empty);
  }
}

// Editor simple de fila completa, usado desde tablero/galería (la vista
// tabla ya edita celda por celda inline).
function openRowEditor(row) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay palette-overlay';
  const box = document.createElement('div');
  box.className = 'command-palette database-row-modal';
  modal.appendChild(box);

  state.columns.forEach((col) => {
    const field = document.createElement('div');
    field.className = 'database-row-modal-field';
    const label = document.createElement('label');
    label.textContent = col.name;
    field.appendChild(label);
    const cellHost = document.createElement('div');
    cellHost.className = 'database-td database-row-modal-cell';
    renderCell(cellHost, col, row, () => renderView());
    field.appendChild(cellHost);
    box.appendChild(field);
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toolbar-button database-row-modal-close';
  closeBtn.textContent = 'Cerrar';
  closeBtn.addEventListener('click', () => { modal.remove(); renderView(); });
  box.appendChild(closeBtn);

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) { modal.remove(); renderView(); } });
  document.body.appendChild(modal);
}

// ---- celdas ----

function renderCell(host, column, row, onChange) {
  host.innerHTML = '';
  const refresh = async () => {
    state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
    if (state.relatedData[state.databaseId]) state.relatedData[state.databaseId].rows = state.rows;
    if (onChange) onChange(); else renderView();
  };

  switch (column.type) {
    case 'text':
      renderTextCell(host, column, row, refresh);
      return;
    case 'number':
      renderNumberCell(host, column, row, refresh);
      return;
    case 'date':
      renderDateCell(host, column, row, refresh);
      return;
    case 'checkbox':
      renderCheckboxCell(host, column, row, refresh);
      return;
    case 'select':
      renderSelectCell(host, column, row, refresh);
      return;
    case 'multiselect':
      renderMultiselectCell(host, column, row, refresh);
      return;
    case 'relation':
      renderRelationCell(host, column, row, refresh);
      return;
    default: {
      const span = document.createElement('span');
      span.className = 'database-cell-readonly';
      span.textContent = displayText(cellDisplayValue(column, row, state.columns));
      host.appendChild(span);
    }
  }
}

function renderTextCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.className = 'database-cell-input';
  input.type = 'text';
  input.value = row.cells[column.id] || '';
  input.addEventListener('change', async () => {
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.value);
    await refresh();
  });
  host.appendChild(input);
}

function renderNumberCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.className = 'database-cell-input';
  input.type = 'number';
  input.value = row.cells[column.id] != null ? row.cells[column.id] : '';
  input.addEventListener('change', async () => {
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.value === '' ? null : input.value);
    await refresh();
  });
  host.appendChild(input);
}

function renderDateCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.className = 'database-cell-input';
  input.type = 'date';
  input.value = row.cells[column.id] || '';
  input.addEventListener('change', async () => {
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.value || null);
    await refresh();
  });
  host.appendChild(input);
}

function renderCheckboxCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = row.cells[column.id] === '1';
  input.addEventListener('change', async () => {
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.checked ? '1' : '0');
    await refresh();
  });
  host.appendChild(input);
}

function renderSelectCell(host, column, row, refresh) {
  const chip = document.createElement('button');
  chip.className = 'database-select-chip-btn';
  const choice = findChoice(column, row.cells[column.id]);
  chip.appendChild(makeChip(choice));
  chip.addEventListener('click', () => {
    openPopover(chip, 'database-choice-popover', (pop, close) => {
      const opts = parseOptions(column);
      (opts.choices || []).forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'toolbar-button database-popover-row';
        btn.appendChild(makeChip(c));
        btn.addEventListener('click', async () => {
          close();
          await window.mdEditor.db.setCell(root(), row.id, column.id, c.id);
          await refresh();
        });
        pop.appendChild(btn);
      });
      const clear = document.createElement('button');
      clear.className = 'toolbar-button database-popover-row';
      clear.textContent = 'Vaciar';
      clear.addEventListener('click', async () => {
        close();
        await window.mdEditor.db.setCell(root(), row.id, column.id, null);
        await refresh();
      });
      pop.appendChild(clear);
    });
  });
  host.appendChild(chip);
}

function renderMultiselectCell(host, column, row, refresh) {
  const opts = parseOptions(column);

  function currentIds() {
    return parseJsonArray(row.cells[column.id]);
  }

  function renderChip() {
    host.innerHTML = '';
    const wrap = document.createElement('button');
    wrap.className = 'database-select-chip-btn';
    const ids = currentIds();
    ids.forEach((id) => {
      const c = (opts.choices || []).find((ch) => ch.id === id);
      if (c) wrap.appendChild(makeChip(c));
    });
    if (!ids.length) wrap.appendChild(makeChip(null));
    wrap.addEventListener('click', () => {
      openPopover(wrap, 'database-choice-popover', (pop) => renderChoiceList(pop));
    });
    host.appendChild(wrap);
  }

  function renderChoiceList(pop) {
    pop.innerHTML = '';
    const ids = currentIds();
    (opts.choices || []).forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'toolbar-button database-popover-row';
      const active = ids.includes(c.id);
      btn.appendChild(makeChip(c));
      if (active) btn.classList.add('database-popover-row-active');
      btn.addEventListener('click', async () => {
        const next = active ? ids.filter((id) => id !== c.id) : ids.concat([c.id]);
        row.cells[column.id] = JSON.stringify(next);
        await window.mdEditor.db.setCell(root(), row.id, column.id, row.cells[column.id]);
        await refresh();
        renderChip();
        renderChoiceList(pop);
      });
      pop.appendChild(btn);
    });
  }

  renderChip();
}

function makeChip(choice) {
  const chip = document.createElement('span');
  chip.className = 'database-chip';
  if (choice) {
    chip.textContent = choice.label;
    chip.style.background = choice.color;
  } else {
    chip.textContent = 'Vacío';
    chip.classList.add('database-chip-empty');
  }
  return chip;
}

function renderRelationCell(host, column, row, refresh) {
  const opts = parseOptions(column);
  const target = state.relatedData[opts.targetDatabaseId];
  const wrap = document.createElement('button');
  wrap.className = 'database-select-chip-btn';
  const ids = row.relations[column.id] || [];
  if (!target) {
    wrap.textContent = '(sin base destino)';
  } else if (!ids.length) {
    wrap.appendChild(makeChip(null));
  } else {
    ids.forEach((id) => {
      const chip = document.createElement('span');
      chip.className = 'database-chip database-chip-relation';
      chip.textContent = relatedRowTitle(target, id);
      wrap.appendChild(chip);
    });
  }
  if (target) {
    wrap.addEventListener('click', () => openRelationPicker(wrap, column, row, target, refresh));
  }
  host.appendChild(wrap);
}

function openRelationPicker(anchorEl, column, row, target, refresh) {
  openPopover(anchorEl, 'database-relation-popover', (pop) => {
    const search = document.createElement('input');
    search.className = 'database-cell-input';
    search.placeholder = 'Buscar fila...';
    pop.appendChild(search);

    const list = document.createElement('div');
    list.className = 'database-relation-list';
    pop.appendChild(list);

    const selected = new Set(row.relations[column.id] || []);

    function renderList() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      target.rows
        .filter((r) => relatedRowTitle(target, r.id).toLowerCase().includes(q))
        .forEach((r) => {
          const btn = document.createElement('button');
          btn.className = 'toolbar-button database-popover-row' + (selected.has(r.id) ? ' database-popover-row-active' : '');
          btn.textContent = (selected.has(r.id) ? '✓ ' : '') + relatedRowTitle(target, r.id);
          btn.addEventListener('click', async () => {
            if (selected.has(r.id)) selected.delete(r.id); else selected.add(r.id);
            await window.mdEditor.db.setRelations(root(), column.id, row.id, Array.from(selected));
            renderList();
            await refresh();
          });
          list.appendChild(btn);
        });
    }
    search.addEventListener('input', renderList);
    renderList();
    search.focus();
  });
}

// ---- editor de columnas ----

function openColumnEditor(anchorEl, column) {
  const isNew = !column;
  openPopover(anchorEl, 'database-column-popover', (pop, close) => {
    const title = document.createElement('div');
    title.className = 'database-popover-title';
    title.textContent = isNew ? 'Nueva columna' : 'Editar columna';
    pop.appendChild(title);

    const nameField = document.createElement('input');
    nameField.className = 'database-cell-input';
    nameField.placeholder = 'Nombre';
    nameField.value = column ? column.name : '';
    pop.appendChild(nameField);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'database-cell-input';
    COLUMN_TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.value;
      opt.textContent = t.label;
      typeSelect.appendChild(opt);
    });
    typeSelect.value = column ? column.type : 'text';
    pop.appendChild(typeSelect);

    const configHost = document.createElement('div');
    configHost.className = 'database-column-config';
    pop.appendChild(configHost);

    let getConfig = () => ({});
    function renderConfig() {
      configHost.innerHTML = '';
      getConfig = buildColumnConfigEditor(configHost, typeSelect.value, column);
    }
    typeSelect.addEventListener('change', renderConfig);
    renderConfig();

    const actions = document.createElement('div');
    actions.className = 'database-popover-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'toolbar-button';
    saveBtn.textContent = 'Guardar';
    saveBtn.addEventListener('click', async () => {
      const payload = { name: nameField.value.trim() || 'Columna', type: typeSelect.value, options: getConfig() };
      if (isNew) {
        await window.mdEditor.db.createColumn(root(), state.databaseId, payload);
      } else {
        await window.mdEditor.db.updateColumn(root(), column.id, payload);
      }
      close();
      await reloadColumnsAndRows();
    });
    actions.appendChild(saveBtn);

    if (!isNew) {
      const delBtn = document.createElement('button');
      delBtn.className = 'toolbar-button database-popover-danger';
      delBtn.textContent = 'Eliminar';
      delBtn.addEventListener('click', async () => {
        if (state.columns.length <= 1) { alert('Tiene que quedar al menos una columna.'); return; }
        await window.mdEditor.db.deleteColumn(root(), column.id);
        close();
        await reloadColumnsAndRows();
      });
      actions.appendChild(delBtn);
    }
    pop.appendChild(actions);
    nameField.focus();
  });
}

async function reloadColumnsAndRows() {
  state.columns = await window.mdEditor.db.listColumns(root(), state.databaseId);
  state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
  await loadRelatedData();
  renderView();
}

function buildColumnConfigEditor(host, type, column) {
  const opts = column ? parseOptions(column) : {};

  if (type === 'select' || type === 'multiselect') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Opciones, una por línea:';
    host.appendChild(hint);
    const textarea = document.createElement('textarea');
    textarea.className = 'database-cell-input database-choices-textarea';
    textarea.rows = 4;
    textarea.value = (opts.choices || []).map((c) => c.label).join('\n');
    host.appendChild(textarea);
    return () => {
      const existingByLabel = new Map((opts.choices || []).map((c) => [c.label, c]));
      const labels = textarea.value.split('\n').map((l) => l.trim()).filter(Boolean);
      const choices = labels.map((label, i) => existingByLabel.get(label) || { id: crypto.randomUUID(), label, color: CHOICE_COLORS[i % CHOICE_COLORS.length] });
      return { choices };
    };
  }

  if (type === 'relation') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Base de datos destino:';
    host.appendChild(hint);
    const select = document.createElement('select');
    select.className = 'database-cell-input';
    state.databases.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      select.appendChild(opt);
    });
    if (opts.targetDatabaseId) select.value = opts.targetDatabaseId;
    host.appendChild(select);
    return () => ({ targetDatabaseId: select.value });
  }

  if (type === 'formula') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Expresión JS: prop("Columna") para leer otra columna. Ej: prop("Precio") * prop("Cantidad")';
    host.appendChild(hint);
    const textarea = document.createElement('textarea');
    textarea.className = 'database-cell-input';
    textarea.rows = 3;
    textarea.value = opts.expr || '';
    host.appendChild(textarea);
    return () => ({ expr: textarea.value });
  }

  if (type === 'rollup') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Columna de relación:';
    host.appendChild(hint);
    const relSelect = document.createElement('select');
    relSelect.className = 'database-cell-input';
    const relationColumns = state.columns.filter((c) => c.type === 'relation');
    relationColumns.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      relSelect.appendChild(opt);
    });
    host.appendChild(relSelect);

    const targetHint = document.createElement('div');
    targetHint.className = 'database-popover-hint';
    targetHint.textContent = 'Columna a agregar (de la base destino):';
    host.appendChild(targetHint);
    const targetSelect = document.createElement('select');
    targetSelect.className = 'database-cell-input';
    host.appendChild(targetSelect);

    function refreshTargetOptions() {
      const relCol = relationColumns.find((c) => c.id === relSelect.value);
      const relOpts = relCol ? parseOptions(relCol) : {};
      const targetCols = (state.relatedData[relOpts.targetDatabaseId] || { columns: [] }).columns
        .filter((c) => c.type !== 'formula' && c.type !== 'rollup');
      targetSelect.innerHTML = '';
      targetCols.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        targetSelect.appendChild(opt);
      });
      if (opts.targetColumnId) targetSelect.value = opts.targetColumnId;
    }
    relSelect.addEventListener('change', refreshTargetOptions);
    if (opts.relationColumnId) relSelect.value = opts.relationColumnId;
    refreshTargetOptions();

    const aggHint = document.createElement('div');
    aggHint.className = 'database-popover-hint';
    aggHint.textContent = 'Agregación:';
    host.appendChild(aggHint);
    const aggSelect = document.createElement('select');
    aggSelect.className = 'database-cell-input';
    AGGREGATIONS.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.value;
      opt.textContent = a.label;
      aggSelect.appendChild(opt);
    });
    if (opts.aggregation) aggSelect.value = opts.aggregation;
    host.appendChild(aggSelect);

    if (!relationColumns.length) {
      const warn = document.createElement('div');
      warn.className = 'database-popover-hint';
      warn.textContent = 'Necesitás al menos una columna de tipo Relación en esta base de datos.';
      host.appendChild(warn);
    }

    return () => ({ relationColumnId: relSelect.value, targetColumnId: targetSelect.value, aggregation: aggSelect.value });
  }

  return () => ({});
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

async function open(databaseId) {
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

function close() {
  closePopover();
  overlay.hidden = true;
}

window.mdDatabase = { open, close };

})();
