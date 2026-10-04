import { state, root, parseOptions, displayText, isoDay, CHOICE_COLORS } from './database-state.js';
import { cellDisplayValue } from './database-helpers.js';
import { filteredRows } from './database-views.js';
import { loadDatabases, selectDatabase } from './database.js';

'use strict';

// Exportar la vista actual a CSV / importar un CSV como base nueva. El
// parser y los formatos están en shared/csv.js (con pruebas unitarias).

// ---- CSV: exportar la vista actual / importar como base nueva ----
// El parser y los formatos están en shared/csv.js (con pruebas unitarias).
export const { csvEscape, parseCsv, toIsoDate, toNumber, TRUE_WORDS, FALSE_WORDS } = window.mdCsv;

export async function exportCsv() {
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

// Tipo de cada columna según sus valores: casilla, número, fecha, selección
// única (pocos valores repetidos) o texto.
export function inferColumn(values) {
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

export function csvCellValue(col, raw) {
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

export async function importCsv() {
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
