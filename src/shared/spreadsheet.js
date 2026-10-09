// Fórmulas de hojas de cálculo sin eval ni acceso a globals. Navegador y Node.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mdSpreadsheet = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';
  function columnName(index) {
    let out = '';
    for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out;
    return out;
  }
  function parseInput(text) {
    if (text === '') return null;
    if (text.startsWith("'")) return text.slice(1);
    if (text.startsWith('=')) return { formula: text.slice(1) };
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) { const date = new Date(text + 'T12:00:00Z'); if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text) return date; }
    if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return Number(text);
    if (/^-?\d+,\d+$/.test(text)) return Number(text.replace(',', '.'));
    return text;
  }
  function editText(cell) {
    if (cell.formula) return '=' + cell.formula;
    const value = cell.value;
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') return value.text || value.richText?.map(r => r.text).join('') || value.error || '';
    return String(value);
  }
  function tokens(source) {
    const out = []; let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) { i++; continue; }
      const rest = source.slice(i);
      let match;
      if ((match = /^(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_. ]*)!\$?[A-Z]+\$?\d+|^\$?[A-Z]+\$?\d+(?![\p{L}\p{N}_])/iu.exec(rest))) out.push({ t: 'ref', v: match[0] });
      else if ((match = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(rest))) out.push({ t: 'value', v: Number(match[0]) });
      else if ((match = /^"(?:[^"]|"")*"/.exec(rest))) out.push({ t: 'value', v: match[0].slice(1, -1).replace(/""/g, '"') });
      else if ((match = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(rest))) out.push({ t: 'id', v: match[0].toUpperCase() });
      else if ((match = /^(?:<=|>=|<>|[+\-*/^&=<>():,;])/.exec(rest))) out.push({ t: match[0] });
      else throw new Error('#N/D');
      i += match[0].length;
      if (out.length > 1000) throw new Error('#N/D');
    }
    out.push({ t: 'end' }); return out;
  }
  const aliases = { SUMA: 'SUM', PROMEDIO: 'AVERAGE', CONTAR: 'COUNT', SI: 'IF', REDONDEAR: 'ROUND', VERDADERO: 'TRUE', FALSO: 'FALSE' };
  const number = (v) => { const n = v == null || v === '' ? 0 : Number(v); if (!Number.isFinite(n)) throw new Error('#VALOR!'); return n; };
  function evaluate(source, reference, range) {
    const list = tokens(source); let index = 0;
    const peek = () => list[index].t;
    const take = (t) => { if (peek() !== t) throw new Error('#N/D'); return list[index++]; };
    function primary() {
      if (peek() === '+' || peek() === '-') { const op = list[index++].t; return { type:'unary', op, value:primary() }; }
      if (peek() === 'value') return { type:'value', value:list[index++].v };
      if (peek() === '(') { index++; const value = expr(); take(')'); return value; }
      if (peek() === 'ref') { const from = list[index++].v; if (peek() === ':') { index++; return { type:'range', from, to:take('ref').v }; } return { type:'ref', from }; }
      if (peek() === 'id') {
        const name = list[index++].v, fn = aliases[name] || name;
        if (['TRUE','FALSE'].includes(fn)) return { type:'value', value:fn === 'TRUE' };
        take('('); const args = [];
        if (peek() !== ')') do { args.push(expr()); if (![',',';'].includes(peek())) break; index++; } while (true);
        take(')'); return { type:'call', fn, args };
      }
      throw new Error('#N/D');
    }
    const precedence = { '=':1, '<>':1, '<':1, '>':1, '<=':1, '>=':1, '&':2, '+':3, '-':3, '*':4, '/':4, '^':5 };
    function expr(min = 0) {
      let left = primary();
      while (precedence[peek()] !== undefined && precedence[peek()] >= min) {
        const op = list[index++].t, right = expr(precedence[op] + (op === '^' ? 0 : 1)); left = { type:'binary', op, left, right };
      }
      return left;
    }
    function run(node) {
      if (node.type === 'value') return node.value;
      if (node.type === 'ref') return reference(node.from);
      if (node.type === 'range') return range(node.from, node.to);
      if (node.type === 'unary') return number(run(node.value)) * (node.op === '-' ? -1 : 1);
      if (node.type === 'call') {
        const { fn } = node;
        if (fn === 'IF' && node.args.length >= 2 && node.args.length <= 3) return run(node.args[0]) ? run(node.args[1]) : node.args[2] ? run(node.args[2]) : false;
        const args = node.args.map(run), flat = args.flat(Infinity).filter(v => typeof v === 'number' && Number.isFinite(v));
        if (fn === 'SUM') return flat.reduce((a,b) => a+b, 0);
        if (fn === 'AVERAGE') { if (!flat.length) throw new Error('#DIV/0!'); return flat.reduce((a,b) => a+b, 0) / flat.length; }
        if (fn === 'MIN') return flat.length ? Math.min(...flat) : 0;
        if (fn === 'MAX') return flat.length ? Math.max(...flat) : 0;
        if (fn === 'COUNT') return flat.length;
        if (fn === 'ROUND' && args.length === 2) { const scale = 10 ** number(args[1]), value = number(args[0]); return Math.sign(value) * Math.round(Math.abs(value) * scale) / scale; }
        throw new Error('#N/D');
      }
      const left = run(node.left), right = run(node.right), op = node.op;
      if (op === '&') return String(left ?? '') + String(right ?? '');
      if (op === '=') return left === right;
      if (op === '<>') return left !== right;
      if (op === '<') return left < right;
      if (op === '>') return left > right;
      if (op === '<=') return left <= right;
      if (op === '>=') return left >= right;
      const a = number(left), b = number(right);
      if (op === '/' && b === 0) throw new Error('#DIV/0!');
      return ({ '+':()=>a+b, '-':()=>a-b, '*':()=>a*b, '/':()=>a/b, '^':()=>a**b })[op]();
    }
    const tree = expr(); take('end'); const result = run(tree);
    if (Array.isArray(result) || (typeof result === 'number' && !Number.isFinite(result))) throw new Error('#VALOR!');
    return result;
  }
  function recalculate(workbook) {
    const cache = new Map(), errors = new Map(), pending = new Set(); let budget = 100000;
    function location(ref, sheet) {
      const bang = ref.lastIndexOf('!');
      if (bang !== -1) { const name = ref.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'"); sheet = workbook.worksheets.find(s => s.name.toLocaleLowerCase() === name.toLocaleLowerCase()); ref = ref.slice(bang + 1); }
      if (!sheet) throw new Error('#REF!');
      const address = ref.replace(/\$/g, '').toUpperCase();
      const match = /^([A-Z]+)([1-9]\d*)$/.exec(address);
      let col = 0; if (match) for (const ch of match[1]) col = col * 26 + ch.charCodeAt(0) - 64;
      if (!match || col > 16384 || Number(match[2]) > 1048576) throw new Error('#REF!');
      return { sheet, address };
    }
    function value(sheet, address, depth = 0) {
      const key = sheet.id + '!' + address;
      if (cache.has(key)) return cache.get(key);
      if (errors.has(key)) throw new Error(errors.get(key));
      if (--budget < 0 || depth > 100) throw new Error('#N/D');
      if (pending.has(key)) throw new Error('#CICLO!');
      const cell = sheet.getCell(address);
      if (!cell.formula) { const val = cell.value; if (val instanceof Date) return val.getTime() / 86400000 + (workbook.properties.date1904 ? 24107 : 25569); return val && typeof val === 'object' ? val.text || val.richText?.map(r => r.text).join('') || null : val; }
      pending.add(key);
      try {
        const result = evaluate(cell.formula,
          (ref) => { const loc = location(ref, sheet); return value(loc.sheet, loc.address, depth + 1); },
          (from, to) => {
            const first = location(from, sheet), last = location(to, first.sheet);
            if (first.sheet !== last.sheet) throw new Error('#REF!');
            const a = first.sheet.getCell(first.address), b = last.sheet.getCell(last.address);
            if ((Math.abs(b.row - a.row) + 1) * (Math.abs(b.col - a.col) + 1) > 10000) throw new Error('#N/D');
            const out = [];
            for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) out.push(value(first.sheet, columnName(c) + r, depth + 1));
            return out;
          });
        cell.value = { formula: cell.formula, result }; cache.set(key, result); return result;
      } catch (error) { errors.set(key, error.message); throw error; }
      finally { pending.delete(key); }
    }
    workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => { if (cell.formula) { try { value(sheet, cell.address); } catch { /* Mostrar error; conservar la fórmula y su caché original. */ } } })));
    workbook.calcProperties.fullCalcOnLoad = true;
    return errors;
  }
  function restoreModel(workbook, model) {
    // El getter de ExcelJS llama «merges» a los rangos, pero el setter lee
    // «mergeCells». Usar el modelo directamente pierde las combinaciones.
    workbook.model = { ...model, worksheets:model.worksheets.map(sheet => ({ ...sheet, mergeCells:sheet.merges || sheet.mergeCells || [] })) };
    workbook.calcProperties = { ...model.calcProperties };
    for (const sheet of model.worksheets) workbook.getWorksheet(sheet.id).rowBreaks = sheet.rowBreaks || [];
    return workbook;
  }
  return { columnName, parseInput, editText, evaluate, recalculate, restoreModel };
});
