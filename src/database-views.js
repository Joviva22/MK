import { state, root, parseOptions, parseView, parseJsonArray, findColumn, displayText, isoDay, viewTabsEl, viewBodyEl, filtersBtn } from './database-state.js';
import { cellDisplayValue, loadRelatedData, openPopover } from './database-helpers.js';
import { openColumnEditor, openRowEditor, renderCell } from './database-cells.js';

'use strict';

// Pestañas de vista, filtros/orden guardados por vista, duplicar/eliminar
// fila, y las cinco vistas: tabla, tablero, galería, calendario y gráfico.

export function currentViewObj() {
  return state.views.find((v) => v.id === state.viewId) || null;
}

export function renderViewTabs() {
  viewTabsEl.innerHTML = '';
  state.views.forEach((v) => {
    const tab = document.createElement('button');
    tab.className = 'toolbar-button database-view-tab' + (v.id === state.viewId ? ' database-view-tab-active' : '');
    tab.textContent = viewTypeIcon(v.type) + ' ' + v.name;
    tab.setAttribute('aria-pressed', String(v.id === state.viewId));
    tab.title = `${v.name}: otra forma de ver las mismas filas. Clic derecho para configurar.`;
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

export function viewTypeIcon(type) {
  return { table: '▤', board: '▥', gallery: '▦', calendar: '📅', chart: '📊' }[type] || '▤';
}

export function openNewViewPopover(anchorEl) {
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

export function defaultGroupableColumn() {
  const col = state.columns.find((c) => c.type === 'select');
  return col ? col.id : null;
}

export function openViewMenu(anchorEl, view) {
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
      // La lista en memoria puede estar vieja (vistas cambiadas desde un
      // bloque database en una nota): se cuenta con la del disco.
      const current = await window.mdEditor.db.listViews(root(), state.databaseId);
      if (current.filter((v) => v.id !== view.id).length < 1) { alert('No se puede borrar la última vista.'); return; }
      await window.mdEditor.db.deleteView(root(), view.id);
      state.views = await window.mdEditor.db.listViews(root(), state.databaseId);
      if (!state.views.length) {
        await window.mdEditor.db.createView(root(), state.databaseId, { name: 'Tabla', type: 'table', config: {} });
        state.views = await window.mdEditor.db.listViews(root(), state.databaseId);
      }
      state.viewId = state.views[0].id;
      renderViewTabs();
      renderView();
    });
    pop.appendChild(del);
  });
}

// Tipo "de comparación" de una columna: define qué operadores de filtro
// ofrece y cómo se ordena. Fórmula puede devolver cualquier cosa, así que se
// compara como texto; rollup siempre es numérico.
export function columnKind(col) {
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

export const FILTER_OPS = {
  text: [['contains', 'contiene'], ['not_contains', 'no contiene'], ['eq', 'es igual a'], ['empty', 'está vacío'], ['not_empty', 'no está vacío']],
  number: [['eq', '='], ['neq', '≠'], ['gt', '>'], ['lt', '<'], ['gte', '≥'], ['lte', '≤'], ['empty', 'está vacío'], ['not_empty', 'no está vacío']],
  date: [['eq', 'es'], ['before', 'antes de'], ['after', 'después de'], ['today', 'es hoy'], ['overdue', 'antes de hoy (vencida)'], ['upcoming', 'hoy o después'], ['this_week', 'esta semana'], ['empty', 'está vacía'], ['not_empty', 'no está vacía']],
  checkbox: [['checked', 'está marcada'], ['unchecked', 'no está marcada']],
  select: [['is', 'es'], ['is_not', 'no es'], ['empty', 'está vacía'], ['not_empty', 'no está vacía']],
  multiselect: [['has', 'contiene'], ['not_has', 'no contiene'], ['empty', 'está vacía'], ['not_empty', 'no está vacía']]
};

export const OPS_WITH_VALUE = new Set(['contains', 'not_contains', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'before', 'after', 'is', 'is_not', 'has', 'not_has']);

// Valor "comparable" de una celda según su kind: string YYYY-MM-DD para
// fechas, id de opción para select, array de ids para multiselect, número o
// null, boolean, o texto.
export function comparableValue(col, row) {
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

export function isEmptyValue(v) {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

export function matchesFilter(filter, row) {
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

export function compareRows(col, a, b) {
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
export function viewSorts(cfg) {
  const list = Array.isArray(cfg.sorts) ? cfg.sorts : (cfg.sort ? [cfg.sort] : []);
  return list.filter((s) => findColumn(state.columns, s.columnId));
}

export function sortRows(rows, sorts) {
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

export function currentViewConfig() {
  return parseView(currentViewObj());
}

export async function saveViewConfig(patch) {
  const view = currentViewObj();
  if (!view) return;
  const cfg = { ...parseView(view), ...patch };
  view.config = JSON.stringify(cfg);
  await window.mdEditor.db.updateView(root(), view.id, { config: cfg });
}

export function filteredRows() {
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

export function updateFiltersButton() {
  const filters = currentViewConfig().filters || [];
  filtersBtn.textContent = filters.length ? `Filtros (${filters.length})` : 'Filtros';
  filtersBtn.classList.toggle('database-filters-active', filters.length > 0);
}

export function valueControlFor(col, filter, onChange) {
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

export function openFiltersPopover() {
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

// Copia los valores guardados (no fórmulas/rollups/fecha de creación, que se
// calculan solos) y las relaciones, y deja la copia justo debajo.
export async function duplicateRow(row) {
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

export function openRowMenu(anchorEl, row) {
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
export function openColumnMenu(th, col) {
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

export function renderView() {
  viewBodyEl.innerHTML = '';
  const view = currentViewObj();
  if (!view) return;
  updateFiltersButton();
  renderViewSummary(view);
  if (view.type === 'board') renderBoardView();
  else if (view.type === 'gallery') renderGalleryView();
  else if (view.type === 'calendar') renderCalendarView();
  else if (view.type === 'chart') renderChartView();
  else renderTableView();
}

function renderViewSummary(view) {
  const summary = document.getElementById('database-view-summary');
  if (!summary) return;
  summary.replaceChildren();
  const descriptions = { table: 'Tabla: edita cada dato en su celda.', board: 'Tablero: organiza las mismas filas por estado.', gallery: 'Galería: cada tarjeta corresponde a una fila.', calendar: 'Calendario: muestra las filas que tienen fecha.', chart: 'Gráfico: resume los datos de las filas.' };
  const text = document.createElement('span');
  text.textContent = `${descriptions[view.type] || descriptions.table} ${filteredRows().length} de ${state.rows.length} filas.`;
  summary.appendChild(text);
  const filters = currentViewConfig().filters || [];
  filters.forEach(filter => {
    const col = findColumn(state.columns, filter.columnId);
    if (!col) return;
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'database-filter-summary';
    const operation = (FILTER_OPS[columnKind(col)] || FILTER_OPS.text).find(([op]) => op === filter.op)?.[1] || filter.op;
    const choice = parseOptions(col).choices?.find(c => c.id === filter.value);
    chip.textContent = `${col.name} ${operation}${OPS_WITH_VALUE.has(filter.op) ? ' ' + (choice?.label || filter.value || '…') : ''}`;
    chip.title = 'Editar los filtros de esta vista'; chip.addEventListener('click', openFiltersPopover); summary.appendChild(chip);
  });
  if (filters.length || state.filter) {
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'toolbar-button database-clear-filters'; clear.textContent = 'Mostrar todas las filas';
    clear.addEventListener('click', async () => { state.filter = ''; document.getElementById('database-filter-input').value = ''; await saveViewConfig({ filters: [] }); renderView(); });
    summary.appendChild(clear);
  }
  if (view.type === 'calendar') {
    const missing = state.rows.filter(row => !row.cells[currentViewConfig().dateColumn]).length;
    if (missing) { const note = document.createElement('small'); note.textContent = `${missing} filas sin fecha no aparecen en el calendario.`; summary.appendChild(note); }
  }
}

export function renderTableView() {
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
    tr.dataset.rowId = row.id;
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

export function renderBoardView() {
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

export function renderGalleryView() {
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

export let calCursor = new Date(); // cualquier día del mes visible

export function renderCalendarView() {
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

export const DATE_BUCKETS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año']];

export function bucketKey(iso, bucket) {
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

export function bucketLabel(key, bucket) {
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
export function fillBuckets(keys, bucket) {
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
export function groupKeysFor(col, row, bucket) {
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

export function chartData(cfg) {
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

export function renderChartView() {
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
