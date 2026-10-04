(function () {
'use strict';

const previewPane = document.getElementById('preview-pane');
const containerEl = document.querySelector('.container');

const PDF_EXT = /\.pdf$/i;

// Protege bloques ```fence``` y `código inline` de las transformaciones de
// #tag y [[wikilink]] de abajo (antes se aplicaban también dentro de código,
// por ejemplo un `#no-es-tag` de ejemplo en la documentación se convertía en
// tag igual). Se restaura el texto exacto antes de pasar por marked.parse.
function extractCode(text) {
  const store = [];
  const stash = (code) => {
    store.push(code);
    return `@@CODEBLOCK${store.length - 1}@@`;
  };
  let out = text.replace(/```[\s\S]*?```/g, stash);
  out = out.replace(/`[^`\n]+`/g, stash);
  return { text: out, store };
}

function restoreCode(text, store) {
  return text.replace(/@@CODEBLOCK(\d+)@@/g, (match, idx) => {
    const code = store[Number(idx)];
    return code === undefined ? match : code;
  });
}

function embedMediaSyntax(text, exportMode = false) {
  return text.replace(/!\[\[(.+?)\]\]/g, (match, filename) => {
    const embed = window.mdEmbedLogic?.parse(filename);
    if (embed) return exportMode ? `<a href="${window.mdEmbedLogic.escape(filename.split('|')[0].trim())}">${window.mdEmbedLogic.escape(embed.label)}</a>` : window.mdStudyEmbed.html(filename);
    const kind = window.mdMedia && window.mdMedia.kindOf(filename);
    if (kind === 'video') return `<video controls preload="metadata" src="${filename}"></video>`;
    if (kind === 'audio') return `<audio controls preload="metadata" src="${filename}"></audio>`;
    if (kind === 'image') return `<img src="${filename}" alt="${filename}">`;
    if (PDF_EXT.test(filename)) return `<embed src="${filename}" type="application/pdf" class="pdf-embed-inline">`;
    return match;
  });
}

// Las rutas de assets no pueden escaparse de la carpeta abierta (evita que
// un .md ajeno con "../../../../etc/passwd" filtre archivos del sistema).
// Sin carpeta abierta (archivo suelto) se restringe igual, pero al
// directorio propio del archivo en vez de a un root explícito — antes ese
// caso no tenía ninguna restricción.
function resolveAssetPaths(html, overrideBasePath, overrideRoot) {
  const basePath = overrideBasePath !== undefined ? overrideBasePath : window.mdState.currentFilePath;
  const root = overrideRoot !== undefined ? overrideRoot : (window.mdState.rootFolder || (basePath ? window.mdEditor.dirName(basePath) : null));
  return html.replace(/\ssrc="(?!https?:\/\/|data:|md-local:\/\/)([^"]+)"/g, (match, relPath) => {
    const absolute = window.mdEditor.resolveLocalPath(basePath, decodeURIComponent(relPath));
    if (root && !window.mdEditor.isPathAllowed(root, absolute)) {
      return ` data-blocked-src="${relPath}"`;
    }
    return ` src="${window.mdEditor.toLocalUrl(absolute)}"`;
  });
}

// Wikilinks [[Nota]] / [[Nota|texto]] -> <a> clicable resuelta contra la
// carpeta abierta. Va antes que marked.parse (HTML crudo, igual que
// embedMediaSyntax) para no depender de cómo marked tokeniza corchetes.
const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

function embedWikilinkSyntax(text) {
  return text.replace(WIKILINK_RE, (match, target, label) => {
    const t = target.trim();
    const l = (label || t).trim();
    return `<a href="#" class="md-wikilink" data-target="${t.replace(/"/g, '&quot;')}">${l}</a>`;
  });
}

// #tag no precedido por otro "#" (para no confundir con "## Encabezado").
// Debe coincidir con TAG_RE de main.js (tags:list).
const TAG_RE = /(^|[\s(])#([a-zA-Z][\w-]*)/g;

function embedTagSyntax(text) {
  return text.replace(TAG_RE, (match, pre, tag) => `${pre}<span class="md-tag" data-tag="${tag.toLowerCase()}">#${tag}</span>`);
}

// ==texto== -> <mark>texto</mark> (subrayado/resaltado, mismo estilo visual
// que el color usado en el subrayado de PDF). Va antes de marked.parse igual
// que wikilinks/tags, para no depender de cómo marked tokeniza "=".
const HIGHLIGHT_RE = /==([^=\n]+)==/g;

function embedHighlightSyntax(text) {
  return text.replace(HIGHLIGHT_RE, (match, inner) => `<mark>${inner}</mark>`);
}

// Extraer $$bloque$$ y $inline$ antes de marked.parse: si no, los "_" de
// subíndices LaTeX (F_{n-1}) se interpretan como énfasis Markdown y rompen la fórmula.
function extractMath(text) {
  const store = [];
  const stash = (expr, display) => {
    store.push({ expr, display });
    return `@@MATHBLOCK${store.length - 1}@@`;
  };
  let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => stash(expr, true));
  out = out.replace(/\$([^$\n]+?)\$/g, (match, expr) => stash(expr, false));
  return { text: out, store };
}

// KaTeX es lo más caro del render (medido: ~180 ms para 400 fórmulas en
// una nota): se cachea por expresión, así al escribir solo se recalculan
// las fórmulas que cambiaron.
const katexCache = new Map();

function renderKatexCached(expr, display) {
  const key = (display ? 'D' : 'I') + expr;
  let html = katexCache.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(expr, { throwOnError: false, displayMode: display });
    } catch {
      html = escapeHtml(expr); // nunca HTML crudo del usuario
    }
    if (katexCache.size > 2000) katexCache.delete(katexCache.keys().next().value);
    katexCache.set(key, html);
  }
  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const MATH_RE = /@@MATHBLOCK(\d+)@@/g;

// Inserta las fórmulas en HTML YA sanitizado, recorriendo el DOM: en nodos
// de texto va el HTML de KaTeX (seguro: trust:false escapa lo del usuario);
// si un marcador quedó dentro de un atributo (ej. la URL de un enlace), va
// solo el texto de la fórmula — nunca markup dentro de un atributo.
// Así DOMPurify no tiene que revisar el HTML enorme de KaTeX (era ~la
// mitad del tiempo de render) sin abrir un hueco de seguridad.
function injectMath(sanitizedHtml, store) {
  const tpl = document.createElement('template');
  tpl.innerHTML = sanitizedHtml;
  if (!store.length || !sanitizedHtml.includes('@@MATHBLOCK')) return tpl.content;
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const textNodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n.nodeValue.includes('@@MATHBLOCK')) textNodes.push(n);
    } else {
      Array.from(n.attributes).forEach((a) => {
        if (a.value.includes('@@MATHBLOCK')) {
          n.setAttribute(a.name, a.value.replace(MATH_RE, (m, i) => (store[Number(i)] ? store[Number(i)].expr : m)));
        }
      });
    }
  }
  textNodes.forEach((node) => {
    const html = escapeHtml(node.nodeValue).replace(MATH_RE, (m, i) => {
      const item = store[Number(i)];
      return item ? renderKatexCached(item.expr, item.display) : m;
    });
    const frag = document.createElement('template');
    frag.innerHTML = html;
    node.replaceWith(frag.content);
  });
  return tpl.content;
}

const CALLOUT_ICONS = { NOTE: '💡', TIP: '💡', WARNING: '⚠️', IMPORTANT: '❗', CAUTION: '🔥' };

// "> [!NOTE]\n> texto" -> marked lo deja como <blockquote><p>[!NOTE]\ntexto</p></blockquote>
function transformCallouts(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]([\s\S]*?)<\/blockquote>/gi,
    (match, type, rest) => {
      const kind = type.toUpperCase();
      const icon = CALLOUT_ICONS[kind] || '💡';
      return `<div class="callout callout-${kind.toLowerCase()}"><p class="callout-title">${icon} ${kind}</p>${rest}</div>`;
    }
  );
}

// Convierte un Markdown crudo cualquiera (no necesariamente el del tab
// activo) a HTML sanitizado, para usarlo en exports que arman varios
// documentos a la vez (ver "Exportar carpeta a EPUB (libro)" en
// exportdoc.js). Comparte el mismo pipeline de texto que render() de abajo,
// pero sin los pasos que dependen del DOM del preview en vivo (Mermaid,
// resaltado de sintaxis, checkboxes de tareas): son capítulos estáticos que
// nunca se muestran en pantalla antes de empaquetarse.
function renderMarkdownForExport(markdownText, filePath, root) {
  const { text: codeProtected, store: codeStore } = extractCode(markdownText);
  const tagged = embedTagSyntax(embedWikilinkSyntax(embedHighlightSyntax(embedMediaSyntax(codeProtected, true))));
  const preprocessed = restoreCode(tagged, codeStore);
  const { text, store } = extractMath(preprocessed);
  let html = marked.parse(text);
  html = transformCallouts(html);
  html = resolveAssetPaths(html, filePath, root);
  // Fórmulas después de sanitizar (ver injectMath).
  const wrap = document.createElement('div');
  wrap.appendChild(injectMath(DOMPurify.sanitize(html, SANITIZE_CONFIG), store));
  return wrap.innerHTML;
}
window.mdRenderMarkdownForExport = renderMarkdownForExport;

// El protocolo custom md-local:// no está en la lista de esquemas seguros
// de DOMPurify por defecto, hay que añadirlo o borra los src de assets.
const SANITIZE_CONFIG = {
  ADD_TAGS: ['embed'],
  ADD_ATTR: ['controls', 'type', 'preload'],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|md-local):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
};

function markMissingAssets() {
  previewPane.querySelectorAll('[data-blocked-src]').forEach((el) => {
    const placeholder = document.createElement('span');
    placeholder.className = 'asset-missing';
    placeholder.textContent = `[Ruta no permitida (fuera de la carpeta abierta): ${el.getAttribute('data-blocked-src')}]`;
    el.replaceWith(placeholder);
  });
  previewPane.querySelectorAll('img, video').forEach((el) => {
    el.addEventListener('error', () => {
      const placeholder = document.createElement('span');
      placeholder.className = 'asset-missing';
      const label = el.tagName === 'IMG' ? (el.getAttribute('alt') || el.getAttribute('src')) : el.getAttribute('src');
      placeholder.textContent = `[${el.tagName === 'IMG' ? 'Imagen' : 'Vídeo'} no encontrado: ${label}]`;
      el.replaceWith(placeholder);
    }, { once: true });
  });
}

// Diagramas ```mermaid``` renderizados como SVG en vez de bloque de código
// (ver MANUAL.md). Corre antes que highlightCode() para que esos bloques
// ya no sean <pre><code> cuando highlightCode los recorra.
//
// securityLevel se queda en 'strict' (no 'loose'): htmlLabels+foreignObject
// dejaría insertar <img> directo en el label, pero DOMPurify vacía el
// contenido de <foreignObject> pase lo que pase (protección propia contra
// mXSS, no hay config que la desactive — probado). flowchart.htmlLabels:false
// fuerza que mermaid arme los labels con <text>/<tspan> de SVG normal en vez
// de <foreignObject> pase lo que pase (protección propia contra mXSS, no hay
// config que la desactive — probado). Y mermaid v11 usa foreignObject para
// los labels de nodo del renderer "flowchart-v2" SIEMPRE, incluso con
// flowchart.htmlLabels:false (ese flag ya no lo respeta ese renderer —
// también probado). Por eso mermaid.run() sigue insertando el SVG directo al
// DOM (sin pasar por DOMPurify, igual que antes de este cambio): es seguro
// porque 'strict' hace que mermaid escape cualquier HTML que el usuario haya
// escrito en un label (se ve como texto literal, no se ejecuta). Lo único
// nuevo es embedMermaidNodeImages: busca el marcador "![[archivo]]" (mismo
// ![[...]] de video/PDF embebido, ver embedMediaSyntax) ya renderizado como
// texto y lo reemplaza por un <img> construido a mano con las APIs del DOM
// (nunca con un string sin sanitizar), validando la ruta igual que cualquier
// otra imagen del documento.
// El tema de Mermaid se decide por luminancia de --bg (no por lista de temas
// "conocidos como oscuros" a mano, que habría que mantener a la par de los 26
// temas de styles.css). No todos los temas mapean limpiamente a claro/oscuro,
// pero la luminancia real de --bg es la señal correcta para decidir contraste.
function isDarkTheme() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const hex = bg.match(/^#([0-9a-f]{6})$/i);
  if (!hex) return false;
  const r = parseInt(hex[1].slice(0, 2), 16);
  const g = parseInt(hex[1].slice(2, 4), 16);
  const b = parseInt(hex[1].slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5;
}

function mermaidTheme() {
  return isDarkTheme() ? 'dark' : 'neutral';
}

const MERMAID_IMAGE_MARKER_RE = /^!\[\[(.+)\]\]$/;

function embedMermaidNodeImages(container) {
  const basePath = window.mdState.currentFilePath;
  const root = window.mdState.rootFolder || (basePath ? window.mdEditor.dirName(basePath) : null);

  container.querySelectorAll('.nodeLabel').forEach((labelEl) => {
    const match = labelEl.textContent.trim().match(MERMAID_IMAGE_MARKER_RE);
    if (!match) return;
    const filename = match[1].trim();
    const absolute = window.mdEditor.resolveLocalPath(basePath, filename);
    labelEl.innerHTML = '';

    if (root && !window.mdEditor.isPathAllowed(root, absolute)) {
      labelEl.textContent = `[ruta no permitida: ${filename}]`;
      return;
    }

    const img = document.createElement('img');
    img.src = window.mdEditor.toLocalUrl(absolute);
    img.className = 'mermaid-node-image';
    img.addEventListener('error', () => {
      labelEl.textContent = `[imagen no encontrada: ${filename}]`;
    }, { once: true });
    labelEl.appendChild(img);
  });
}

// Bloques ```database``` (vista de una base de datos, ver database.js).
function renderDatabaseBlocks() {
  previewPane.querySelectorAll('pre code.language-database').forEach((code) => {
    const host = document.createElement('div');
    host.className = 'db-embed db-embed-loading';
    host.textContent = 'Cargando base de datos…';
    code.parentElement.replaceWith(host);
    if (window.mdDatabase) window.mdDatabase.renderEmbed(host, code.textContent).finally(() => host.classList.remove('db-embed-loading'));
  });
}

// Bloques ```widget``` (tareas, progreso, totales de una base, mascotas; ver widgets.js).
function renderWidgetBlocks() {
  previewPane.querySelectorAll('pre code.language-widget').forEach((code) => {
    const host = document.createElement('div');
    host.className = 'md-widget';
    code.parentElement.replaceWith(host);
    if (window.mdWidgets) window.mdWidgets.renderWidget(host, code.textContent);
  });
}

// Bloques ```run``` (botón que ejecuta comandos en la terminal, ver runblocks.js).
function renderRunBlocks() {
  previewPane.querySelectorAll('pre code.language-run').forEach((code) => {
    const host = document.createElement('div');
    code.parentElement.replaceWith(host);
    if (window.mdRunBlocks) window.mdRunBlocks.render(host, code.textContent);
  });
}

// Bloques ```chart``` (tabla Markdown → gráfico, ver charts.js).
function renderChartBlocks() {
  previewPane.querySelectorAll('pre code.language-chart').forEach((code) => {
    const host = document.createElement('div');
    code.parentElement.replaceWith(host);
    window.mdCharts.renderChartBlock(host, code.textContent);
  });
}

function renderMermaidBlocks() {
  const blocks = Array.from(previewPane.querySelectorAll('pre code.language-mermaid'));
  if (!blocks.length) return;
  if (!window.mermaid) {
    // Mermaid (3,5 MB) se carga recién cuando una nota tiene un diagrama:
    // al terminar se vuelve a dibujar el preview, ya con los diagramas.
    window.mdLoadLib('mermaid').then(() => { if (window.renderPreview) window.renderPreview(); }).catch(() => {});
    return;
  }
  window.mermaid.initialize({ startOnLoad: false, theme: mermaidTheme(), securityLevel: 'strict' });
  const divs = blocks.map((code) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
    return div;
  });
  try {
    window.mermaid.run({ nodes: previewPane.querySelectorAll('.mermaid') }).then(() => {
      divs.forEach((div) => embedMermaidNodeImages(div));
    });
  } catch {
    // sintaxis de diagrama inválida: mermaid ya deja su propio mensaje de error adentro del div
  }
}

// Asíncrono (highlight.js corre en el proceso principal, ver preload.js):
// se aplica solo si el bloque sigue en pantalla con el mismo texto.
// highlightDone: exportar lo espera, así el HTML/PDF sale con colores.
let highlightDone = Promise.resolve();

function highlightCode() {
  const blocks = Array.from(previewPane.querySelectorAll('pre code'));
  if (!blocks.length) {
    highlightDone = Promise.resolve();
    return;
  }
  const request = blocks.map((el) => {
    const langMatch = el.className.match(/language-(\S+)/);
    return { code: el.textContent, lang: langMatch ? langMatch[1] : null };
  });
  highlightDone = window.mdEditor.highlightCodeBatch(request).then((results) => {
    (results || []).forEach((html, i) => {
      const el = blocks[i];
      if (html == null || !el.isConnected || el.textContent !== request[i].code) return;
      el.innerHTML = html;
      el.classList.add('hljs');
    });
  }).catch(() => {});
}

// Ejecuta JS en un Web Worker nuevo por corrida (sin window/document/require
// ni window.mdEditor: no puede tocar tus archivos ni el resto de la app).
// Se corta solo a los 3s si no terminó.
function runJsBlock(code, outputEl) {
  outputEl.hidden = false;
  outputEl.textContent = 'Ejecutando...';
  outputEl.classList.remove('run-code-error');

  const worker = new Worker('jsworker.js');
  const timeout = setTimeout(() => {
    worker.terminate();
    outputEl.textContent = '(cancelado: tardó más de 3s)';
    outputEl.classList.add('run-code-error');
  }, 3000);

  worker.onmessage = (e) => {
    clearTimeout(timeout);
    worker.terminate();
    outputEl.textContent = e.data.output || '(sin salida)';
    if (!e.data.ok) outputEl.classList.add('run-code-error');
  };
  worker.onerror = (e) => {
    clearTimeout(timeout);
    worker.terminate();
    outputEl.textContent = `Error: ${e.message}`;
    outputEl.classList.add('run-code-error');
  };
  worker.postMessage(code);
}

function addRunButtons() {
  previewPane.querySelectorAll('pre code.language-js, pre code.language-javascript').forEach((code) => {
    const pre = code.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'runnable-code';
    pre.replaceWith(wrapper);
    wrapper.appendChild(pre);

    const outputEl = document.createElement('pre');
    outputEl.className = 'run-code-output';
    outputEl.hidden = true;

    const runBtn = document.createElement('button');
    runBtn.className = 'run-code-btn';
    runBtn.textContent = '▶ Ejecutar';
    runBtn.addEventListener('click', () => runJsBlock(code.textContent, outputEl));

    wrapper.appendChild(runBtn);
    wrapper.appendChild(outputEl);
  });
}

// Líneas "- [ ] tarea" / "1. [x] tarea" del Markdown crudo, en orden de
// aparición: se usan para mapear cada <input type=checkbox> del preview
// (que marked ya numera en el mismo orden) de vuelta a su línea real.
const TASK_LINE_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](.*)$/;

function findTaskCheckboxLines(markdownText) {
  const lines = markdownText.split('\n');
  const result = [];
  lines.forEach((line, i) => { if (TASK_LINE_RE.test(line)) result.push(i); });
  return result;
}

// Reescribe la línea en el editor real (mismo mecanismo que el tablero
// Kanban): el preview no tiene estado propio, "marcar" es editar el texto.
function toggleTaskLine(lineIndex) {
  const cm = window.mdCodeMirror;
  const lines = cm.getValue().split('\n');
  const line = lines[lineIndex];
  if (line == null) return;
  const match = line.match(TASK_LINE_RE);
  if (!match) return;
  const newMark = match[2].trim() === '' ? 'x' : ' ';
  lines[lineIndex] = `${match[1]}[${newMark}]${match[3]}`;
  cm.setValue(lines.join('\n'));
}

// Habilita los checkbox de tareas (marked los deja "disabled" por defecto)
// y tacha visualmente al toque, sin esperar el re-render con debounce.
function wireTaskCheckboxes(markdownText) {
  const lineIndexes = findTaskCheckboxLines(markdownText);
  const boxes = previewPane.querySelectorAll('li > input[type="checkbox"]');
  boxes.forEach((box, i) => {
    const lineIndex = lineIndexes[i];
    box.disabled = false;
    box.parentElement.classList.toggle('task-done', box.checked);
    if (lineIndex == null) return;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      box.parentElement.classList.toggle('task-done', box.checked);
      toggleTaskLine(lineIndex);
    });
  });
}

// ---- preview incremental ----
// El preview completo de una nota de 5000 líneas tardaba ~190 ms (medido con
// npm run bench: la mitad era DOMPurify, un cuarto marked) y se rehacía en
// cada pausa al escribir: se trababa. Ahora el texto se parte en bloques
// (tokens de primer nivel de marked: párrafo, lista, tabla, código…) y cada
// bloque se convierte y sanitiza UNA vez; queda en caché por su texto
// exacto, así que al escribir solo se reprocesa el bloque que cambió.
// El resultado es el mismo HTML que el camino completo (hay un test que lo
// compara). Se vuelve al camino completo cuando hay HTML crudo de bloque
// (<details>…</details> puede quedar repartido en varios tokens y
// sanitizarlos por separado lo rompería).
let incremental = true;
let lastMode = 'completo';
const BLOCK_CACHE_MAX = 4000;
let blockCache = new Map(); // raw del bloque -> HTML ya sanitizado
let blockContext = '';

function renderWhole(text) {
  let html = marked.parse(text);
  html = transformCallouts(html);
  html = resolveAssetPaths(html);
  // Fórmulas después de sanitizar (ver injectMath).
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

function renderBlocks(text) {
  const tokens = marked.lexer(text);
  if (tokens.some((t) => t.type === 'html' && t.block)) return null;
  // Lo que cambia el HTML de TODOS los bloques: dónde está la nota (rutas de
  // imágenes) y las definiciones de enlaces [x]: url.
  const context = `${window.mdState.currentFilePath}|${window.mdState.rootFolder}|${JSON.stringify(tokens.links || {})}`;
  if (context !== blockContext || blockCache.size > BLOCK_CACHE_MAX) {
    blockCache = new Map();
    blockContext = context;
  }
  const next = new Map();
  let out = '';
  for (const tok of tokens) {
    let html = next.get(tok.raw) || blockCache.get(tok.raw);
    if (html === undefined) {
      const one = [tok];
      one.links = tokens.links;
      html = DOMPurify.sanitize(resolveAssetPaths(transformCallouts(marked.parser(one))), SANITIZE_CONFIG);
    }
    next.set(tok.raw, html);
    out += html;
  }
  blockCache = next; // solo lo que sigue en el documento
  return out;
}

function render() {
  const isCode = window.mdTabs && window.mdTabs.isActiveTabCode && window.mdTabs.isActiveTabCode();
  containerEl.classList.toggle('code-file', isCode);
  if (isCode) {
    previewPane.innerHTML = '';
    if (window.mdCodeMirror) window.mdCodeMirror.refresh();
    return;
  }

  previewPane.classList.remove('pdf-mode');
  const T = window.performance.now.bind(window.performance);
  const t0 = T();
  const markdownText = window.mdCodeMirror.getValue();
  const { text: codeProtected, store: codeStore } = extractCode(markdownText);
  const tagged = embedTagSyntax(embedWikilinkSyntax(embedHighlightSyntax(embedMediaSyntax(codeProtected))));
  const preprocessed = restoreCode(tagged, codeStore);
  const { text, store } = extractMath(preprocessed);
  const t1 = T();
  let clean = incremental ? renderBlocks(text) : null;
  const t2 = T();
  if (clean === null) {
    clean = renderWhole(text);
    lastMode = 'completo';
  } else {
    lastMode = 'por bloques';
  }
  const t3 = T();
  previewPane.replaceChildren(injectMath(clean, store));
  const t4 = T();
  markMissingAssets();
  renderMermaidBlocks();
  renderChartBlocks();
  renderDatabaseBlocks();
  renderWidgetBlocks();
  renderRunBlocks();
  highlightCode();
  addRunButtons();
  wireTaskCheckboxes(markdownText);
  const t5 = T();
  lastTimings = { pre: t1 - t0, bloques: t2 - t1, completo: t3 - t2, dom: t4 - t3, post: t5 - t4, total: t5 - t0 };
  if (window.onPreviewRendered) window.onPreviewRendered();
}
let lastTimings = null;

// Antes un link normal ([texto](https://...) o a otro archivo) no tenía
// ningún manejador: el click navegaba la propia ventana de la app fuera de
// index.html y la dejaba en blanco. Ahora todo clic en un <a> del preview
// se intercepta acá — nunca se deja navegar la ventana misma.
previewPane.addEventListener('click', async (e) => {
  const wikilink = e.target.closest('.md-wikilink');
  if (wikilink) {
    e.preventDefault();
    const root = window.mdState.rootFolder;
    if (!root) {
      wikilink.classList.add('md-wikilink-missing');
      wikilink.title = 'Abrí una carpeta para poder navegar wikilinks';
      return;
    }
    const resolved = await window.mdEditor.resolveWikilink(root, wikilink.dataset.target);
    if (resolved) {
      window.openFileAtPath(resolved);
    } else {
      wikilink.classList.add('md-wikilink-missing');
      wikilink.title = `No se encontró "${wikilink.dataset.target}" en la carpeta abierta`;
    }
    return;
  }

  const link = e.target.closest('a[href]');
  if (!link) return;
  e.preventDefault();
  const href = link.getAttribute('href');
  if (!href || href === '#') return;
  if (window.mdPdfHighlight && await window.mdPdfHighlight.openLink(href, window.mdState.currentFilePath)) return;

  if (/^https?:|^mailto:/i.test(href)) {
    window.mdEditor.openExternal(href);
    return;
  }

  // Link relativo a otro archivo local (ej. [ver detalle](otra-nota.md)):
  // resolverlo contra el archivo actual y abrirlo, respetando la misma
  // restricción de rutas que las imágenes/assets.
  const basePath = window.mdState.currentFilePath;
  if (!basePath) return;
  const absolute = window.mdEditor.resolveLocalPath(basePath, decodeURIComponent(href.split('#')[0]));
  const root = window.mdState.rootFolder || window.mdEditor.dirName(basePath);
  if (root && !window.mdEditor.isPathAllowed(root, absolute)) return;
  window.openFileAtPath(absolute);
});

window.renderPreview = render;

// Siempre en modo lectura (editor oculto, preview a todo el ancho): sin
// esto, un PDF/imagen se mostraba en el preview mientras el editor seguía
// con lo que fuera que hubiera abierto antes (otro archivo sin relación) —
// y si el modo era "enfoque" (editor solo), el preview quedaba oculto del
// todo y el PDF ni se veía. Forzarlo acá evita esa combinación rota — pero
// es un forzado "suave" (forcedByPdf:true), se suelta solo en cuanto se
// abre un archivo de verdad (ver modes.js/releasePdfForcedReadMode).
// También saca "code-file" (ver tabs.js/isActiveTabCode): si el tab activo
// era un archivo de código, esa clase fuerza ocultar el preview y le gana
// a mode-read en el CSS a propósito — sin sacarla, un PDF quedaría tapado.
// Y actualiza mdState.currentFilePath: sin esto, el panel secundario no se
// entera de que el PDF/imagen es "lo que era principal" al promover otra
// cosa — lo perdía en vez de mandarlo al panel secundario.
function forceReadModeForPdf(filePath) {
  containerEl.classList.remove('code-file');
  window.mdState.currentFilePath = filePath;
  if (window.mdModes) window.mdModes.setLayoutMode('read', { forcedByPdf: true });
  document.dispatchEvent(new CustomEvent('mk:active-file-changed'));
}

window.showPdfPreview = function (filePath) {
  const url = window.mdEditor.toLocalUrl(filePath);
  previewPane.classList.add('pdf-mode');
  previewPane.innerHTML = `<embed src="${url}" type="application/pdf" class="pdf-embed">`;
  forceReadModeForPdf(filePath);
};

// Clic en una foto, video o audio del sidebar: mostrarlo en el preview (ver
// media.js) en vez de intentar "editarlo" como texto.
window.showMediaPreview = function (filePath) {
  previewPane.classList.add('pdf-mode');
  previewPane.replaceChildren(window.mdMedia.createViewer(filePath));
  forceReadModeForPdf(filePath);
};
window.showImagePreview = window.showMediaPreview;

let debounceTimer = null;
// Con el preview oculto (modo enfoque, Live Preview, archivo de código)
// no tiene sentido redibujarlo en cada pausa al escribir: se marca como
// desactualizado y se dibuja cuando vuelve a hacer falta (ensureFresh:
// cambiar de modo, exportar, abrir el índice).
let stale = false;

function previewVisible() {
  return previewPane.offsetParent !== null;
}

function ensureFresh() {
  if (!stale) return;
  stale = false;
  clearTimeout(debounceTimer);
  render();
}

function requestRender() {
  clearTimeout(debounceTimer);
  // Actualizar también la clase que decide la visibilidad al cambiar de archivo.
  const isCode = !!window.mdTabs?.isActiveTabCode();
  containerEl.classList.toggle('code-file', isCode);
  if (isCode) previewPane.replaceChildren();
  stale = true;
  if (previewVisible()) ensureFresh(); else onLayoutChange();
}

function onLayoutChange() {
  if (previewVisible()) { ensureFresh(); return; }
  // El DOM de lectura puede tener miles de nodos aunque esté oculto.
  // No conservarlo mientras se escribe; se reconstruye al mostrarlo.
  if (previewPane.classList.contains('pdf-mode')) return;
  clearTimeout(debounceTimer);
  previewPane.replaceChildren();
  stale = true;
}

window.mdCodeMirror.on('change', () => {
  clearTimeout(debounceTimer);
  if (!previewVisible()) {
    stale = true;
    return;
  }
  debounceTimer = setTimeout(render, 150);
});

window.mdPreview = { timings: () => lastTimings, mode: () => lastMode, setIncremental: (on) => { incremental = !!on; blockCache = new Map(); }, renderWholeForTest: (t) => renderWhole(t), renderBlocksForTest: (t) => renderBlocks(t), whenHighlighted: () => highlightDone, ensureFresh, requestRender, onLayoutChange, isStale: () => stale };

render();

})();
