(function () {
'use strict';

const previewPane = document.getElementById('preview-pane');
const containerEl = document.querySelector('.container');

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg)$/i;
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

function embedMediaSyntax(text) {
  return text.replace(/!\[\[(.+?)\]\]/g, (match, filename) => {
    if (VIDEO_EXT.test(filename)) return `<video controls src="${filename}"></video>`;
    if (PDF_EXT.test(filename)) return `<embed src="${filename}" type="application/pdf" class="pdf-embed-inline">`;
    return match;
  });
}

// Las rutas de assets no pueden escaparse de la carpeta abierta (evita que
// un .md ajeno con "../../../../etc/passwd" filtre archivos del sistema).
// Sin carpeta abierta (archivo suelto) se restringe igual, pero al
// directorio propio del archivo en vez de a un root explícito — antes ese
// caso no tenía ninguna restricción.
function resolveAssetPaths(html) {
  const basePath = window.mdState.currentFilePath;
  const root = window.mdState.rootFolder || (basePath ? window.mdEditor.dirName(basePath) : null);
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

function restoreMath(html, store) {
  return html.replace(/@@MATHBLOCK(\d+)@@/g, (match, idx) => {
    const item = store[Number(idx)];
    if (!item) return match;
    try {
      return katex.renderToString(item.expr, { throwOnError: false, displayMode: item.display });
    } catch (e) {
      return item.expr;
    }
  });
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

// El protocolo custom md-local:// no está en la lista de esquemas seguros
// de DOMPurify por defecto, hay que añadirlo o borra los src de assets.
const SANITIZE_CONFIG = {
  ADD_TAGS: ['embed'],
  ADD_ATTR: ['controls', 'type'],
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
if (window.mermaid) {
  window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });
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

function renderMermaidBlocks() {
  const blocks = Array.from(previewPane.querySelectorAll('pre code.language-mermaid'));
  if (!blocks.length || !window.mermaid) return;
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
  } catch (e) {
    // sintaxis de diagrama inválida: mermaid ya deja su propio mensaje de error adentro del div
  }
}

function highlightCode() {
  previewPane.querySelectorAll('pre code').forEach((el) => {
    const langMatch = el.className.match(/language-(\S+)/);
    const highlighted = window.mdEditor.highlightCode(el.textContent, langMatch ? langMatch[1] : null);
    if (highlighted !== null) {
      el.innerHTML = highlighted;
      el.classList.add('hljs');
    }
  });
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

function render() {
  const isCode = window.mdTabs && window.mdTabs.isActiveTabCode && window.mdTabs.isActiveTabCode();
  containerEl.classList.toggle('code-file', isCode);
  if (isCode) {
    previewPane.innerHTML = '';
    if (window.mdCodeMirror) window.mdCodeMirror.refresh();
    return;
  }

  previewPane.classList.remove('pdf-mode');
  const markdownText = window.mdCodeMirror.getValue();
  const { text: codeProtected, store: codeStore } = extractCode(markdownText);
  const tagged = embedTagSyntax(embedWikilinkSyntax(embedHighlightSyntax(embedMediaSyntax(codeProtected))));
  const preprocessed = restoreCode(tagged, codeStore);
  const { text, store } = extractMath(preprocessed);
  let html = marked.parse(text);
  html = transformCallouts(html);
  html = resolveAssetPaths(html);
  html = restoreMath(html, store);
  previewPane.innerHTML = DOMPurify.sanitize(html, SANITIZE_CONFIG);
  markMissingAssets();
  renderMermaidBlocks();
  highlightCode();
  addRunButtons();
  wireTaskCheckboxes(markdownText);
  if (window.onPreviewRendered) window.onPreviewRendered();
}

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

window.showPdfPreview = function (filePath) {
  const url = window.mdEditor.toLocalUrl(filePath);
  previewPane.classList.add('pdf-mode');
  previewPane.innerHTML = `<embed src="${url}" type="application/pdf" class="pdf-embed">`;
};

// Clic en una imagen del sidebar: mostrarla en el preview en vez de
// intentar "editarla" como texto (eso era lo que colgaba la app antes).
window.showImagePreview = function (filePath) {
  const url = window.mdEditor.toLocalUrl(filePath);
  const name = filePath.split(/[\\/]/).pop();
  previewPane.classList.add('pdf-mode');
  previewPane.innerHTML = `<div class="image-preview"><img src="${url}" alt="${name}"></div>`;
};

let debounceTimer = null;
window.mdCodeMirror.on('change', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 150);
});

render();

})();
