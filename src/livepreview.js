(function () {
'use strict';

// Modo "Live Preview" (cuarto modo, además de normal / enfoque / lectura):
// se escribe en el mismo CodeMirror, pero el Markdown se ve renderizado.
// Solo la(s) línea(s) del cursor muestran la sintaxis cruda; en el resto:
//   - los marcadores (#, **, *, ~~, `, [](url), >) se ocultan con marcas
//     "replacedWith" vacías, a partir de los tokens "formatting" del modo
//     markdown (highlightFormatting) — encabezados, negrita, etc. ya los
//     estiliza CSS (.cm-live .cm-header-1, .cm-strong...);
//   - imágenes, casillas de tareas, wikilinks, ==resaltado==, $fórmulas$,
//     separadores (---), tablas, callouts, diagramas Mermaid y bloques $$
//     se reemplazan por un widget renderizado. Tablas, callouts, Mermaid y $$
//     son "bloques": se muestran crudos si el
//     cursor está en cualquiera de sus líneas.
//
// Cada cambio de texto reconstruye todo (con un pequeño debounce); mover el
// cursor de línea solo redibuja las unidades afectadas. Las marcas (a diferencia de clases CSS
// por línea) hacen que CodeMirror vuelva a medir la línea, así el cursor
// no queda desfasado cuando aparecen/desaparecen los marcadores.

const cm = window.mdCodeMirror;
const wrapper = cm.getWrapperElement();
const LIVE_MODE = { name: 'markdown', highlightFormatting: true, strikethrough: true };

let enabled = false;
let marks = [];
let lineClasses = []; // [line handle, where, className]
let lastActiveKey = '';
let lastLineClassKey = '';
let rebuildTimer = null;
const htmlCache = new Map();

function isMarkdownDoc() {
  const mode = cm.getOption('mode');
  return (typeof mode === 'string' ? mode : mode && mode.name) === 'markdown';
}

// Líneas "activas": las de todos los cursores/selecciones.
function activeLines() {
  const set = new Set();
  cm.listSelections().forEach((sel) => {
    const a = Math.min(sel.anchor.line, sel.head.line);
    const b = Math.max(sel.anchor.line, sel.head.line);
    for (let l = a; l <= b; l++) set.add(l);
  });
  return set;
}

function addLineClass(line, where, cls) {
  const handle = cm.addLineClass(line, where, cls);
  lineClasses.push([handle, where, cls]);
}

function hideRange(line, from, to) {
  const span = document.createElement('span');
  span.className = 'mk-live-hidden';
  marks.push(cm.markText({ line, ch: from }, { line, ch: to }, { replacedWith: span, inclusiveLeft: false, inclusiveRight: false }));
}

// Widget en un rango de una línea (o de varias, para bloques).
function replaceWith(from, to, node, cursorOnClick) {
  node.classList.add('mk-live-widget');
  if (cursorOnClick) {
    // Clic en el widget: mandar el cursor ahí para editarlo en crudo.
    node.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      cm.focus();
      cm.setCursor(from);
    });
  }
  marks.push(cm.markText(from, to, { replacedWith: node, handleMouseEvents: false }));
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function renderMarkdown(src) {
  if (htmlCache.has(src)) return htmlCache.get(src);
  let html = '';
  try {
    html = window.mdRenderMarkdownForExport
      ? window.mdRenderMarkdownForExport(src, window.mdState.currentFilePath, window.mdState.rootFolder)
      : DOMPurify.sanitize(marked.parse(src));
  } catch (e) {
    html = '';
  }
  htmlCache.set(src, html);
  if (htmlCache.size > 300) htmlCache.delete(htmlCache.keys().next().value);
  return html;
}

function renderKatex(expr, display) {
  const key = (display ? '$$' : '$') + expr;
  if (htmlCache.has(key)) return htmlCache.get(key);
  let html;
  try {
    html = katex.renderToString(expr, { throwOnError: false, displayMode: display });
  } catch (e) {
    html = null;
  }
  htmlCache.set(key, html);
  return html;
}

// Misma regla que el preview: rutas relativas al archivo, sin salir de la
// carpeta abierta (o de la carpeta del archivo si no hay ninguna abierta).
function resolveImageSrc(src) {
  if (/^(https?:|data:|md-local:)/i.test(src)) return src;
  const base = window.mdState.currentFilePath;
  if (!base) return null;
  const absolute = window.mdEditor.resolveLocalPath(base, decodeURIComponent(src));
  const root = window.mdState.rootFolder || window.mdEditor.dirName(base);
  if (root && !window.mdEditor.isPathAllowed(root, absolute)) return null;
  return window.mdEditor.toLocalUrl(absolute);
}

// ---- diagramas Mermaid ----
// mermaid.render es async: el widget se crea con un "dibujando..." y se
// completa cuando termina. El SVG se cachea por código + tema.

let mermaidSeq = 0;
const mermaidCache = new Map();

function isDarkBg() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const m = bg.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

function renderMermaid(code) {
  const div = el('div', 'mk-live-mermaid');
  const theme = isDarkBg() ? 'dark' : 'neutral';
  const key = theme + '\n' + code;
  if (mermaidCache.has(key)) {
    div.innerHTML = mermaidCache.get(key);
    return div;
  }
  if (!window.mermaid) {
    div.textContent = code;
    return div;
  }
  div.textContent = 'Dibujando diagrama…';
  window.mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' });
  window.mermaid.render(`mk-live-mermaid-${++mermaidSeq}`, code).then(({ svg }) => {
    mermaidCache.set(key, svg);
    if (mermaidCache.size > 50) mermaidCache.delete(mermaidCache.keys().next().value);
    div.innerHTML = svg;
  }).catch((err) => {
    div.classList.add('mk-live-mermaid-error');
    div.textContent = 'Diagrama con errores: ' + ((err && err.message) || err);
  });
  return div;
}

// ---- widgets de una línea ----

const INLINE_PATTERNS = [
  {
    re: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    build: (m) => {
      const src = resolveImageSrc(m[2]);
      if (!src) return null;
      const img = el('img', 'mk-live-img');
      img.src = src;
      img.alt = m[1];
      img.title = m[1] || m[2];
      return { node: img, cursorOnClick: true };
    }
  },
  {
    re: /!\[\[([^\]]+\.(?:png|jpe?g|gif|webp|svg|bmp))\]\]/gi,
    build: (m) => {
      const src = resolveImageSrc(m[1]);
      if (!src) return null;
      const img = el('img', 'mk-live-img');
      img.src = src;
      img.alt = m[1];
      return { node: img, cursorOnClick: true };
    }
  },
  {
    re: /(?<!!)\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g,
    build: (m) => {
      const target = m[1].trim();
      const a = el('span', 'mk-live-wikilink', (m[2] || m[1]).trim());
      a.title = `Abrir "${target}" (clic) · Alt+clic para editar`;
      a.addEventListener('mousedown', async (e) => {
        if (e.button !== 0 || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        const root = window.mdState.rootFolder;
        const found = root ? await window.mdEditor.resolveWikilink(root, target) : null;
        if (found) window.openFileAtPath(found);
        else alert(`No encontré la nota "${target}" en la carpeta abierta.`);
      });
      return { node: a, cursorOnClick: true };
    }
  },
  {
    re: /==([^=\n]+)==/g,
    build: (m) => ({ node: el('mark', 'mk-live-mark', m[1]), cursorOnClick: true })
  },
  {
    re: /(?<![$\\])\$([^$\n]+?)\$(?!\$)/g,
    build: (m) => {
      const html = renderKatex(m[1], false);
      if (!html) return null;
      const span = el('span', 'mk-live-math');
      span.innerHTML = html;
      return { node: span, cursorOnClick: true };
    }
  }
];

// Rangos de `código inline`: adentro no se renderiza nada.
function codeSpans(text) {
  const spans = [];
  const re = /`[^`\n]+`/g;
  let m;
  while ((m = re.exec(text))) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

function overlaps(ranges, from, to) {
  return ranges.some(([a, b]) => from < b && to > a);
}

function decorateLine(line, text, prevText) {
  const taken = []; // rangos ya reemplazados por un widget (no pueden solaparse)
  const code = codeSpans(text);

  // Separador ---, *** o ___ solo (y no subrayado de un encabezado setext).
  if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(text) && (prevText == null || prevText.trim() === '')) {
    replaceWith({ line, ch: 0 }, { line, ch: text.length }, el('hr', 'mk-live-hr'), true);
    return;
  }

  // Casilla de tarea: "- [ ]" / "* [x]" → checkbox clicable.
  const task = text.match(/^(\s*[-*+]\s+)\[([ xX])\]/);
  if (task) {
    const from = task[1].length;
    const box = el('input', 'mk-live-task');
    box.type = 'checkbox';
    box.checked = task[2].toLowerCase() === 'x';
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cm.replaceRange(box.checked ? '[ ]' : '[x]', { line, ch: from }, { line, ch: from + 3 });
    });
    replaceWith({ line, ch: from }, { line, ch: from + 3 }, box, false);
    taken.push([from, from + 3]);
    if (box.checked) {
      marks.push(cm.markText({ line, ch: from + 3 }, { line, ch: text.length }, { className: 'mk-live-task-done' }));
    }
  }

  INLINE_PATTERNS.forEach(({ re, build }) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const from = m.index;
      const to = from + m[0].length;
      if (overlaps(code, from, to) || overlaps(taken, from, to)) continue;
      const built = build(m);
      if (!built) continue;
      replaceWith({ line, ch: from }, { line, ch: to }, built.node, built.cursorOnClick);
      taken.push([from, to]);
    }
  });

  // #etiquetas: solo estilo (no reemplazo).
  const tagRe = /(^|[\s(])#([a-zA-Z][\w-]*)/g;
  let t;
  while ((t = tagRe.exec(text))) {
    const from = t.index + t[1].length;
    const to = from + 1 + t[2].length;
    if (overlaps(code, from, to) || overlaps(taken, from, to)) continue;
    marks.push(cm.markText({ line, ch: from }, { line, ch: to }, { className: 'mk-live-tag' }));
  }

  // Marcadores de formato: ocultarlos (salvo viñetas y cercas de código).
  const tokens = cm.getLineTokens(line, true);
  tokens.forEach((tok, idx) => {
    const type = tok.type || '';
    if (!/\bformatting\b/.test(type)) return;
    // En una tarea, la viñeta "- " sobra: el checkbox ya hace de viñeta.
    if (task && /formatting-list-ul/.test(type) && !overlaps(taken, tok.start, tok.end)) {
      hideRange(line, tok.start, tok.end);
      taken.push([tok.start, tok.end]);
      return;
    }
    if (/formatting-list|formatting-code-block/.test(type)) {
      // Viñeta "- " / "* " → "•" (las numeradas quedan como están).
      if (/formatting-list-ul/.test(type) && !overlaps(taken, tok.start, tok.end)) {
        const dash = tok.string.search(/[-*+]/);
        if (dash !== -1 && !task) {
          replaceWith({ line, ch: tok.start + dash }, { line, ch: tok.start + dash + 1 }, el('span', 'mk-live-bullet', '•'), false);
          taken.push([tok.start + dash, tok.start + dash + 1]);
        }
      }
      return;
    }
    if (overlaps(taken, tok.start, tok.end)) return;
    hideRange(line, tok.start, tok.end);
    taken.push([tok.start, tok.end]);
    // La URL de un [link](url) va en tokens "url" sin "formatting".
    if (/formatting-link-string/.test(type)) {
      for (let j = idx + 1; j < tokens.length && /\burl\b/.test(tokens[j].type || '') && !/formatting/.test(tokens[j].type); j++) {
        hideRange(line, tokens[j].start, tokens[j].end);
        taken.push([tokens[j].start, tokens[j].end]);
      }
    }
  });

  if (/^\s{0,3}>/.test(text)) addLineClass(line, 'wrap', 'mk-live-quote');
}

// ---- estructura del documento en "unidades" ----
// Una unidad es una línea suelta o un bloque (cerca de código, $$, tabla).
// Al mover el cursor sin cambiar el texto, solo se redibujan las unidades
// que tocan las líneas activas viejas o nuevas (antes se rehacía todo: ~110
// ms por cambio de línea en un .md de 600 líneas).

let units = []; // { from, to, kind, marks, classes, data }
let lineUnit = []; // línea → índice en units
let lastActive = new Set();

function scanUnits() {
  units = [];
  lineUnit = [];
  const n = cm.lineCount();
  const push = (from, to, kind, data) => {
    const idx = units.length;
    units.push({ from, to, kind, data, marks: [], classes: [] });
    for (let l = from; l <= to; l++) lineUnit[l] = idx;
  };
  let i = 0;
  while (i < n) {
    const text = cm.getLine(i);
    const fence = text.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w-]+)?/);
    if (fence) {
      let j = i + 1;
      while (j < n && !cm.getLine(j).trim().startsWith(fence[1])) j++;
      const end = Math.min(j, n - 1);
      push(i, end, 'fence', { lang: (fence[2] || '').toLowerCase(), closed: j < n });
      i = end + 1;
      continue;
    }
    // Callout: "> [!NOTE]" y las líneas ">" que le siguen.
    if (/^\s{0,3}>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i.test(text)) {
      let j = i;
      while (j + 1 < n && /^\s{0,3}>/.test(cm.getLine(j + 1))) j++;
      push(i, j, 'callout');
      i = j + 1;
      continue;
    }
    if (/^\s*\$\$/.test(text)) {
      let j = i;
      const oneLine = /^\s*\$\$[\s\S]+\$\$\s*$/.test(text) && text.trim().length > 4;
      if (!oneLine) {
        j = i + 1;
        while (j < n && !/\$\$\s*$/.test(cm.getLine(j))) j++;
      }
      if (j < n) {
        push(i, j, 'math');
        i = j + 1;
        continue;
      }
    }
    if (/^\s*\|/.test(text) && i + 1 < n && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(cm.getLine(i + 1))) {
      let j = i + 1;
      while (j + 1 < n && /^\s*\|/.test(cm.getLine(j + 1))) j++;
      push(i, j, 'table');
      i = j + 1;
      continue;
    }
    push(i, i, 'line');
    i++;
  }
}

function clearUnit(u) {
  u.marks.forEach((m) => m.clear());
  u.marks = [];
  u.classes.forEach(([handle, where, cls]) => cm.removeLineClass(handle, where, cls));
  u.classes = [];
}

function unitActive(u, active) {
  for (let l = u.from; l <= u.to; l++) if (active.has(l)) return true;
  return false;
}

function blockEnd(u) {
  return { line: u.to, ch: cm.getLine(u.to).length };
}

function decorateUnit(u, active) {
  // Los helpers (hideRange, replaceWith, addLineClass...) escriben en
  // marks/lineClasses: se apuntan a los de esta unidad.
  marks = u.marks;
  lineClasses = u.classes;
  if (u.kind === 'fence' && u.data.lang === 'mermaid' && u.data.closed && u.to > u.from + 1 && !unitActive(u, active)) {
    const code = cm.getRange({ line: u.from + 1, ch: 0 }, { line: u.to - 1, ch: cm.getLine(u.to - 1).length });
    replaceWith({ line: u.from, ch: 0 }, blockEnd(u), renderMermaid(code), true);
  } else if (u.kind === 'fence') {
    for (let k = u.from; k <= u.to; k++) addLineClass(k, 'wrap', k === u.from || k === u.to ? 'mk-live-fence mk-live-fence-edge' : 'mk-live-fence');
  } else if (u.kind === 'callout') {
    if (!unitActive(u, active)) {
      const div = el('div', 'mk-live-callout');
      div.innerHTML = renderMarkdown(cm.getRange({ line: u.from, ch: 0 }, blockEnd(u)));
      replaceWith({ line: u.from, ch: 0 }, blockEnd(u), div, true);
    } else {
      // Editando el callout: cada línea (menos la del cursor) como cita.
      for (let l = u.from; l <= u.to; l++) {
        if (!active.has(l)) decorateLine(l, cm.getLine(l), l > 0 ? cm.getLine(l - 1) : null);
      }
    }
  } else if (u.kind === 'math') {
    if (!unitActive(u, active)) {
      const src = cm.getRange({ line: u.from, ch: 0 }, blockEnd(u));
      const html = renderKatex(src.trim().replace(/^\$\$/, '').replace(/\$\$$/, ''), true);
      if (html) {
        const div = el('div', 'mk-live-math-block');
        div.innerHTML = html;
        replaceWith({ line: u.from, ch: 0 }, blockEnd(u), div, true);
      }
    }
  } else if (u.kind === 'table') {
    if (!unitActive(u, active)) {
      const div = el('div', 'mk-live-table');
      div.innerHTML = renderMarkdown(cm.getRange({ line: u.from, ch: 0 }, blockEnd(u)));
      replaceWith({ line: u.from, ch: 0 }, blockEnd(u), div, true);
    }
  } else if (!active.has(u.from)) {
    decorateLine(u.from, cm.getLine(u.from), u.from > 0 ? cm.getLine(u.from - 1) : null);
  }
  u.marks = marks;
  u.classes = lineClasses;
}

function clearAll() {
  units.forEach(clearUnit);
  units = [];
  lineUnit = [];
}

// Si cambiaron las clases por línea (cercas de código, citas), cambia el
// ancho del texto: CodeMirror tiene que volver a medir todo.
function refreshIfLineClassesChanged() {
  const key = units.map((u) => u.classes.map(([h, , cls]) => cm.getLineNumber(h) + cls).join(',')).join('|');
  if (key !== lastLineClassKey) {
    lastLineClassKey = key;
    cm.refresh();
  }
}

// Reconstrucción completa (cambió el texto).
function rebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = null;
  cm.operation(() => {
    clearAll();
    if (!enabled || !isMarkdownDoc()) return;
    const active = activeLines();
    lastActive = active;
    lastActiveKey = Array.from(active).join(',');
    scanUnits();
    units.forEach((u) => decorateUnit(u, active));
  });
  refreshIfLineClassesChanged();
}

// Solo cambió el cursor: redibujar las unidades de las líneas activas
// viejas y nuevas.
function updateActive() {
  if (!units.length) {
    rebuild();
    return;
  }
  const active = activeLines();
  const touched = new Set();
  [...lastActive, ...active].forEach((l) => {
    const idx = lineUnit[l];
    if (idx != null) touched.add(idx);
  });
  lastActive = active;
  lastActiveKey = Array.from(active).join(',');
  cm.operation(() => {
    touched.forEach((idx) => {
      const u = units[idx];
      clearUnit(u);
      decorateUnit(u, active);
    });
  });
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, 120);
}

function applyLiveMode() {
  if (!enabled) return;
  const mode = cm.getOption('mode');
  if (mode === 'markdown') cm.setOption('mode', LIVE_MODE);
  cm.setOption('lineNumbers', !isMarkdownDoc());
}

cm.on('changes', () => { if (enabled) scheduleRebuild(); });
cm.on('cursorActivity', () => {
  if (!enabled) return;
  const key = Array.from(activeLines()).join(',');
  if (key === lastActiveKey) return;
  // Con texto recién cambiado (rebuild pendiente), la estructura puede estar
  // vieja: rehacer todo. Si no, alcanza con las unidades afectadas.
  if (rebuildTimer) rebuild(); else updateActive();
});
// Cambio de pestaña o de modo (tabs.js vuelve a poner mode: 'markdown').
cm.on('swapDoc', () => { if (enabled) { applyLiveMode(); rebuild(); } });
cm.on('optionChange', (instance, option) => {
  if (enabled && option === 'mode' && cm.getOption('mode') === 'markdown') {
    applyLiveMode();
    rebuild();
  }
});

function enable() {
  if (enabled) return;
  enabled = true;
  wrapper.classList.add('cm-live');
  applyLiveMode();
  lastLineClassKey = '';
  rebuild();
  cm.refresh();
}

function disable() {
  if (!enabled) return;
  enabled = false;
  clearTimeout(rebuildTimer);
  rebuildTimer = null;
  clearAll();
  wrapper.classList.remove('cm-live');
  const mode = cm.getOption('mode');
  if (mode && typeof mode === 'object' && mode.name === 'markdown') cm.setOption('mode', 'markdown');
  cm.setOption('lineNumbers', true);
  cm.refresh();
}

window.mdLivePreview = { enable, disable, isEnabled: () => enabled, rebuild, updateActive };

})();
