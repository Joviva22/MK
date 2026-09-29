(function () {
'use strict';

const contextMenuEl = document.createElement('div');
contextMenuEl.id = 'context-menu';
contextMenuEl.className = 'context-menu';
contextMenuEl.hidden = true;
document.body.appendChild(contextMenuEl);

function ensureFreshLine(cm) {
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  if (line.length > 0) {
    cm.replaceRange('\n', cursor);
    cm.setCursor(cursor.line + 1, 0);
  }
}

function insertHeading(cm) {
  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  const prefix = '## ';
  cm.replaceRange(prefix, cursor);
  cm.setCursor(cursor.line, cursor.ch + prefix.length);
  cm.focus();
}

// Antes insertaba siempre una tabla fija de 2x1 y había que agregar filas/
// columnas a mano tecleando pipes — ahora se pregunta el tamaño y arma la
// tabla completa de una, encabezados incluidos.
function insertTable(cm) {
  const colsInput = prompt('¿Cuántas columnas?', '2');
  if (colsInput === null) return;
  const rowsInput = prompt('¿Cuántas filas de datos? (sin contar el encabezado)', '2');
  if (rowsInput === null) return;
  const cols = Math.min(20, Math.max(1, parseInt(colsInput, 10) || 2));
  const rows = Math.min(50, Math.max(1, parseInt(rowsInput, 10) || 2));

  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  const header = `| ${Array.from({ length: cols }, (_, i) => `Columna ${i + 1}`).join(' | ')} |`;
  const sep = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  const bodyRows = Array.from({ length: rows }, () => `| ${Array.from({ length: cols }, () => '  ').join(' | ')} |`);
  const block = [header, sep, ...bodyRows].join('\n');
  cm.replaceRange(block, cursor);
  cm.setSelection({ line: cursor.line, ch: 2 }, { line: cursor.line, ch: 2 + 'Columna 1'.length });
  cm.focus();
}

function insertLink(cm) {
  const from = cm.getCursor('from');
  const text = cm.getSelection() || 'texto';
  cm.replaceSelection(`[${text}](url)`);
  const urlStart = from.ch + `[${text}](`.length;
  cm.setSelection({ line: from.line, ch: urlStart }, { line: from.line, ch: urlStart + 3 });
  cm.focus();
}

function insertImage(cm) {
  const cursor = cm.getCursor();
  cm.replaceRange('![alt](ruta.png)', cursor);
  cm.setSelection({ line: cursor.line, ch: cursor.ch + 2 }, { line: cursor.line, ch: cursor.ch + 5 });
  cm.focus();
}

function insertCodeBlock(cm) {
  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  cm.replaceRange('```\ncódigo\n```', cursor);
  cm.setSelection({ line: cursor.line + 1, ch: 0 }, { line: cursor.line + 1, ch: 6 });
  cm.focus();
}

function insertCallout(cm) {
  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  cm.replaceRange('> [!NOTE]\n> ', cursor);
  cm.setCursor(cursor.line + 1, 2);
  cm.focus();
}

// Editar tablas Markdown ya escritas (no solo crearlas con "Insertar
// tabla"). Detecta el bloque de tabla en la posición del clic derecho
// (findTableRange) y opera sobre todas sus filas a la vez.
function isTableRow(text) {
  return /^\s*\|.*\|\s*$/.test(text);
}

function isSeparatorRow(text) {
  return /^\s*\|(\s*:?-{1,}:?\s*\|)+\s*$/.test(text);
}

function findTableRange(cm, line) {
  if (line < 0 || line >= cm.lineCount() || !isTableRow(cm.getLine(line))) return null;
  let start = line;
  while (start - 1 >= 0 && isTableRow(cm.getLine(start - 1))) start--;
  let end = line;
  while (end + 1 < cm.lineCount() && isTableRow(cm.getLine(end + 1))) end++;
  if (end - start < 1 || !isSeparatorRow(cm.getLine(start + 1))) return null;
  return { start, end };
}

function splitCells(text) {
  const t = text.trim().replace(/^\|/, '').replace(/\|$/, '');
  return t.split('|').map((c) => c.trim());
}

function buildRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

function columnIndexAt(cm, pos) {
  const before = cm.getLine(pos.line).slice(0, pos.ch);
  const pipes = (before.match(/\|/g) || []).length;
  return Math.max(0, pipes - 1);
}

function insertTableColumn(cm, pos) {
  const range = findTableRange(cm, pos.line);
  if (!range) return;
  const colIndex = columnIndexAt(cm, pos);
  for (let n = range.start; n <= range.end; n++) {
    const cells = splitCells(cm.getLine(n));
    cells.splice(colIndex + 1, 0, n === range.start + 1 ? '---' : '');
    cm.replaceRange(buildRow(cells), { line: n, ch: 0 }, { line: n, ch: cm.getLine(n).length });
  }
  cm.focus();
}

function insertTableRow(cm, pos) {
  const range = findTableRange(cm, pos.line);
  if (!range) return;
  const colCount = splitCells(cm.getLine(range.start)).length;
  const newRow = buildRow(new Array(colCount).fill(''));
  const insertAfter = pos.line === range.start ? range.start + 1 : pos.line;
  cm.replaceRange('\n' + newRow, { line: insertAfter, ch: cm.getLine(insertAfter).length });
  cm.focus();
}

function alignTableAt(cm, pos) {
  const range = findTableRange(cm, pos.line);
  if (!range) return;
  const rows = [];
  for (let n = range.start; n <= range.end; n++) rows.push(splitCells(cm.getLine(n)));
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  rows.forEach((r) => { while (r.length < colCount) r.push(''); });

  const SEP = 1;
  const aligns = rows[SEP].map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return 'none';
  });

  const widths = [];
  for (let c = 0; c < colCount; c++) {
    let w = 3;
    rows.forEach((r, i) => { if (i !== SEP) w = Math.max(w, r[c].length); });
    widths[c] = w;
  }

  const built = rows.map((r, i) => {
    if (i === SEP) {
      return buildRow(r.map((_, c) => {
        const w = widths[c];
        if (aligns[c] === 'center') return ':' + '-'.repeat(Math.max(1, w - 2)) + ':';
        if (aligns[c] === 'right') return '-'.repeat(Math.max(1, w - 1)) + ':';
        if (aligns[c] === 'left') return ':' + '-'.repeat(Math.max(1, w - 1));
        return '-'.repeat(w);
      }));
    }
    return buildRow(r.map((cell, c) => cell.padEnd(widths[c])));
  });

  cm.replaceRange(built.join('\n'), { line: range.start, ch: 0 }, { line: range.end, ch: cm.getLine(range.end).length });
  cm.focus();
}

function insertHighlight(cm) {
  const from = cm.getCursor('from');
  const text = cm.getSelection() || 'texto';
  cm.replaceSelection(`==${text}==`);
  cm.setSelection({ line: from.line, ch: from.ch + 2 }, { line: from.line, ch: from.ch + 2 + text.length });
  cm.focus();
}

let clickWordRange = null; // {anchor, head} en el cm del "word" bajo el clic derecho, si había uno
let clickPos = null; // posición exacta del clic derecho (el cursor real de CodeMirror no se mueve con clic derecho)
let pendingSpellcheck = null; // último {misspelledWord, dictionarySuggestions} recibido de main.js

function insertSpellSuggestion(cm, suggestion) {
  if (!clickWordRange) return;
  cm.replaceRange(suggestion, clickWordRange.anchor, clickWordRange.head);
  cm.focus();
}

const MENU_ITEMS = [
  { label: 'Copiar', action: 'copy' },
  { label: 'Cortar', action: 'cut' },
  { label: 'Pegar', action: 'paste' },
  { label: 'Seleccionar todo', action: 'selectall' },
  { sep: true },
  { label: 'Insertar título (H2)', action: 'heading' },
  { label: 'Insertar tabla', action: 'table' },
  { label: 'Insertar enlace', action: 'link' },
  { label: 'Insertar imagen', action: 'image' },
  { label: 'Insertar bloque de código', action: 'code' },
  { label: 'Insertar cita / callout', action: 'callout' },
  { label: 'Subrayar / resaltar texto', action: 'highlight' }
];

function runAction(action, value) {
  const cm = window.mdCodeMirror;
  switch (action) {
    case 'copy':
      if (cm.somethingSelected()) window.mdEditor.clipboardWriteText(cm.getSelection());
      break;
    case 'cut':
      if (cm.somethingSelected()) {
        window.mdEditor.clipboardWriteText(cm.getSelection());
        cm.replaceSelection('');
      }
      break;
    case 'paste': {
      window.mdEditor.clipboardReadText().then((text) => {
        if (text) cm.replaceSelection(text);
        cm.focus();
      });
      break;
    }
    case 'selectall':
      cm.execCommand('selectAll');
      break;
    case 'heading': insertHeading(cm); break;
    case 'table': insertTable(cm); break;
    case 'link': insertLink(cm); break;
    case 'image': insertImage(cm); break;
    case 'code': insertCodeBlock(cm); break;
    case 'callout': insertCallout(cm); break;
    case 'highlight': insertHighlight(cm); break;
    case 'tableAddCol': insertTableColumn(cm, clickPos); break;
    case 'tableAddRow': insertTableRow(cm, clickPos); break;
    case 'tableAlign': alignTableAt(cm, clickPos); break;
    case 'spellfix': insertSpellSuggestion(cm, value); break;
    case 'spellAddWord': window.mdEditor.addWordToDictionary(value); break;
    default: break;
  }
}

function buildItems() {
  const items = [];
  if (pendingSpellcheck && pendingSpellcheck.misspelledWord && clickWordRange) {
    const word = pendingSpellcheck.misspelledWord;
    const suggestions = (pendingSpellcheck.dictionarySuggestions || []).slice(0, 5);
    if (suggestions.length) {
      suggestions.forEach((s) => items.push({ label: s, action: 'spellfix', value: s }));
    } else {
      items.push({ label: 'Sin sugerencias', disabled: true });
    }
    items.push({ label: `Agregar "${word}" al diccionario`, action: 'spellAddWord', value: word });
    items.push({ sep: true });
  }
  if (clickPos && findTableRange(window.mdCodeMirror, clickPos.line)) {
    items.push({ label: 'Agregar columna acá', action: 'tableAddCol' });
    items.push({ label: 'Agregar fila acá', action: 'tableAddRow' });
    items.push({ label: 'Alinear tabla', action: 'tableAlign' });
    items.push({ sep: true });
  }
  return items.concat(MENU_ITEMS);
}

function renderMenuItems() {
  contextMenuEl.innerHTML = '';
  const hasSelection = window.mdCodeMirror.somethingSelected();
  buildItems().forEach((item) => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-sep';
      contextMenuEl.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.textContent = item.label;
    if (item.disabled || ((item.action === 'copy' || item.action === 'cut') && !hasSelection)) {
      btn.disabled = true;
    }
    btn.addEventListener('click', () => {
      hideContextMenu();
      runAction(item.action, item.value);
    });
    contextMenuEl.appendChild(btn);
  });
}

function showContextMenu(x, y) {
  renderMenuItems();
  contextMenuEl.style.left = `${x}px`;
  contextMenuEl.style.top = `${y}px`;
  contextMenuEl.hidden = false;

  const rect = contextMenuEl.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 4;
  const maxY = window.innerHeight - rect.height - 4;
  if (x > maxX) contextMenuEl.style.left = `${Math.max(4, maxX)}px`;
  if (y > maxY) contextMenuEl.style.top = `${Math.max(4, maxY)}px`;
}

function hideContextMenu() {
  contextMenuEl.hidden = true;
}

document.getElementById('editor-pane').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const cm = window.mdCodeMirror;
  cm.focus();
  pendingSpellcheck = null;
  const pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
  const word = cm.findWordAt(pos);
  clickWordRange = word && word.anchor.ch !== word.head.ch ? { anchor: word.anchor, head: word.head } : null;
  clickPos = pos;
  showContextMenu(e.clientX, e.clientY);
});

// Llega async desde main.js (evento 'context-menu' de webContents) — casi
// siempre después de que el menú ya se mostró, así que si sigue abierto lo
// volvemos a dibujar para sumarle las sugerencias arriba.
window.mdEditor.onSpellcheckSuggestions((data) => {
  pendingSpellcheck = data;
  if (!contextMenuEl.hidden) renderMenuItems();
});

document.addEventListener('click', (e) => {
  if (!contextMenuEl.contains(e.target)) hideContextMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideContextMenu();
});

})();
