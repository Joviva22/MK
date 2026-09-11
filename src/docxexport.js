(function () {
'use strict';

// Exportar el documento activo a un .docx real, usando la librería "docx"
// (arma el .zip/XML de Word a mano, nada de conversión externa). Es el otro
// sentido de docximport.js: abrís un .docx -> se convierte a Markdown ->
// editás como cualquier documento -> "Exportar a Word" arma un .docx nuevo
// a partir de ESE Markdown. No es un "guardar de vuelta" al archivo
// original (sería sobreescribir formato que MK nunca leyó), es un export
// nuevo, igual que exportar a PDF/HTML/EPUB.
//
// Recorre el HTML que da marked.parse() sobre el Markdown crudo (no el
// preview ya renderizado — ese tiene SVGs de Mermaid y HTML de KaTeX que no
// tienen traducción razonable a un documento de Word) y arma párrafos/
// tablas/imágenes de la librería docx. Ver MANUAL.md para qué sobrevive la
// conversión y qué no (wikilinks, tags, subrayado, fórmulas y Mermaid
// quedan como texto literal, no hay forma razonable de "renderizarlos" en
// un .docx).

const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, ExternalHyperlink, LevelFormat, AlignmentType } = docx;

// Definiciones de numeración real para las listas ordenadas del documento
// actual (se resetean en cada exportToDocx). Cada <ol> —top-level o
// anidado— arma su propia referencia para que la numeración reinicie en 1,
// igual que el comportamiento manual anterior (idx++ por lista).
let numberingConfigs = [];
let numberingCounter = 0;

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// data:image/png;base64,xxxx -> { type: 'png', bytes }
function parseDataUriImage(src) {
  const m = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i);
  if (!m) return null;
  return { type: m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase(), bytes: base64ToBytes(m[2]) };
}

function imageNaturalSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 300, height: img.naturalHeight || 200 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const MAX_IMAGE_WIDTH = 500;

// Imagen incrustada (data: URI, típico de un .docx importado) o ruta local
// relativa (imagen normal del documento) -> ImageRun. Imágenes remotas
// (http/https) no se descargan, ver Límite en MANUAL.md.
async function resolveImageRun(imgEl) {
  const src = imgEl.getAttribute('src') || '';
  let type, bytes, probeSrc;

  const dataUri = parseDataUriImage(src);
  if (dataUri) {
    type = dataUri.type;
    bytes = dataUri.bytes;
    probeSrc = src;
  } else if (!/^https?:|^md-local:/i.test(src)) {
    const basePath = window.mdState.currentFilePath;
    const root = window.mdState.rootFolder || (basePath ? window.mdEditor.dirName(basePath) : null);
    const absolute = window.mdEditor.resolveLocalPath(basePath, decodeURIComponent(src));
    if (root && !window.mdEditor.isPathAllowed(root, absolute)) return null;
    const base64 = await window.mdEditor.assetReadBytes(absolute);
    if (!base64) return null;
    const ext = (absolute.split('.').pop() || 'png').toLowerCase().replace('jpeg', 'jpg');
    type = ['png', 'jpg', 'gif', 'bmp'].includes(ext) ? ext : 'png';
    bytes = base64ToBytes(base64);
    probeSrc = window.mdEditor.toLocalUrl(absolute);
  } else {
    return null;
  }

  const size = (await imageNaturalSize(probeSrc)) || { width: 300, height: 200 };
  const width = Math.min(size.width, MAX_IMAGE_WIDTH);
  const height = Math.round(size.height * (width / size.width));
  try {
    return new ImageRun({ type, data: bytes, transformation: { width, height } });
  } catch (e) {
    return null;
  }
}

// Texto/estilos inline (negrita, cursiva, tachado, código, links, imágenes)
// dentro de un párrafo/celda/ítem de lista.
async function inlineRunsFromNode(node, opts = {}) {
  const parts = [];
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) parts.push(new TextRun({ text: child.textContent, ...opts }));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName.toLowerCase();
    if (tag === 'strong' || tag === 'b') {
      parts.push(...(await inlineRunsFromNode(child, { ...opts, bold: true })));
    } else if (tag === 'em' || tag === 'i') {
      parts.push(...(await inlineRunsFromNode(child, { ...opts, italics: true })));
    } else if (tag === 'del' || tag === 's') {
      parts.push(...(await inlineRunsFromNode(child, { ...opts, strike: true })));
    } else if (tag === 'mark') {
      parts.push(...(await inlineRunsFromNode(child, { ...opts, highlight: 'yellow' })));
    } else if (tag === 'code') {
      parts.push(new TextRun({ text: child.textContent, font: 'Consolas', ...opts }));
    } else if (tag === 'br') {
      parts.push(new TextRun({ text: '', break: 1 }));
    } else if (tag === 'a') {
      const inner = await inlineRunsFromNode(child, opts);
      parts.push(new ExternalHyperlink({ link: child.getAttribute('href') || '#', children: inner.length ? inner : [new TextRun(child.textContent)] }));
    } else if (tag === 'img') {
      const run = await resolveImageRun(child);
      if (run) parts.push(run);
    } else {
      parts.push(...(await inlineRunsFromNode(child, opts)));
    }
  }
  return parts;
}

const HEADING_MAP = {
  h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6
};

async function listToParagraphs(el, level, ordered) {
  const out = [];
  let numberingRef = null;
  if (ordered) {
    numberingRef = `ordered-${numberingCounter++}`;
    numberingConfigs.push({
      reference: numberingRef,
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } } }
      }]
    });
  }
  for (const li of Array.from(el.children)) {
    if (li.tagName.toLowerCase() !== 'li') continue;
    const nestedLists = Array.from(li.children).filter((c) => ['ul', 'ol'].includes(c.tagName.toLowerCase()));
    const liClone = li.cloneNode(true);
    Array.from(liClone.children).forEach((c) => {
      if (['ul', 'ol'].includes(c.tagName.toLowerCase())) liClone.removeChild(c);
    });
    const runs = await inlineRunsFromNode(liClone);
    out.push(new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      bullet: ordered ? undefined : { level },
      numbering: ordered ? { reference: numberingRef, level: 0 } : undefined
    }));
    for (const nested of nestedLists) {
      out.push(...(await listToParagraphs(nested, level + 1, nested.tagName.toLowerCase() === 'ol')));
    }
  }
  return out;
}

async function tableToDocxTable(el) {
  const trs = el.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr');
  const rows = [];
  for (const tr of Array.from(trs)) {
    const cells = [];
    const tds = Array.from(tr.children);
    for (const cell of tds) {
      const runs = await inlineRunsFromNode(cell, cell.tagName.toLowerCase() === 'th' ? { bold: true } : {});
      cells.push(new TableCell({
        children: [new Paragraph({ children: runs.length ? runs : [new TextRun('')] })],
        width: { size: Math.floor(100 / Math.max(tds.length, 1)), type: WidthType.PERCENTAGE }
      }));
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

async function blockNodeToParagraphs(el, opts = {}) {
  const tag = el.tagName.toLowerCase();
  if (HEADING_MAP[tag]) {
    const runs = await inlineRunsFromNode(el);
    return [new Paragraph({ heading: HEADING_MAP[tag], children: runs })];
  }
  if (tag === 'p') {
    const runs = await inlineRunsFromNode(el, opts.blockquote ? { italics: true } : {});
    return [new Paragraph({ children: runs.length ? runs : [new TextRun('')], indent: opts.blockquote ? { left: 400 } : undefined })];
  }
  if (tag === 'ul' || tag === 'ol') {
    return listToParagraphs(el, 0, tag === 'ol');
  }
  if (tag === 'blockquote') {
    const out = [];
    for (const child of Array.from(el.children)) {
      out.push(...(await blockNodeToParagraphs(child, { blockquote: true })));
    }
    return out;
  }
  if (tag === 'pre') {
    const code = el.querySelector('code') || el;
    const lines = code.textContent.replace(/\n$/, '').split('\n');
    return lines.map((line) => new Paragraph({ children: [new TextRun({ text: line || ' ', font: 'Consolas' })] }));
  }
  if (tag === 'table') {
    return [await tableToDocxTable(el)];
  }
  if (tag === 'hr') {
    return [new Paragraph({ children: [new TextRun('───────────────────────')] })];
  }
  // Tag desconocido (div suelto, span de tag/callout, etc.): perdemos el
  // estilo específico pero seguimos bajando para no perder el contenido.
  const out = [];
  for (const child of Array.from(el.children)) {
    out.push(...(await blockNodeToParagraphs(child, opts)));
  }
  return out;
}

async function buildDocxParagraphs(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  const out = [];
  for (const child of Array.from(container.children)) {
    out.push(...(await blockNodeToParagraphs(child)));
  }
  return out;
}

async function exportToDocx() {
  numberingConfigs = [];
  numberingCounter = 0;
  const raw = window.mdCodeMirror.getValue();
  const html = marked.parse(raw);
  const children = await buildDocxParagraphs(html);
  const doc = new Document({
    numbering: { config: numberingConfigs },
    sections: [{ children: children.length ? children : [new Paragraph('')] }]
  });
  const base64 = await Packer.toBase64String(doc);
  const baseName = (window.mdState.currentFilePath || 'documento.md').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  return window.mdEditor.exportDocx(base64, `${baseName}.docx`);
}

document.getElementById('btn-export-docx').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  const savedPath = await exportToDocx();
  if (savedPath) alert(`Exportado a: ${savedPath}`);
});

window.mdDocxExport = { exportToDocx };

})();
