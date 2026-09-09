(function () {
'use strict';

const previewPane = document.getElementById('preview-pane');

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

function render() {
  previewPane.classList.remove('pdf-mode');
  const markdownText = window.mdCodeMirror.getValue();
  const { text: codeProtected, store: codeStore } = extractCode(markdownText);
  const tagged = embedTagSyntax(embedWikilinkSyntax(embedMediaSyntax(codeProtected)));
  const preprocessed = restoreCode(tagged, codeStore);
  const { text, store } = extractMath(preprocessed);
  let html = marked.parse(text);
  html = transformCallouts(html);
  html = resolveAssetPaths(html);
  html = restoreMath(html, store);
  previewPane.innerHTML = DOMPurify.sanitize(html, SANITIZE_CONFIG);
  markMissingAssets();
  highlightCode();
  if (window.onPreviewRendered) window.onPreviewRendered();
}

previewPane.addEventListener('click', async (e) => {
  const link = e.target.closest('.md-wikilink');
  if (!link) return;
  e.preventDefault();
  const root = window.mdState.rootFolder;
  if (!root) {
    link.classList.add('md-wikilink-missing');
    link.title = 'Abrí una carpeta para poder navegar wikilinks';
    return;
  }
  const resolved = await window.mdEditor.resolveWikilink(root, link.dataset.target);
  if (resolved) {
    window.openFileAtPath(resolved);
  } else {
    link.classList.add('md-wikilink-missing');
    link.title = `No se encontró "${link.dataset.target}" en la carpeta abierta`;
  }
});

window.renderPreview = render;

window.showPdfPreview = function (filePath) {
  const url = window.mdEditor.toLocalUrl(filePath);
  previewPane.classList.add('pdf-mode');
  previewPane.innerHTML = `<embed src="${url}" type="application/pdf" class="pdf-embed">`;
};

let debounceTimer = null;
window.mdCodeMirror.on('change', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 150);
});

render();

})();
