(function () {
'use strict';

// Subrayar texto en un PDF: la página se renderiza con pdf.js (pdfjs-dist)
// nomás para mostrarla en pantalla, arrastrar el mouse encima marca un
// rectángulo. Recién al "Guardar como..." se abre el PDF original con
// pdf-lib y se dibujan esos rectángulos de verdad encima del texto (color
// amarillo semitransparente con blendMode "Multiply", como un marcador real).
// Ver MANUAL.md.

const overlay = document.getElementById('pdfhighlight-panel');
const emptyEl = document.getElementById('pdfhighlight-empty');
const canvasWrap = document.getElementById('pdfhighlight-canvas-wrap');
const canvas = document.getElementById('pdfhighlight-canvas');
const pageInfoEl = document.getElementById('pdfhighlight-pageinfo');
const prevBtn = document.getElementById('pdfhighlight-prev');
const nextBtn = document.getElementById('pdfhighlight-next');
const undoBtn = document.getElementById('pdfhighlight-undo');
const saveBtn = document.getElementById('pdfhighlight-save');
const ctx = canvas.getContext('2d');

let originalBytes = null; // Uint8Array del PDF tal cual, sin tocar (para pdf-lib al guardar)
let pdfDoc = null; // documento pdf.js, solo para renderizar
let baseName = 'documento.pdf';
let pageNum = 1;
let numPages = 0;
let baseCanvas = null; // página ya renderizada, sin subrayados encima (para redibujar rápido)
let highlights = {}; // { [numDePagina]: [{x,y,w,h}] } normalizado 0..1 sobre el canvas
let dragStart = null;
let dragCurrent = null;

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function redraw() {
  if (!baseCanvas) return;
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.fillStyle = 'rgba(255, 224, 40, 0.45)';
  (highlights[pageNum] || []).forEach((h) => {
    ctx.fillRect(h.x * canvas.width, h.y * canvas.height, h.w * canvas.width, h.h * canvas.height);
  });
  if (dragStart && dragCurrent) {
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    ctx.fillRect(x, y, Math.abs(dragCurrent.x - dragStart.x), Math.abs(dragCurrent.y - dragStart.y));
  }
}

function updateUndoBtn() {
  undoBtn.disabled = !(highlights[pageNum] && highlights[pageNum].length);
}

async function renderPage(n) {
  const page = await pdfDoc.getPage(n);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = Math.min(700 / unscaled.width, 1.4);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  baseCanvas = document.createElement('canvas');
  baseCanvas.width = viewport.width;
  baseCanvas.height = viewport.height;
  await page.render({ canvasContext: baseCanvas.getContext('2d'), viewport }).promise;
  redraw();
}

async function goToPage(n) {
  if (!pdfDoc) return;
  pageNum = Math.max(1, Math.min(numPages, n));
  pageInfoEl.textContent = `Página ${pageNum} / ${numPages}`;
  prevBtn.disabled = pageNum <= 1;
  nextBtn.disabled = pageNum >= numPages;
  await renderPage(pageNum);
  updateUndoBtn();
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  dragCurrent = dragStart;
});

window.addEventListener('mousemove', (e) => {
  if (!dragStart) return;
  const rect = canvas.getBoundingClientRect();
  dragCurrent = {
    x: Math.max(0, Math.min(canvas.width, e.clientX - rect.left)),
    y: Math.max(0, Math.min(canvas.height, e.clientY - rect.top))
  };
  redraw();
});

window.addEventListener('mouseup', () => {
  if (!dragStart || !dragCurrent) { dragStart = null; dragCurrent = null; return; }
  const x = Math.min(dragStart.x, dragCurrent.x);
  const y = Math.min(dragStart.y, dragCurrent.y);
  const w = Math.abs(dragCurrent.x - dragStart.x);
  const h = Math.abs(dragCurrent.y - dragStart.y);
  dragStart = null;
  dragCurrent = null;
  if (w < 4 || h < 4) { redraw(); return; } // arrastre insignificante, no es un subrayado real
  if (!highlights[pageNum]) highlights[pageNum] = [];
  highlights[pageNum].push({ x: x / canvas.width, y: y / canvas.height, w: w / canvas.width, h: h / canvas.height });
  updateUndoBtn();
  redraw();
});

async function loadFromPath(filePath) {
  if (!window.pdfjsLib) {
    alert('El visor de PDF todavía está cargando, probá de nuevo en un segundo.');
    return;
  }
  const base64 = await window.mdEditor.pdfReadBytes(filePath);
  if (!base64) {
    alert('No se pudo leer el PDF.');
    return;
  }
  originalBytes = base64ToBytes(base64);
  baseName = filePath.split(/[\\/]/).pop();
  highlights = {};
  try {
    pdfDoc = await window.pdfjsLib.getDocument({ data: originalBytes.slice() }).promise;
  } catch (e) {
    alert('Ese archivo no parece ser un PDF válido.');
    return;
  }
  numPages = pdfDoc.numPages;
  emptyEl.hidden = true;
  canvasWrap.hidden = false;
  saveBtn.disabled = false;
  await goToPage(1);
}

document.getElementById('pdfhighlight-open').addEventListener('click', async () => {
  const paths = await window.mdEditor.pdfPickFiles(false);
  if (!paths) return;
  await loadFromPath(paths[0]);
});

prevBtn.addEventListener('click', () => goToPage(pageNum - 1));
nextBtn.addEventListener('click', () => goToPage(pageNum + 1));

undoBtn.addEventListener('click', () => {
  if (!highlights[pageNum] || !highlights[pageNum].length) return;
  highlights[pageNum].pop();
  updateUndoBtn();
  redraw();
});

saveBtn.addEventListener('click', async () => {
  if (!originalBytes) return;
  const pageNumbers = Object.keys(highlights).map(Number).filter((n) => highlights[n] && highlights[n].length);
  if (!pageNumbers.length) {
    alert('Todavía no marcaste ningún subrayado (arrastrá el mouse sobre el texto).');
    return;
  }
  const pdfLibDoc = await PDFLib.PDFDocument.load(originalBytes);
  const pages = pdfLibDoc.getPages();
  pageNumbers.forEach((n) => {
    const page = pages[n - 1];
    if (!page) return;
    const { width, height } = page.getSize();
    highlights[n].forEach((h) => {
      page.drawRectangle({
        x: h.x * width,
        y: height - (h.y + h.h) * height,
        width: h.w * width,
        height: h.h * height,
        color: PDFLib.rgb(1, 0.88, 0.16),
        opacity: 0.45,
        blendMode: PDFLib.BlendMode.Multiply
      });
    });
  });
  const bytes = await pdfLibDoc.save();
  const base64 = await bytesToBase64(bytes);
  const savedPath = await window.mdEditor.pdfSaveBytes(base64, baseName.replace(/\.pdf$/i, '') + '-subrayado.pdf');
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

document.getElementById('btn-pdfhighlight').addEventListener('click', open);

window.mdPdfHighlight = {
  open,
  close,
  loadFromPath,
  // Solo para test/renderer-checks.js: marca un subrayado directo por
  // coordenadas normalizadas, sin simular el arrastre real del mouse.
  addHighlightForTest: (xNorm, yNorm, wNorm, hNorm) => {
    if (!highlights[pageNum]) highlights[pageNum] = [];
    highlights[pageNum].push({ x: xNorm, y: yNorm, w: wNorm, h: hNorm });
    updateUndoBtn();
    redraw();
  },
  getState: () => (pdfDoc ? { pageNum, numPages, highlightCount: (highlights[pageNum] || []).length } : null)
};

})();
