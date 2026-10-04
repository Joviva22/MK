import { state, root, parseOptions, parseView, parseJsonArray, findChoice, displayText, filterInput } from './database-state.js';
import { cellDisplayValue } from './database-helpers.js';
import { chartData, filteredRows, renderView } from './database-views.js';
import { petXpForCheck } from './database-cells.js';
import { open } from './database.js';

'use strict';

// Base de datos dentro de una nota (bloque ```database```): opciones
// "clave: valor" (o solo el nombre en la primera línea) — base: Gastos
// vista: Por categoría   filas: 10 — de solo lectura salvo las celdas
// editables, con un botón para abrir la base y editarla. También el widget
// "total de una base" (widgets.js) y la búsqueda global (search.js).

export function parseEmbedSpec(text) {
  const spec = {};
  String(text).split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const m = line.match(/^([\wáéíóúñ]+)\s*:\s*(.+)$/i);
    if (m) spec[m[1].toLowerCase()] = m[2].trim();
    else if (!spec.base) spec.base = line;
  });
  return {
    base: spec.base || spec.database || spec.nombre || '',
    vista: spec.vista || spec.view || '',
    filas: Math.max(1, Math.min(500, Number(spec.filas || spec.rows) || 20))
  };
}

// Calcula con el mismo motor que el panel, "prestándole" el estado un
// instante (todo síncrono, así no se mezcla con el panel si está abierto).
export function withTemporaryState(temp, fn) {
  const keys = ['columns', 'rows', 'views', 'viewId', 'relatedData', 'databaseId', 'filter'];
  const saved = {};
  keys.forEach((k) => { saved[k] = state[k]; });
  Object.assign(state, temp);
  try {
    return fn();
  } finally {
    Object.assign(state, saved);
  }
}

// Widget "total de una base" (widgets.js): suma / promedio / cuenta de una
// columna numérica sobre las filas de una vista (con sus filtros).
export async function widgetTotal(spec) {
  const r = root();
  if (!r) return { error: 'Abrí la carpeta donde está la base de datos.' };
  const databases = await window.mdEditor.db.listDatabases(r);
  const db = databases.find((d) => d.name.toLowerCase() === String(spec.base || '').toLowerCase());
  if (!db) return { error: `No hay una base "${spec.base}". Disponibles: ${databases.map((d) => d.name).join(', ') || '(ninguna)'}.` };
  const [columns, rows, views] = await Promise.all([window.mdEditor.db.listColumns(r, db.id), window.mdEditor.db.listRows(r, db.id), window.mdEditor.db.listViews(r, db.id)]);
  const view = spec.vista ? views.find((v) => v.name.toLowerCase() === spec.vista.toLowerCase()) : views[0];
  if (!view) return { error: `La base "${db.name}" no tiene una vista "${spec.vista}".` };
  const colName = spec.suma || spec.promedio || null;
  const col = colName ? columns.find((c) => c.name.toLowerCase() === colName.toLowerCase()) : null;
  if (colName && !col) return { error: `La base "${db.name}" no tiene una columna "${colName}".` };
  const list = withTemporaryState({ columns, rows, views, viewId: view.id, relatedData: { [db.id]: { columns, rows } }, databaseId: db.id, filter: '' }, () => filteredRows());
  let value = list.length;
  let label = `filas en ${view.name}`;
  if (col) {
    const nums = list.map((row) => Number(cellDisplayValue(col, row, columns))).filter((n) => Number.isFinite(n));
    const sum = nums.reduce((a, b) => a + b, 0);
    value = spec.promedio ? (nums.length ? sum / nums.length : 0) : sum;
    label = `${spec.promedio ? 'promedio' : 'total'} de ${col.name} · ${view.name}`;
  }
  return { value, label, db: db.name, dbId: db.id, count: list.length };
}

export const EMBED_EDITABLE = new Set(['text', 'number', 'date', 'checkbox', 'select']);

// Una celda del bloque ```database```: editable si el tipo lo permite. Los
// eventos no llegan al editor (en Live Preview, un clic no mueve el cursor
// adentro del bloque).
export function embedCell(column, row, shown, r, onSaved) {
  const td = document.createElement('td');
  const stop = (e) => e.stopPropagation();
  td.addEventListener('mousedown', stop);
  if (!EMBED_EDITABLE.has(column.type)) {
    td.textContent = shown;
    return td;
  }
  const save = async (value) => {
    await window.mdEditor.db.setCell(r, row.id, column.id, value);
    onSaved();
  };
  if (column.type === 'checkbox') {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = row.cells[column.id] === '1';
    box.setAttribute('aria-label', column.name);
    box.addEventListener('mousedown', stop);
    box.addEventListener('change', () => {
      petXpForCheck(row, column, box.checked);
      save(box.checked ? '1' : '0');
    });
    td.appendChild(box);
    return td;
  }
  td.textContent = shown;
  td.className = 'db-embed-editable';
  td.tabIndex = 0;
  td.title = 'Clic para editar';
  const startEdit = () => {
    if (td.querySelector('input, select')) return;
    let input;
    if (column.type === 'select') {
      input = document.createElement('select');
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '—';
      input.appendChild(none);
      (parseOptions(column).choices || []).forEach((c) => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.label;
        input.appendChild(o);
      });
      input.value = row.cells[column.id] || '';
      input.addEventListener('change', () => save(input.value || null));
    } else {
      input = document.createElement('input');
      input.type = column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text';
      input.value = row.cells[column.id] || '';
      let done = false;
      const commit = () => {
        if (done) return;
        done = true;
        const v = input.value;
        if (column.type === 'text') save(v);
        else save(v === '' ? null : v);
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { done = true; onSaved(); }
      });
      input.addEventListener('blur', commit);
      if (column.type === 'date') input.addEventListener('change', commit);
    }
    input.className = 'db-embed-input';
    input.setAttribute('aria-label', column.name);
    input.addEventListener('mousedown', stop);
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    if (input.select && column.type !== 'select') input.select();
  };
  td.addEventListener('click', (e) => { e.stopPropagation(); startEdit(); });
  td.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === td) { e.preventDefault(); startEdit(); }
  });
  return td;
}

export async function renderEmbed(host, text) {
  const spec = parseEmbedSpec(text);
  host.innerHTML = '';
  host.classList.add('db-embed');
  const note = (msg) => {
    const d = document.createElement('div');
    d.className = 'db-embed-error';
    d.textContent = '▤ ' + msg;
    host.appendChild(d);
  };
  const r = root();
  if (!r) return note('Abrí la carpeta donde está la base de datos para verla acá.');
  if (!spec.base) return note('Falta el nombre de la base: `base: Nombre`.');
  const databases = await window.mdEditor.db.listDatabases(r);
  const db = databases.find((d) => d.name.toLowerCase() === spec.base.toLowerCase());
  if (!db) return note(`No hay una base "${spec.base}" en esta carpeta. Disponibles: ${databases.map((d) => d.name).join(', ') || '(ninguna)'}.`);
  const [columns, rows, views] = await Promise.all([
    window.mdEditor.db.listColumns(r, db.id), window.mdEditor.db.listRows(r, db.id), window.mdEditor.db.listViews(r, db.id)
  ]);
  const view = spec.vista ? views.find((v) => v.name.toLowerCase() === spec.vista.toLowerCase()) : views[0];
  if (!view) return note(`La base "${db.name}" no tiene una vista "${spec.vista}". Vistas: ${views.map((v) => v.name).join(', ')}.`);

  // Bases relacionadas (para relaciones/rollups), como loadRelatedData.
  const targets = new Set();
  columns.forEach((c) => {
    const o = parseOptions(c);
    if (c.type === 'relation' && o.targetDatabaseId) targets.add(o.targetDatabaseId);
  });
  const relatedData = {};
  await Promise.all(Array.from(targets).map(async (id) => {
    const [cols, rs] = await Promise.all([window.mdEditor.db.listColumns(r, id), window.mdEditor.db.listRows(r, id)]);
    relatedData[id] = { columns: cols, rows: rs };
  }));
  relatedData[db.id] = { columns, rows };

  const cfg = parseView(view);
  const temp = { columns, rows, views, viewId: view.id, relatedData, databaseId: db.id, filter: '' };
  const computed = withTemporaryState(temp, () => {
    if (view.type === 'chart') return { chart: chartData(cfg) };
    const list = filteredRows();
    return {
      total: list.length,
      rows: list.slice(0, spec.filas).map((row) => ({ row, cells: columns.map((c) => displayText(cellDisplayValue(c, row, columns))) }))
    };
  });

  const head = document.createElement('div');
  head.className = 'db-embed-head';
  const title = document.createElement('span');
  title.textContent = `▤ ${db.icon ? db.icon + ' ' : ''}${db.name} · ${view.name}`;
  const openBtn = document.createElement('button');
  openBtn.className = 'db-embed-open';
  openBtn.textContent = 'Abrir';
  openBtn.title = 'Abrir la base para editarla';
  openBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); open(db.id); });
  head.append(title, openBtn);
  host.appendChild(head);

  if (computed.chart) {
    const plot = document.createElement('div');
    host.appendChild(plot);
    window.mdCharts.render(plot, { type: cfg.chartType || 'bar', data: computed.chart.data, time: computed.chart.time, valueLabel: computed.chart.valueLabel, labelTitle: computed.chart.groupName });
    return;
  }
  const table = document.createElement('table');
  table.className = 'db-embed-table';
  const tr = document.createElement('tr');
  columns.forEach((c) => { const th = document.createElement('th'); th.textContent = c.name; tr.appendChild(th); });
  table.appendChild(tr);
  // Editable en el lugar: texto, número, fecha, casilla y selección (clic o
  // Enter). Fórmulas, rollups, relaciones y fechas de creación: solo lectura.
  const rerender = () => renderEmbed(host, text);
  computed.rows.forEach(({ row, cells }) => {
    const tr2 = document.createElement('tr');
    cells.forEach((v, i) => tr2.appendChild(embedCell(columns[i], row, v, r, rerender)));
    table.appendChild(tr2);
  });
  host.appendChild(table);
  if (computed.total > computed.rows.length) {
    const more = document.createElement('div');
    more.className = 'db-embed-more';
    more.textContent = `… y ${computed.total - computed.rows.length} fila(s) más (filas: N para mostrar más)`;
    host.appendChild(more);
  }
}

// Abrir una base con el buscador de filas ya filtrando (búsqueda global).
export async function openWithFilter(databaseId, text) {
  await open(databaseId);
  state.filter = text || '';
  filterInput.value = state.filter;
  renderView();
}

// Búsqueda global (search.js): filas de todas las bases de la carpeta cuyo
// texto (celdas, etiquetas de selección, casillas) contiene la consulta.
// Fórmulas y rollups no: habría que calcular todo, y ya se ven al abrir.
export async function searchRows(query, limit) {
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
