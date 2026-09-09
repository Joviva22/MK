(function () {
'use strict';

// Un .docx importado (ver docximport.js) puede traer imágenes incrustadas
// como data: URI en base64 (cientos de líneas ilegibles) y tablas sin fila
// de encabezado que turndown deja como HTML crudo en una sola línea
// gigante (ver MANUAL.md) — ambas cosas son ruido real en medio de un
// documento que por lo demás es Markdown normal para editar. Ninguna de
// las dos cosas se toca en el contenido real (lo que se guarda/exporta
// sigue intacto): esto solo las pliega visualmente con un widget de
// CodeMirror (markText + replacedWith). Poner el cursor adentro del
// pliegue lo despliega solo — CodeMirror ya trae ese comportamiento con
// clearOnEnter, no hace falta código propio para "editar".

const cm = window.mdCodeMirror;
const DATA_URI_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]{80,}/g;
const HTML_TABLE_RE = /<table[\s\S]*?<\/table>/gi;

let marks = [];

function clearMarks() {
  marks.forEach((m) => m.clear());
  marks = [];
}

// Tablas primero: una imagen incrustada adentro de una celda de una tabla
// HTML cruda no debe generar un segundo pliegue superpuesto, la tabla ya
// se pliega entera.
function findRanges(text) {
  const ranges = [];

  HTML_TABLE_RE.lastIndex = 0;
  let m;
  while ((m = HTML_TABLE_RE.exec(text))) {
    const rows = (m[0].match(/<tr[\s>]/gi) || []).length;
    const firstRow = m[0].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    const cols = firstRow ? (firstRow[1].match(/<t[dh][\s>]/gi) || []).length : 0;
    ranges.push({
      start: m.index,
      end: m.index + m[0].length,
      className: 'folded-html-table',
      label: `[tabla HTML, ${rows} fila(s) × ${cols} columna(s) — clic para ver/editar]`
    });
  }

  DATA_URI_RE.lastIndex = 0;
  while ((m = DATA_URI_RE.exec(text))) {
    if (ranges.some((r) => m.index >= r.start && m.index < r.end)) continue; // ya cubierto por una tabla
    const prefixMatch = m[0].match(/^data:image\/[a-zA-Z0-9.+-]+;base64,/);
    const prefixLen = prefixMatch ? prefixMatch[0].length : 0;
    const sizeKB = Math.round(((m[0].length - prefixLen) * 3) / 4 / 1024);
    ranges.push({
      start: m.index + prefixLen,
      end: m.index + m[0].length,
      className: 'folded-image-data',
      label: `[imagen incrustada, ~${sizeKB} KB — clic para ver/editar]`
    });
  }

  return ranges;
}

function refold() {
  clearMarks();
  const text = cm.getValue();
  findRanges(text).forEach((range) => {
    const from = cm.posFromIndex(range.start);
    const to = cm.posFromIndex(range.end);
    const widget = document.createElement('span');
    widget.className = `folded-clutter ${range.className}`;
    widget.textContent = range.label;
    marks.push(cm.markText(from, to, { replacedWith: widget, clearOnEnter: true }));
  });
}

let debounceTimer = null;
function scheduleRefold() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refold, 150);
}

cm.on('change', scheduleRefold);
cm.on('swapDoc', scheduleRefold);
scheduleRefold();

window.mdFoldClutter = { refold };

})();
