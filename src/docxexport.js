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

// La librería docx (1,1 MB) se carga recién al exportar (lazyload.js):
// estos nombres se completan en loadDocxLib().
let Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, ExternalHyperlink, LevelFormat, AlignmentType;

async function loadDocxLib() {
  if (Document) return;
  await window.mdLoadLib('docx');
  ({ Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, ExternalHyperlink, LevelFormat, AlignmentType } = docx);
  HEADING_MAP = {
    h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3,
    h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6
  };
}

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
  const requestedWidth = Number(imgEl.getAttribute('width')) || parseFloat(imgEl.style.width) || size.width;
  const width = Math.min(requestedWidth, MAX_IMAGE_WIDTH);
  const height = Math.round(size.height * (width / size.width));
  try {
    return new ImageRun({ type, data: bytes, transformation: { width, height } });
  } catch {
    return null;
  }
}

// Texto/estilos inline (negrita, cursiva, tachado, código, links, imágenes)
// dentro de un párrafo/celda/ítem de lista.
function runStyle(element, opts) {
  const localOpts = { ...opts };
  const color = element.style?.color;
  if (color) {
    const rgb = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgb) localOpts.color = rgb.slice(1).map(v => Number(v).toString(16).padStart(2, '0')).join('');
    else if (/^#[a-f0-9]{6}$/i.test(color)) localOpts.color = color.slice(1);
  }
  if (element.style?.fontWeight === 'bold' || Number(element.style?.fontWeight) >= 600) localOpts.bold = true;
  if (element.style?.fontStyle === 'italic') localOpts.italics = true;
  if (element.style?.textDecoration?.includes('underline')) localOpts.underline = {};
  const size = parseFloat(element.style?.fontSize);
  if (size > 0) localOpts.size = Math.round(size * (element.style.fontSize.endsWith('pt') ? 2 : 1.5));
  if (element.style?.fontFamily) localOpts.font = element.style.fontFamily.replace(/[\"']/g, '').split(',')[0];
  return localOpts;
}

async function inlineRunsFromNode(node, opts = {}) {
  opts = runStyle(node, opts);
  const parts = [];
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) parts.push(new TextRun({ text: child.textContent, ...opts }));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName.toLowerCase();
    const localOpts = runStyle(child, opts);
    if (tag === 'strong' || tag === 'b') {
      parts.push(...(await inlineRunsFromNode(child, { ...localOpts, bold: true })));
    } else if (tag === 'em' || tag === 'i') {
      parts.push(...(await inlineRunsFromNode(child, { ...localOpts, italics: true })));
    } else if (tag === 'del' || tag === 's') {
      parts.push(...(await inlineRunsFromNode(child, { ...localOpts, strike: true })));
    } else if (tag === 'u' || tag === 'sup' || tag === 'sub') {
      const style = tag === 'u' ? { underline: {} } : tag === 'sup' ? { superScript: true } : { subScript: true };
      parts.push(...(await inlineRunsFromNode(child, { ...localOpts, ...style })));
    } else if (tag === 'input' && child.type === 'checkbox') {
      parts.push(new TextRun({ text: child.checked ? '☑ ' : '☐ ', ...opts }));
    } else if (tag === 'p') {
      if (parts.length) parts.push(new TextRun({ break: 1 }));
      parts.push(...(await inlineRunsFromNode(child, localOpts)));
    } else if (tag === 'mark') {
      parts.push(...(await inlineRunsFromNode(child, { ...localOpts, highlight: 'yellow' })));
    } else if (tag === 'code') {
      parts.push(new TextRun({ text: child.textContent, font: 'Consolas', ...opts }));
    } else if (tag === 'br') {
      parts.push(new TextRun({ text: '', break: 1 }));
    } else if (tag === 'a') {
      const inner = await inlineRunsFromNode(child, localOpts);
      parts.push(new ExternalHyperlink({ link: child.getAttribute('href') || '#', children: inner.length ? inner : [new TextRun(child.textContent)] }));
    } else if (tag === 'img') {
      const run = await resolveImageRun(child);
      if (run) parts.push(run);
    } else {
      parts.push(...(await inlineRunsFromNode(child, localOpts)));
    }
  }
  return parts;
}

// Se arma después de cargar la librería (loadDocxLib).
let HEADING_MAP = {};

async function listToParagraphs(el, level, ordered) {
  const out = [];
  let numberingRef = null;
  if (ordered) {
    numberingRef = `ordered-${numberingCounter++}`;
    numberingConfigs.push({
      reference: numberingRef,
      levels: [{
        level: 0,
        start: Math.max(1, Number(el.getAttribute('start')) || 1),
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
      bullet: ordered ? undefined : { level: Math.min(level, 8) },
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
        children: cell.querySelector('table, ul, ol') ? await blockNodeToParagraphs(cell) : [new Paragraph({ children: runs.length ? runs : [new TextRun('')], alignment: paragraphAlignment(cell) })],
        columnSpan: Math.max(1, Number(cell.getAttribute('colspan')) || 1),
        rowSpan: Math.max(1, Number(cell.getAttribute('rowspan')) || 1),
        shading: cell.tagName.toLowerCase() === 'th' ? { fill: 'E8EEF7' } : undefined,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        width: { size: Math.floor(100 / Math.max(tds.length, 1)), type: WidthType.PERCENTAGE }
      }));
    }
    rows.push(new TableRow({ children: cells, tableHeader: tr.parentElement.tagName === 'THEAD' || tds.every((c) => c.tagName === 'TH') }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function paragraphAlignment(el) {
  const value = el.style.textAlign || el.getAttribute('align');
  return ({ center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED, left: AlignmentType.LEFT })[value];
}

async function blockNodeToParagraphs(el, opts = {}) {
  const tag = el.tagName.toLowerCase();
  if (HEADING_MAP[tag]) {
    const runs = await inlineRunsFromNode(el);
    return [new Paragraph({ heading: HEADING_MAP[tag], children: runs })];
  }
  if (el.style.breakBefore === 'page' || el.style.pageBreakBefore === 'always') {
    const clone = el.cloneNode(true);
    clone.style.breakBefore = ''; clone.style.pageBreakBefore = '';
    return [new Paragraph({ pageBreakBefore: true }), ...await blockNodeToParagraphs(clone, opts)];
  }
  if (tag === 'p') {
    const runs = await inlineRunsFromNode(el, opts.blockquote ? { italics: true } : {});
    return [new Paragraph({ alignment: paragraphAlignment(el), children: runs.length ? runs : [new TextRun('')], indent: opts.blockquote ? { left: 400 } : undefined })];
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
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) out.push(new Paragraph({ children: [new TextRun(child.textContent)] }));
    else if (child.nodeType === Node.ELEMENT_NODE) {
      if (['span', 'strong', 'em', 'a', 'u', 'sup', 'sub', 'img'].includes(child.tagName.toLowerCase())) {
        const wrapper = document.createElement('p'); wrapper.appendChild(child.cloneNode(true));
        out.push(new Paragraph({ children: await inlineRunsFromNode(wrapper) }));
      } else out.push(...await blockNodeToParagraphs(child, opts));
    }
  }
  return out;
}

async function buildDocxParagraphs(html) {
  const container = document.createElement('div');
  container.innerHTML = DOMPurify.sanitize(html);
  const out = [];
  for (const child of Array.from(container.children)) {
    out.push(...(await blockNodeToParagraphs(child)));
  }
  return out;
}

async function buildBase64(raw) {
  await loadDocxLib();
  numberingConfigs = [];
  numberingCounter = 0;
  return buildHtmlBase64(marked.parse(raw));
}

async function buildHtmlBase64(html) {
  await loadDocxLib();
  numberingConfigs = []; numberingCounter = 0;
  const children = await buildDocxParagraphs(html);
  const doc = new Document({
    styles: { default: {
      document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 160, line: 276 } } },
      heading1: { run: { color: '234E70', size: 36 }, paragraph: { spacing: { before: 280, after: 160 }, keepNext: true } },
      heading2: { run: { color: '234E70', size: 28 }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true } }
    } },
    numbering: { config: numberingConfigs },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: children.length ? children : [new Paragraph('')] }]
  });
  return Packer.toBase64String(doc);
}

async function exportToDocx() {
  if (window.mdOffice?.getState()?.kind === 'docx') { await window.mdOffice.save(true); return null; }
  const base64 = await buildBase64(window.mdCodeMirror.getValue());
  const baseName = (window.mdState.currentFilePath || 'documento.md').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  return window.mdEditor.exportDocx(base64, `${baseName}.docx`);
}

document.getElementById('btn-export-docx').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  try {
    const savedPath = await exportToDocx();
    if (savedPath) alert(`Exportado a: ${savedPath}`);
  } catch (error) {
    window.mdEditor.logError('docx:exportar', error.stack || String(error));
    alert('No se pudo exportar a Word. Comprueba las imágenes y vuelve a intentarlo.');
  }
});

window.mdDocxExport = { exportToDocx, buildBase64, buildHtmlBase64 };

})();
