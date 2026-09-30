// CSV (RFC 4180) para las bases de datos: separador adivinado (coma, punto y
// coma de Excel en español, o tabulador), comillas y saltos de línea dentro
// de comillas; números y fechas en formato es/en. Ventana: window.mdCsv
// (ver database.js). Node: pruebas unitarias.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mdCsv = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  function csvEscape(value) {
    const s = value == null ? '' : String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

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

  return { csvEscape, parseCsv, toIsoDate, toNumber, TRUE_WORDS, FALSE_WORDS };
});
