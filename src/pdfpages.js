(function () {
'use strict';

// Operaciones de página sobre un PDF: unir, separar, rotar, borrar/reordenar,
// marca de agua, texto/firma. Todo corre acá con pdf-lib (JS puro, sin
// binarios nativos) sobre un PDFDocument en memoria — el archivo real en
// disco no se toca hasta "Guardar como...". Ver MANUAL.md.

const overlay = document.getElementById('pdfpages-panel');
const emptyEl = document.getElementById('pdfpages-empty');
const listEl = document.getElementById('pdfpages-list');
const actionsEl = document.getElementById('pdfpages-actions');
const filenameEl = document.getElementById('pdfpages-filename');
const mergeBtn = document.getElementById('pdfpages-merge');
const saveBtn = document.getElementById('pdfpages-save');
const PAGE_DRAG_MIME = 'application/x-mk-pdfpage';

let doc = null;
let baseName = 'documento.pdf';

function withSuffix(suffix) {
  return baseName.replace(/\.pdf$/i, '') + suffix + '.pdf';
}

async function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadDocFromPath(filePath) {
  const base64 = await window.mdEditor.pdfReadBytes(filePath);
  if (!base64) {
    alert('No se pudo leer el PDF.');
    return;
  }
  try {
    doc = await PDFLib.PDFDocument.load(base64ToBytes(base64));
  } catch (e) {
    alert('Ese archivo no parece ser un PDF válido.');
    return;
  }
  baseName = filePath.split(/[\\/]/).pop();
  render();
}

function movePage(from, to) {
  if (from === to) return;
  const count = doc.getPageCount();
  if (from < 0 || from >= count || to < 0 || to >= count) return;
  const page = doc.getPage(from);
  doc.removePage(from);
  doc.insertPage(from < to ? to - 1 : to, page);
  render();
}

function rotatePage(index, delta) {
  const page = doc.getPage(index);
  const current = page.getRotation().angle;
  page.setRotation(PDFLib.degrees((((current + delta) % 360) + 360) % 360));
  render();
}

function deletePage(index) {
  if (doc.getPageCount() <= 1) {
    alert('No se puede borrar la única página que queda.');
    return;
  }
  doc.removePage(index);
  render();
}

function render() {
  const has = !!doc;
  emptyEl.hidden = has;
  listEl.hidden = !has;
  actionsEl.hidden = !has;
  mergeBtn.disabled = !has;
  saveBtn.disabled = !has;
  filenameEl.textContent = has ? `${baseName} — ${doc.getPageCount()} página(s)` : '';
  if (!has) return;

  listEl.innerHTML = '';
  const count = doc.getPageCount();
  for (let i = 0; i < count; i++) {
    const angle = doc.getPage(i).getRotation().angle;
    const row = document.createElement('div');
    row.className = 'pdfpages-page-row';
    row.draggable = true;

    const label = document.createElement('span');
    label.className = 'pdfpages-page-label';
    label.textContent = `Página ${i + 1}${angle ? ` — rotación ${angle}°` : ''}`;
    row.appendChild(label);

    const btnRotateLeft = document.createElement('button');
    btnRotateLeft.className = 'toolbar-button';
    btnRotateLeft.textContent = '⟲';
    btnRotateLeft.title = 'Rotar -90°';
    btnRotateLeft.addEventListener('click', () => rotatePage(i, -90));
    row.appendChild(btnRotateLeft);

    const btnRotateRight = document.createElement('button');
    btnRotateRight.className = 'toolbar-button';
    btnRotateRight.textContent = '⟳';
    btnRotateRight.title = 'Rotar +90°';
    btnRotateRight.addEventListener('click', () => rotatePage(i, 90));
    row.appendChild(btnRotateRight);

    const btnDelete = document.createElement('button');
    btnDelete.className = 'toolbar-button';
    btnDelete.textContent = '✕';
    btnDelete.title = 'Borrar página';
    btnDelete.addEventListener('click', () => deletePage(i));
    row.appendChild(btnDelete);

    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(PAGE_DRAG_MIME, String(i));
    });
    row.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes(PAGE_DRAG_MIME)) return;
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      if (!e.dataTransfer.types.includes(PAGE_DRAG_MIME)) return;
      e.preventDefault();
      row.classList.remove('drag-over');
      movePage(Number(e.dataTransfer.getData(PAGE_DRAG_MIME)), i);
    });

    listEl.appendChild(row);
  }
}

async function saveDocAs(targetDoc, defaultName) {
  const bytes = await targetDoc.save();
  const base64 = await bytesToBase64(bytes);
  const savedPath = await window.mdEditor.pdfSaveBytes(base64, defaultName);
  return savedPath;
}

document.getElementById('pdfpages-open').addEventListener('click', async () => {
  const paths = await window.mdEditor.pdfPickFiles(false);
  if (!paths) return;
  await loadDocFromPath(paths[0]);
});

async function mergeFromPath(filePath) {
  if (!doc) return;
  const base64 = await window.mdEditor.pdfReadBytes(filePath);
  if (!base64) {
    alert('No se pudo leer el PDF a unir.');
    return;
  }
  try {
    const other = await PDFLib.PDFDocument.load(base64ToBytes(base64));
    const copied = await doc.copyPages(other, other.getPageIndices());
    copied.forEach((p) => doc.addPage(p));
    render();
  } catch (e) {
    alert('Ese archivo no parece ser un PDF válido.');
  }
}

mergeBtn.addEventListener('click', async () => {
  if (!doc) return;
  const paths = await window.mdEditor.pdfPickFiles(false);
  if (!paths) return;
  await mergeFromPath(paths[0]);
});

saveBtn.addEventListener('click', async () => {
  if (!doc) return;
  const savedPath = await saveDocAs(doc, withSuffix('-editado'));
  if (savedPath) alert(`Guardado en: ${savedPath}`);
});

document.getElementById('pdfpages-watermark-apply').addEventListener('click', () => {
  if (!doc) return;
  const text = document.getElementById('pdfpages-watermark-text').value.trim();
  if (!text) {
    alert('Escribí el texto de la marca de agua.');
    return;
  }
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 2 - (text.length * 12) / 2,
      y: height / 2,
      size: 40,
      rotate: PDFLib.degrees(45),
      opacity: 0.25,
      color: PDFLib.rgb(0.5, 0.5, 0.5)
    });
  });
  render();
});

const STAMP_MARGIN = 36;
function stampPosition(width, height, pos, textWidth) {
  switch (pos) {
    case 'bl': return { x: STAMP_MARGIN, y: STAMP_MARGIN };
    case 'tr': return { x: width - STAMP_MARGIN - textWidth, y: height - STAMP_MARGIN };
    case 'tl': return { x: STAMP_MARGIN, y: height - STAMP_MARGIN };
    case 'center': return { x: width / 2 - textWidth / 2, y: height / 2 };
    default: return { x: width - STAMP_MARGIN - textWidth, y: STAMP_MARGIN }; // br
  }
}

document.getElementById('pdfpages-stamp-apply').addEventListener('click', () => {
  if (!doc) return;
  const text = document.getElementById('pdfpages-stamp-text').value.trim();
  const pageNum = Number(document.getElementById('pdfpages-stamp-page').value);
  const pos = document.getElementById('pdfpages-stamp-pos').value;
  if (!text) {
    alert('Escribí el texto a insertar.');
    return;
  }
  if (!pageNum || pageNum < 1 || pageNum > doc.getPageCount()) {
    alert(`Número de página inválido (1 a ${doc.getPageCount()}).`);
    return;
  }
  const page = doc.getPage(pageNum - 1);
  const { width, height } = page.getSize();
  const size = 14;
  const { x, y } = stampPosition(width, height, pos, text.length * size * 0.5);
  page.drawText(text, { x, y, size, color: PDFLib.rgb(0, 0, 0) });
  render();
});

// "1-3,5" -> [0,1,2,4] (índices 0-based, validados contra el total de páginas)
function parsePageRange(input, count) {
  const indices = new Set();
  for (const part of input.split(',').map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let n = from; n <= to; n++) if (n >= 1 && n <= count) indices.add(n - 1);
    } else if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= count) indices.add(n - 1);
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

document.getElementById('pdfpages-split-apply').addEventListener('click', async () => {
  if (!doc) return;
  const rangeInput = document.getElementById('pdfpages-split-range').value.trim();
  const indices = parsePageRange(rangeInput, doc.getPageCount());
  if (!indices.length) {
    alert(`Rango inválido. Ejemplo: "1-3,5" (páginas 1 a 3 y 5, de un total de ${doc.getPageCount()}).`);
    return;
  }
  const extracted = await PDFLib.PDFDocument.create();
  const copied = await extracted.copyPages(doc, indices);
  copied.forEach((p) => extracted.addPage(p));
  const savedPath = await saveDocAs(extracted, withSuffix('-extraido'));
  if (savedPath) alert(`Guardado en: ${savedPath}`);
});

function open() {
  overlay.hidden = false;
}

function close() {
  overlay.hidden = true;
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) close();
});

document.getElementById('btn-pdfpages').addEventListener('click', open);

window.mdPdfPages = {
  open,
  close,
  loadFromPath: loadDocFromPath,
  mergeFromPath,
  getState: () => (doc ? { pageCount: doc.getPageCount(), rotations: doc.getPages().map((p) => p.getRotation().angle) } : null)
};

})();
