import { state, root, parseOptions, findChoice, findColumn, parseJsonArray } from './database-state.js';

'use strict';

// Valor mostrado de una celda (con fórmulas y rollups resueltos acá, el
// motor SQLite solo guarda valores crudos), carga de datos relacionados y el
// popover genérico que usan todas las vistas y editores.

export function relatedRowTitle(targetData, rowId) {
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
export function cellDisplayValue(column, row, columns, ctx) {
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

export function evalFormula(column, row, columns, ctx) {
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

export function evalRollup(column, row, columns, ctx) {
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

export async function loadRelatedData() {
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

export let activePopover = null;

export function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  document.removeEventListener('mousedown', onOutsideClick, true);
  document.removeEventListener('keydown', onPopoverKeydown, true);
}

export function onOutsideClick(e) {
  if (activePopover && !activePopover.contains(e.target)) closePopover();
}

export function onPopoverKeydown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closePopover();
  }
}

export function openPopover(anchorEl, className, build) {
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
