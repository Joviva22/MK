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
const filtersBtn = document.getElementById('database-filters-btn');

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
  } catch {
    return {};
  }
}

function parseView(view) {
  try {
    return view && view.config ? JSON.parse(view.config) : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
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
  } catch {
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
  return { table: '▤', board: '▥', gallery: '▦', calendar: '📅', chart: '📊' }[type] || '▤';
}

function openNewViewPopover(anchorEl) {
  openPopover(anchorEl, 'database-view-popover', (pop, close) => {
    const title = document.createElement('div');
    title.className = 'database-popover-title';
    title.textContent = 'Nueva vista';
    pop.appendChild(title);
    [['table', 'Tabla'], ['board', 'Tablero'], ['gallery', 'Galería'], ['calendar', 'Calendario'], ['chart', 'Gráfico']].forEach(([type, label]) => {
      const btn = document.createElement('button');
      btn.className = 'toolbar-button database-popover-row';
      btn.textContent = viewTypeIcon(type) + ' ' + label;
      btn.addEventListener('click', async () => {
        close();
        const firstDate = state.columns.find((c) => c.type === 'date');
        const firstSelect = state.columns.find((c) => c.type === 'select');
        const config = type === 'board' ? { groupBy: defaultGroupableColumn() }
          : type === 'calendar' ? { dateColumn: firstDate ? firstDate.id : null }
            : type === 'chart' ? { chartType: 'bar', groupBy: (firstSelect || firstDate || state.columns[0] || {}).id, measure: 'count', dateBucket: 'month' } : {};
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
    if (view.type === 'calendar') {
      const label = document.createElement('div');
      label.className = 'database-popover-title';
      label.textContent = 'Fecha según';
      pop.appendChild(label);
      state.columns.filter((c) => c.type === 'date').forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'toolbar-button database-popover-row' + (parseView(view).dateColumn === c.id ? ' database-popover-row-active' : '');
        btn.textContent = c.name;
        btn.addEventListener('click', async () => {
          close();
          const cfg = parseView(view);
          cfg.dateColumn = c.id;
          await window.mdEditor.db.updateView(root(), view.id, { config: cfg });
          state.views = await window.mdEditor.db.listViews(root(), state.databaseId);
          renderView();
        });
        pop.appendChild(btn);
      });
    }
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

// ---- filtros por campo y orden (guardados en la config de cada vista) ----

// Tipo "de comparación" de una columna: define qué operadores de filtro
// ofrece y cómo se ordena. Fórmula puede devolver cualquier cosa, así que se
// compara como texto; rollup siempre es numérico.
function columnKind(col) {
  switch (col.type) {
    case 'number':
    case 'rollup':
      return 'number';
    case 'date':
    case 'created_time':
      return 'date';
    case 'checkbox':
    case 'select':
    case 'multiselect':
      return col.type;
    default:
      return 'text';
  }
}

const FILTER_OPS = {
  text: [['contains', 'contiene'], ['not_contains', 'no contiene'], ['eq', 'es igual a'], ['empty', 'está vacío'], ['not_empty', 'no está vacío']],
  number: [['eq', '='], ['neq', '≠'], ['gt', '>'], ['lt', '<'], ['gte', '≥'], ['lte', '≤'], ['empty', 'está vacío'], ['not_empty', 'no está vacío']],
  date: [['eq', 'es'], ['before', 'antes de'], ['after', 'después de'], ['today', 'es hoy'], ['overdue', 'antes de hoy (vencida)'], ['upcoming', 'hoy o después'], ['this_week', 'esta semana'], ['empty', 'está vacía'], ['not_empty', 'no está vacía']],
  checkbox: [['checked', 'está marcada'], ['unchecked', 'no está marcada']],
  select: [['is', 'es'], ['is_not', 'no es'], ['empty', 'está vacía'], ['not_empty', 'no está vacía']],
  multiselect: [['has', 'contiene'], ['not_has', 'no contiene'], ['empty', 'está vacía'], ['not_empty', 'no está vacía']]
};
const OPS_WITH_VALUE = new Set(['contains', 'not_contains', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'before', 'after', 'is', 'is_not', 'has', 'not_has']);

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Valor "comparable" de una celda según su kind: string YYYY-MM-DD para
// fechas, id de opción para select, array de ids para multiselect, número o
// null, boolean, o texto.
function comparableValue(col, row) {
  switch (col.type) {
    case 'select':
      return row.cells[col.id] || null;
    case 'multiselect':
      return parseJsonArray(row.cells[col.id]);
    case 'created_time':
      return row.createdAt ? isoDay(new Date(row.createdAt)) : null;
    default: {
      const v = cellDisplayValue(col, row, state.columns);
      const kind = columnKind(col);
      if (kind === 'number') return v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v);
      if (kind === 'checkbox') return !!v;
      if (kind === 'date') return v || null;
      return displayText(v);
    }
  }
}

function isEmptyValue(v) {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

function matchesFilter(filter, row) {
  const col = findColumn(state.columns, filter.columnId);
  if (!col) return true;
  const op = filter.op;
  if (OPS_WITH_VALUE.has(op) && (filter.value == null || filter.value === '')) return true; // filtro a medio armar: no filtra
  const v = comparableValue(col, row);
  if (op === 'empty') return isEmptyValue(v);
  if (op === 'not_empty') return !isEmptyValue(v);
  const today = isoDay(new Date());
  switch (op) {
    case 'contains': return String(v).toLowerCase().includes(String(filter.value).toLowerCase());
    case 'not_contains': return !String(v).toLowerCase().includes(String(filter.value).toLowerCase());
    case 'eq':
      if (columnKind(col) === 'number') return v != null && v === Number(filter.value);
      if (columnKind(col) === 'date') return v === filter.value;
      return String(v).toLowerCase() === String(filter.value).toLowerCase();
    case 'neq': return v == null || v !== Number(filter.value);
    case 'gt': return v != null && v > Number(filter.value);
    case 'lt': return v != null && v < Number(filter.value);
    case 'gte': return v != null && v >= Number(filter.value);
    case 'lte': return v != null && v <= Number(filter.value);
    case 'before': return !!v && v < filter.value;
    case 'after': return !!v && v > filter.value;
    case 'today': return v === today;
    case 'overdue': return !!v && v < today;
    case 'upcoming': return !!v && v >= today;
    case 'this_week': {
      const now = new Date();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      return !!v && v >= isoDay(monday) && v <= isoDay(sunday);
    }
    case 'checked': return v === true;
    case 'unchecked': return v !== true;
    case 'is': return v === filter.value;
    case 'is_not': return v !== filter.value;
    case 'has': return v.includes(filter.value);
    case 'not_has': return !v.includes(filter.value);
    default: return true;
  }
}

function compareRows(col, a, b) {
  const kind = columnKind(col);
  const va = comparableValue(col, a);
  const vb = comparableValue(col, b);
  // Vacíos siempre al final, sin importar la dirección (lo hace sortRows).
  if (kind === 'number') return va - vb;
  if (kind === 'checkbox') return Number(va) - Number(vb);
  if (kind === 'select' || kind === 'multiselect') {
    const choices = parseOptions(col).choices || [];
    const idx = (id) => choices.findIndex((c) => c.id === id);
    if (kind === 'select') return idx(va) - idx(vb);
    return displayText(cellDisplayValue(col, a, state.columns)).localeCompare(displayText(cellDisplayValue(col, b, state.columns)));
  }
  return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
}

// Orden por una o varias columnas: [{ columnId, dir }], el primero manda y
// los siguientes desempatan (ej. Estado ↑ y después Fecha ↑). Las vistas
// viejas guardaban un solo { sort }: se sigue leyendo.
function viewSorts(cfg) {
  const list = Array.isArray(cfg.sorts) ? cfg.sorts : (cfg.sort ? [cfg.sort] : []);
  return list.filter((s) => findColumn(state.columns, s.columnId));
}

function sortRows(rows, sorts) {
  const keys = sorts.map((s) => {
    const col = findColumn(state.columns, s.columnId);
    const kind = columnKind(col);
    return { col, dir: s.dir === 'desc' ? -1 : 1, empty: (row) => kind !== 'checkbox' && isEmptyValue(comparableValue(col, row)) };
  });
  if (!keys.length) return rows;
  return rows.slice().sort((a, b) => {
    for (const k of keys) {
      const ea = k.empty(a);
      const eb = k.empty(b);
      // Vacíos siempre al final de su nivel, sin importar la dirección.
      if (ea || eb) {
        if (ea !== eb) return Number(ea) - Number(eb);
        continue;
      }
      const c = k.dir * compareRows(k.col, a, b);
      if (c) return c;
    }
    return 0;
  });
}

function currentViewConfig() {
  return parseView(currentViewObj());
}

async function saveViewConfig(patch) {
  const view = currentViewObj();
  if (!view) return;
  const cfg = { ...parseView(view), ...patch };
  view.config = JSON.stringify(cfg);
  await window.mdEditor.db.updateView(root(), view.id, { config: cfg });
}

function filteredRows() {
  const cfg = currentViewConfig();
  const filters = Array.isArray(cfg.filters) ? cfg.filters : [];
  const q = state.filter.trim().toLowerCase();
  let rows = state.rows;
  if (q) {
    rows = rows.filter((row) => state.columns.some((col) => {
      const v = cellDisplayValue(col, row, state.columns);
      return displayText(v).toLowerCase().includes(q);
    }));
  }
  if (filters.length) rows = rows.filter((row) => filters.every((f) => matchesFilter(f, row)));
  return sortRows(rows, viewSorts(cfg));
}

function updateFiltersButton() {
  const filters = currentViewConfig().filters || [];
  filtersBtn.textContent = filters.length ? `Filtros (${filters.length})` : 'Filtros';
  filtersBtn.classList.toggle('database-filters-active', filters.length > 0);
}

function valueControlFor(col, filter, onChange) {
  const kind = columnKind(col);
  let input;
  if (kind === 'select' || kind === 'multiselect') {
    input = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '(elegí)';
    input.appendChild(blank);
    (parseOptions(col).choices || []).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement('input');
    input.type = kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text';
    input.placeholder = 'valor';
  }
  input.className = 'database-filter-field';
  input.value = filter.value != null ? filter.value : '';
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function openFiltersPopover() {
  openPopover(filtersBtn, 'database-filters-popover', (pop) => {
    const rebuild = () => {
      pop.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'database-popover-title';
      title.textContent = 'Filtros de esta vista (se cumplen todos)';
      pop.appendChild(title);

      const filters = (currentViewConfig().filters || []).map((f) => ({ ...f }));
      const commit = async () => {
        await saveViewConfig({ filters });
        updateFiltersButton();
        renderView();
      };

      filters.forEach((filter, idx) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'database-filter-row';

        const colSel = document.createElement('select');
        colSel.className = 'database-filter-field';
        state.columns.forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          colSel.appendChild(opt);
        });
        colSel.value = filter.columnId;
        colSel.addEventListener('change', async () => {
          const c = findColumn(state.columns, colSel.value);
          filters[idx] = { columnId: c.id, op: FILTER_OPS[columnKind(c)][0][0], value: '' };
          await commit();
          rebuild();
        });
        rowEl.appendChild(colSel);

        const col = findColumn(state.columns, filter.columnId);
        if (col) {
          const opSel = document.createElement('select');
          opSel.className = 'database-filter-field';
          FILTER_OPS[columnKind(col)].forEach(([value, label]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            opSel.appendChild(opt);
          });
          opSel.value = filter.op;
          opSel.addEventListener('change', async () => {
            filters[idx].op = opSel.value;
            await commit();
            rebuild();
          });
          rowEl.appendChild(opSel);

          if (OPS_WITH_VALUE.has(filter.op)) {
            rowEl.appendChild(valueControlFor(col, filter, async (value) => {
              filters[idx].value = value;
              await commit();
            }));
          }
        }

        const del = document.createElement('button');
        del.className = 'database-row-del';
        del.textContent = '×';
        del.title = 'Quitar filtro';
        del.addEventListener('click', async () => {
          filters.splice(idx, 1);
          await commit();
          rebuild();
        });
        rowEl.appendChild(del);
        pop.appendChild(rowEl);
      });

      const add = document.createElement('button');
      add.className = 'toolbar-button database-popover-row';
      add.textContent = '+ Agregar filtro';
      add.disabled = !state.columns.length;
      add.addEventListener('click', async () => {
        const c = state.columns[0];
        filters.push({ columnId: c.id, op: FILTER_OPS[columnKind(c)][0][0], value: '' });
        await commit();
        rebuild();
      });
      pop.appendChild(add);
    };
    rebuild();
  });
}

// ---- duplicar / eliminar fila (clic derecho) ----

// Copia los valores guardados (no fórmulas/rollups/fecha de creación, que se
// calculan solos) y las relaciones, y deja la copia justo debajo.
async function duplicateRow(row) {
  const cells = {};
  state.columns.forEach((col) => {
    if (['formula', 'rollup', 'created_time', 'relation'].includes(col.type)) return;
    const v = row.cells[col.id];
    if (v != null && v !== '') cells[col.id] = v;
  });
  const newId = await window.mdEditor.db.createRow(root(), state.databaseId, cells);
  for (const col of state.columns.filter((c) => c.type === 'relation')) {
    const targets = row.relations[col.id] || [];
    if (targets.length) await window.mdEditor.db.setRelations(root(), col.id, newId, targets);
  }
  const ids = state.rows.map((r) => r.id);
  ids.splice(ids.indexOf(row.id) + 1, 0, newId);
  await window.mdEditor.db.reorderRows(root(), state.databaseId, ids);
  state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
  await loadRelatedData();
  renderView();
  return newId;
}

function openRowMenu(anchorEl, row) {
  openPopover(anchorEl, 'database-view-popover database-row-menu', (pop, close) => {
    const item = (label, fn, cls) => {
      const btn = document.createElement('button');
      btn.className = 'toolbar-button database-popover-row' + (cls ? ' ' + cls : '');
      btn.textContent = label;
      btn.addEventListener('click', async () => { close(); await fn(); });
      pop.appendChild(btn);
    };
    item('⧉ Duplicar fila', () => duplicateRow(row));
    item('✎ Abrir fila completa', () => openRowEditor(row));
    item('🗑 Eliminar fila', async () => {
      await window.mdEditor.db.deleteRow(root(), row.id);
      state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
      renderView();
    }, 'database-popover-danger');
  });
}

// Clic en un encabezado de la tabla: ordenar o editar la columna.
function openColumnMenu(th, col) {
  const sorts = viewSorts(currentViewConfig());
  const mine = sorts.find((s) => s.columnId === col.id);
  openPopover(th, 'database-view-popover', (pop, close) => {
    const item = (label, fn, extraClass) => {
      const btn = document.createElement('button');
      btn.className = 'toolbar-button database-popover-row' + (extraClass ? ' ' + extraClass : '');
      btn.textContent = label;
      btn.addEventListener('click', async () => { close(); await fn(); });
      pop.appendChild(btn);
    };
    const setSorts = async (list) => { await saveViewConfig({ sorts: list, sort: null }); renderView(); };
    const onlyMine = sorts.length === 1 && mine;
    item('↑ Ordenar ascendente', () => setSorts([{ columnId: col.id, dir: 'asc' }]), onlyMine && mine.dir === 'asc' ? 'database-popover-row-active' : '');
    item('↓ Ordenar descendente', () => setSorts([{ columnId: col.id, dir: 'desc' }]), onlyMine && mine.dir === 'desc' ? 'database-popover-row-active' : '');
    // Con otro orden ya puesto: sumar esta columna como desempate.
    const others = sorts.filter((s) => s.columnId !== col.id);
    if (others.length) {
      item('+ Después por esta ↑', () => setSorts([...others, { columnId: col.id, dir: 'asc' }]));
      item('+ Después por esta ↓', () => setSorts([...others, { columnId: col.id, dir: 'desc' }]));
    }
    if (mine && sorts.length > 1) item('Quitar esta columna del orden', () => setSorts(others));
    if (sorts.length) item('Quitar orden', () => setSorts([]));
    item('✎ Editar columna...', () => openColumnEditor(th, col));
  });
}

function renderView() {
  viewBodyEl.innerHTML = '';
  const view = currentViewObj();
  if (!view) return;
  updateFiltersButton();
  if (view.type === 'board') renderBoardView();
  else if (view.type === 'gallery') renderGalleryView();
  else if (view.type === 'calendar') renderCalendarView();
  else if (view.type === 'chart') renderChartView();
  else renderTableView();
}

// ---- vista tabla ----

function renderTableView() {
  const rows = filteredRows();
  const viewCfg = currentViewConfig();
  const sorts = viewSorts(viewCfg);
  const colWidths = viewCfg.colWidths || {};
  const table = document.createElement('table');
  table.className = 'database-table';

  // Anchos elegidos a mano (arrastrando el borde del encabezado), por vista.
  // Con alguno puesto, layout fijo: si no, el navegador los recalcula según
  // el contenido y el arrastre "rebota".
  const colgroup = document.createElement('colgroup');
  const colEls = {};
  state.columns.forEach((col) => {
    const c = document.createElement('col');
    if (colWidths[col.id]) c.style.width = colWidths[col.id] + 'px';
    colEls[col.id] = c;
    colgroup.appendChild(c);
  });
  ['32px', '28px'].forEach((w) => {
    const c = document.createElement('col');
    c.style.width = w;
    colgroup.appendChild(c);
  });
  table.appendChild(colgroup);
  if (Object.keys(colWidths).length) {
    table.classList.add('database-table-fixed');
    const fixedTotal = state.columns.reduce((sum, col) => sum + (colWidths[col.id] || 140), 60);
    table.style.minWidth = fixedTotal + 'px';
  }

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  state.columns.forEach((col) => {
    const th = document.createElement('th');
    th.className = 'database-th';
    th.textContent = col.name;
    const sortIdx = sorts.findIndex((s) => s.columnId === col.id);
    if (sortIdx !== -1) {
      const arrow = document.createElement('span');
      arrow.className = 'database-sort-arrow';
      // Con varios niveles se numeran: ↑1, ↓2...
      arrow.textContent = (sorts[sortIdx].dir === 'desc' ? ' ↓' : ' ↑') + (sorts.length > 1 ? sortIdx + 1 : '');
      th.appendChild(arrow);
    }
    th.title = 'Clic: ordenar o editar columna';
    th.addEventListener('click', () => openColumnMenu(th, col));

    const grip = document.createElement('span');
    grip.className = 'database-col-resizer';
    grip.title = 'Arrastrar: ancho de la columna · Doble clic: automático';
    grip.addEventListener('click', (e) => e.stopPropagation());
    grip.addEventListener('dblclick', async (e) => {
      e.stopPropagation();
      const widths = { ...(currentViewConfig().colWidths || {}) };
      delete widths[col.id];
      await saveViewConfig({ colWidths: widths });
      renderView();
    });
    grip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = th.getBoundingClientRect().width;
      table.classList.add('database-table-fixed');
      document.body.classList.add('resizing');
      let width = startW;
      const onMove = (ev) => {
        width = Math.max(60, Math.min(800, startW + ev.clientX - startX));
        colEls[col.id].style.width = width + 'px';
      };
      const onUp = async () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.classList.remove('resizing');
        const widths = { ...(currentViewConfig().colWidths || {}), [col.id]: Math.round(width) };
        await saveViewConfig({ colWidths: widths });
        renderView();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    th.appendChild(grip);
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
    // Con un orden activo, arrastrar para reordenar a mano no tendría efecto
    // visible (el orden lo decide la columna), así que se desactiva.
    tr.draggable = !sorts.length;
    tr.addEventListener('contextmenu', (e) => {
      if (e.target.closest('input, textarea')) return; // menú normal de texto
      e.preventDefault();
      openRowMenu(tr.firstChild || tr, row);
    });
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
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); openRowMenu(card, row); });
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
    card.addEventListener('contextmenu', (e) => { e.preventDefault(); openRowMenu(card, row); });

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

// ---- vista calendario (por una columna Fecha) ----

let calCursor = new Date(); // cualquier día del mes visible

function renderCalendarView() {
  const view = currentViewObj();
  const cfg = parseView(view);
  const dateCol = findColumn(state.columns, cfg.dateColumn) || state.columns.find((c) => c.type === 'date');
  if (!dateCol) {
    const msg = document.createElement('div');
    msg.className = 'command-palette-empty';
    msg.textContent = 'Agregá una columna de tipo Fecha para usar el calendario (clic derecho en la pestaña de la vista para elegir cuál).';
    viewBodyEl.appendChild(msg);
    return;
  }
  const rows = filteredRows();
  const first = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
  const last = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0);
  const today = isoDay(new Date());

  const header = document.createElement('div');
  header.className = 'database-calendar-header';
  const nav = (label, title, fn) => {
    const b = document.createElement('button');
    b.className = 'toolbar-button';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', () => { fn(); renderView(); });
    header.appendChild(b);
  };
  nav('‹', 'Mes anterior', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); });
  nav('Hoy', 'Mes actual', () => { calCursor = new Date(); });
  nav('›', 'Mes siguiente', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); });
  const title = document.createElement('span');
  title.className = 'database-calendar-title';
  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  title.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) + ` · según "${dateCol.name}"`;
  header.appendChild(title);
  const undated = rows.filter((r) => !r.cells[dateCol.id]).length;
  if (undated) {
    const note = document.createElement('span');
    note.className = 'database-calendar-undated';
    note.textContent = `${undated} fila(s) sin fecha`;
    header.appendChild(note);
  }
  viewBodyEl.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'database-calendar';
  ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach((n) => {
    const d = document.createElement('div');
    d.className = 'database-calendar-dayname';
    d.textContent = n;
    grid.appendChild(d);
  });
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7;
  for (let i = 0; i < cells; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dayIso = isoDay(day);
    const cell = document.createElement('div');
    cell.className = 'database-calendar-cell' +
      (day.getMonth() === first.getMonth() ? '' : ' database-calendar-outside') +
      (dayIso === today ? ' database-calendar-today' : '');
    cell.title = 'Doble clic: nueva fila con esta fecha · Arrastrá filas entre días';
    const num = document.createElement('div');
    num.className = 'database-calendar-number';
    num.textContent = String(day.getDate());
    cell.appendChild(num);

    rows.filter((r) => r.cells[dateCol.id] === dayIso).forEach((row) => {
      const chip = document.createElement('div');
      chip.className = 'database-calendar-chip';
      chip.draggable = true;
      chip.textContent = displayText(cellDisplayValue(state.columns[0], row, state.columns)) || '(sin nombre)';
      chip.addEventListener('click', () => openRowEditor(row));
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-mk-db-row', row.id);
      });
      cell.appendChild(chip);
    });

    cell.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('application/x-mk-db-row')) return;
      e.preventDefault();
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', async (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      const rowId = e.dataTransfer.getData('application/x-mk-db-row');
      if (!rowId) return;
      await window.mdEditor.db.setCell(root(), rowId, dateCol.id, dayIso);
      state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
      renderView();
    });
    cell.addEventListener('dblclick', async (e) => {
      if (e.target !== cell && e.target !== num) return;
      const rowId = await window.mdEditor.db.createRow(root(), state.databaseId, { [dateCol.id]: dayIso });
      state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
      renderView();
      const row = state.rows.find((r) => r.id === rowId);
      if (row) openRowEditor(row);
    });
    grid.appendChild(cell);
  }
  viewBodyEl.appendChild(grid);
}

// ---- vista gráfico (agrupar por una columna, medir cantidad/suma/promedio) ----

const DATE_BUCKETS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año']];

function bucketKey(iso, bucket) {
  const [y, m, d] = iso.split('-').map(Number);
  if (bucket === 'year') return String(y);
  if (bucket === 'month') return `${y}-${String(m).padStart(2, '0')}`;
  if (bucket === 'week') {
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // lunes de esa semana
    return isoDay(date);
  }
  return iso;
}

function bucketLabel(key, bucket) {
  if (bucket === 'year') return key;
  if (bucket === 'month') {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  const [y, m, d] = key.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return bucket === 'week' ? `sem. ${label}` : label;
}

// Todas las claves entre la primera y la última (los períodos sin datos
// aparecen en 0 en vez de desaparecer: si no, el eje de tiempo miente).
function fillBuckets(keys, bucket) {
  if (!keys.length) return [];
  const sorted = keys.slice().sort();
  const out = [];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (bucket === 'year') {
    for (let y = Number(first); y <= Number(last); y++) out.push(String(y));
  } else if (bucket === 'month') {
    let [y, m] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    while (y < ly || (y === ly && m <= lm)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  } else {
    const step = bucket === 'week' ? 7 : 1;
    const [y, m, d] = first.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    while (isoDay(cur) <= last && out.length < 800) {
      out.push(isoDay(cur));
      cur.setDate(cur.getDate() + step);
    }
  }
  return out;
}

// Claves de grupo de una fila para la columna elegida (multiselección puede
// dar varias: la fila cuenta en cada una de sus etiquetas).
function groupKeysFor(col, row, bucket) {
  const kind = columnKind(col);
  if (kind === 'date') {
    const v = comparableValue(col, row);
    return v ? [bucketKey(v, bucket)] : ['(sin fecha)'];
  }
  if (kind === 'checkbox') return [comparableValue(col, row) ? 'Sí' : 'No'];
  const v = cellDisplayValue(col, row, state.columns);
  if (Array.isArray(v)) return v.length ? v.map(String) : ['(vacío)'];
  const text = displayText(v);
  return [text || '(vacío)'];
}

function chartData(cfg) {
  const col = findColumn(state.columns, cfg.groupBy);
  if (!col) return { data: [], time: false };
  const measureCol = findColumn(state.columns, cfg.valueCol);
  const measure = measureCol && cfg.measure !== 'count' ? cfg.measure : 'count';
  const bucket = cfg.dateBucket || 'month';
  const groups = new Map(); // clave → { sum, n, count }
  filteredRows().forEach((row) => {
    let val = 1;
    if (measure !== 'count') {
      val = comparableValue(measureCol, row);
      if (typeof val !== 'number' || Number.isNaN(val)) return;
    }
    groupKeysFor(col, row, bucket).forEach((key) => {
      const g = groups.get(key) || { sum: 0, n: 0 };
      g.sum += val;
      g.n += 1;
      groups.set(key, g);
    });
  });
  const value = (g) => (!g ? 0 : measure === 'avg' ? g.sum / g.n : g.sum);
  const isTime = columnKind(col) === 'date';
  let keys;
  if (isTime) {
    const dated = Array.from(groups.keys()).filter((k) => k !== '(sin fecha)');
    keys = fillBuckets(dated, bucket);
    if (groups.has('(sin fecha)')) keys.push('(sin fecha)');
  } else if (col.type === 'select') {
    // Orden de las opciones de la columna (el que eligió el usuario).
    const order = (parseOptions(col).choices || []).map((c) => c.label);
    keys = Array.from(groups.keys()).sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
  } else {
    keys = Array.from(groups.keys());
  }
  const data = keys.map((k) => ({
    label: isTime && k !== '(sin fecha)' ? bucketLabel(k, bucket) : k,
    value: value(groups.get(k))
  }));
  const valueLabel = measure === 'count' ? 'filas' : `${measure === 'avg' ? 'promedio de' : 'suma de'} ${measureCol.name}`;
  return { data, time: isTime, valueLabel, groupName: col.name };
}

function renderChartView() {
  const view = currentViewObj();
  const cfg = parseView(view);
  const wrap = document.createElement('div');
  wrap.className = 'database-chart';
  const controls = document.createElement('div');
  controls.className = 'database-chart-controls';
  const save = async (patch) => { await saveViewConfig(patch); renderView(); };
  const select = (labelText, options, value, onChange) => {
    const label = document.createElement('label');
    label.className = 'database-chart-control';
    label.appendChild(document.createTextNode(labelText));
    const sel = document.createElement('select');
    sel.className = 'database-filter-field';
    options.forEach(([v, t]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = t;
      sel.appendChild(opt);
    });
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    label.appendChild(sel);
    controls.appendChild(label);
    return sel;
  };
  const groupCol = findColumn(state.columns, cfg.groupBy);
  const numericCols = state.columns.filter((c) => columnKind(c) === 'number' || c.type === 'formula');
  select('Tipo', [['bar', 'Barras'], ['line', 'Líneas'], ['pie', 'Torta']], cfg.chartType || 'bar', (v) => save({ chartType: v }));
  select('Agrupar por', state.columns.filter((c) => c.type !== 'formula').map((c) => [c.id, c.name]), cfg.groupBy || '', (v) => save({ groupBy: v }));
  if (groupCol && columnKind(groupCol) === 'date') {
    select('Por', DATE_BUCKETS, cfg.dateBucket || 'month', (v) => save({ dateBucket: v }));
  }
  const measureOptions = [['count', 'Cantidad de filas']];
  numericCols.forEach((c) => {
    measureOptions.push([`sum:${c.id}`, `Suma de ${c.name}`], [`avg:${c.id}`, `Promedio de ${c.name}`]);
  });
  const measureValue = cfg.measure && cfg.measure !== 'count' && cfg.valueCol ? `${cfg.measure}:${cfg.valueCol}` : 'count';
  select('Medir', measureOptions, measureValue, (v) => {
    if (v === 'count') save({ measure: 'count', valueCol: null });
    else {
      const [measure, valueCol] = v.split(':');
      save({ measure, valueCol });
    }
  });
  wrap.appendChild(controls);

  const host = document.createElement('div');
  host.className = 'database-chart-host';
  wrap.appendChild(host);
  viewBodyEl.appendChild(wrap);

  const { data, time, valueLabel, groupName } = chartData(cfg);
  window.mdCharts.render(host, {
    type: cfg.chartType || 'bar',
    data,
    time,
    valueLabel,
    labelTitle: groupName,
    title: `${valueLabel} por ${groupName || ''}`,
    emptyText: groupCol ? 'Sin filas para graficar (revisá los filtros de la vista).' : 'Elegí una columna en "Agrupar por".'
  });
}

// ---- CSV: exportar la vista actual / importar como base nueva ----

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function exportCsv() {
  if (!state.databaseId) return;
  const rows = filteredRows();
  const lines = [state.columns.map((c) => csvEscape(c.name)).join(',')];
  rows.forEach((row) => {
    lines.push(state.columns.map((col) => {
      const v = cellDisplayValue(col, row, state.columns);
      if (col.type === 'checkbox') return v ? 'true' : 'false';
      if (col.type === 'created_time') return v ? isoDay(new Date(v)) : '';
      return csvEscape(displayText(v));
    }).join(','));
  });
  const db = state.databases.find((d) => d.id === state.databaseId);
  const saved = await window.mdEditor.db.exportCsv(lines.join('\r\n') + '\r\n', db ? db.name : 'base-de-datos');
  if (saved) alert(`Exportadas ${rows.length} fila(s) a:\n${saved}`);
}

// Parser CSV (RFC 4180): comillas, "" escapado y saltos de línea dentro de
// comillas. El separador se adivina de la primera línea: coma, punto y coma
// (Excel en español) o tabulador.
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const count = (ch) => firstLine.split(ch).length - 1;
  const sep = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Fecha en ISO desde "2026-10-03" o "03/10/2026" (día/mes/año).
function toIsoDate(s) {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function toNumber(s) {
  const t = s.trim().replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(t)) return null;
  // "1.234,5" (es) o "1,234.5" (en): el último separador es el decimal.
  const lastSep = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  const normalized = lastSep === -1 ? t : t.slice(0, lastSep).replace(/[.,]/g, '') + '.' + t.slice(lastSep + 1);
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const TRUE_WORDS = ['true', 'sí', 'si', 'yes', 'x', '1', 'verdadero'];
const FALSE_WORDS = ['false', 'no', '0', 'falso', ''];

// Tipo de cada columna según sus valores: casilla, número, fecha, selección
// única (pocos valores repetidos) o texto.
function inferColumn(values) {
  const filled = values.map((v) => v.trim()).filter((v) => v !== '');
  if (!filled.length) return { type: 'text' };
  const lower = filled.map((v) => v.toLowerCase());
  if (lower.every((v) => TRUE_WORDS.includes(v) || FALSE_WORDS.includes(v)) && lower.some((v) => !['1', '0'].includes(v))) return { type: 'checkbox' };
  if (filled.every((v) => toIsoDate(v))) return { type: 'date' };
  if (filled.every((v) => toNumber(v) !== null)) return { type: 'number' };
  const distinct = Array.from(new Set(filled));
  if (distinct.length <= 8 && filled.length >= distinct.length * 2 && distinct.every((v) => v.length <= 40)) {
    return { type: 'select', options: { choices: distinct.map((label, i) => ({ id: crypto.randomUUID(), label, color: CHOICE_COLORS[i % CHOICE_COLORS.length] })) } };
  }
  return { type: 'text' };
}

function csvCellValue(col, raw) {
  const v = (raw || '').trim();
  if (v === '') return null;
  switch (col.type) {
    case 'checkbox': return TRUE_WORDS.includes(v.toLowerCase()) ? '1' : '0';
    case 'date': return toIsoDate(v);
    case 'number': return toNumber(v);
    case 'select': {
      const c = (parseOptions(col).choices || []).find((ch) => ch.label === v);
      return c ? c.id : null;
    }
    default: return v;
  }
}

async function importCsv() {
  if (!root()) return;
  const file = await window.mdEditor.db.importCsv();
  if (!file) return;
  const table = parseCsv(file.content);
  if (table.length < 1) {
    alert('El archivo está vacío.');
    return;
  }
  const headers = table[0].map((h, i) => h.trim() || `Columna ${i + 1}`);
  const body = table.slice(1);
  const db = await window.mdEditor.db.createDatabase(root(), file.name);
  const [titleCol] = await window.mdEditor.db.listColumns(root(), db.id);
  const columns = [];
  for (let i = 0; i < headers.length; i++) {
    const values = body.map((r) => r[i] || '');
    // La primera columna es el "título" de la fila: siempre texto.
    const spec = i === 0 ? { type: 'text' } : inferColumn(values);
    if (i === 0) {
      await window.mdEditor.db.updateColumn(root(), titleCol.id, { name: headers[0] });
      columns.push({ ...titleCol, name: headers[0] });
    } else {
      columns.push(await window.mdEditor.db.createColumn(root(), db.id, { name: headers[i], type: spec.type, options: spec.options }));
    }
  }
  const cellsList = body.map((r) => {
    const cells = {};
    columns.forEach((col, i) => {
      const v = csvCellValue(col, r[i]);
      if (v != null) cells[col.id] = v;
    });
    return cells;
  });
  await window.mdEditor.db.createRows(root(), db.id, cellsList);
  await loadDatabases();
  await selectDatabase(db.id);
  alert(`Importadas ${body.length} fila(s) y ${headers.length} columna(s) en la base "${file.name}".`);
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

  // Columna Fecha: avisos para todas sus filas ("Faltan 3 días para …"),
  // los hace sonar el motor de recordatorios del Home (home.js).
  if (type === 'date') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Avisos (para cada fila con fecha; no avisa si la fila tiene una casilla marcada):';
    host.appendChild(hint);
    const getReminders = window.mdReminderUI.build(host, opts.reminders || []);
    return () => ({ reminders: getReminders() });
  }

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

// Abrir una base con el buscador de filas ya filtrando (búsqueda global).
async function openWithFilter(databaseId, text) {
  await open(databaseId);
  state.filter = text || '';
  filterInput.value = state.filter;
  renderView();
}

// Búsqueda global (search.js): filas de todas las bases de la carpeta cuyo
// texto (celdas, etiquetas de selección, casillas) contiene la consulta.
// Fórmulas y rollups no: habría que calcular todo, y ya se ven al abrir.
async function searchRows(query, limit) {
  const r = root();
  const q = (query || '').trim().toLowerCase();
  if (!r || q.length < 2) return [];
  const out = [];
  const databases = await window.mdEditor.db.listDatabases(r);
  for (const db of databases) {
    const [columns, rows] = await Promise.all([window.mdEditor.db.listColumns(r, db.id), window.mdEditor.db.listRows(r, db.id)]);
    const titleCol = columns[0];
    const textOf = (col, row) => {
      const raw = row.cells[col.id];
      if (raw == null || raw === '') return '';
      if (col.type === 'select') { const c = findChoice(col, raw); return c ? c.label : ''; }
      if (col.type === 'multiselect') return parseJsonArray(raw).map((id) => { const c = findChoice(col, id); return c ? c.label : ''; }).join(' ');
      if (col.type === 'checkbox') return raw === '1' ? col.name : '';
      return String(raw);
    };
    for (const row of rows) {
      for (const col of columns) {
        if (['formula', 'rollup', 'relation', 'created_time'].includes(col.type)) continue;
        const text = textOf(col, row);
        const idx = text.toLowerCase().indexOf(q);
        if (idx === -1) continue;
        out.push({
          databaseId: db.id,
          databaseName: (db.icon ? db.icon + ' ' : '') + db.name,
          rowId: row.id,
          title: (titleCol && textOf(titleCol, row)) || '(sin nombre)',
          column: col.name,
          snippet: text.length > 120 ? '…' + text.slice(Math.max(0, idx - 40), idx + 80) + '…' : text
        });
        break; // una vez por fila alcanza
      }
      if (out.length >= (limit || 50)) return out;
    }
  }
  return out;
}

window.mdDatabase = { open, openWithFilter, searchRows, close, parseCsv, inferColumn, duplicateRow, chartData };

})();
