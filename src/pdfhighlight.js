(function () {
'use strict';

// PDF: subrayar y escribir. La página se renderiza con pdf.js (pdfjs-dist)
// solo para mostrarla; lo que el usuario agrega vive en memoria:
//   - subrayados: rectángulos (arrastrar el mouse en modo "Subrayar")
//   - textos: cuadros de texto libres (clic en modo "Escribir"), con tamaño y
//     color, que se mueven con su agarradera y se borran con ×
//   - formulario: si el PDF trae campos rellenables (AcroForm), un panel al
//     costado para completarlos
// Recién al "Guardar como..." se abre el PDF original con pdf-lib y se
// dibuja todo de verdad: rectángulos amarillos con blendMode Multiply (como
// un marcador), el texto con Helvetica, y los valores del formulario en sus
// campos. Se guarda como archivo nuevo: el original no se toca.

const overlay = document.getElementById('pdfhighlight-panel');
const modal = overlay.querySelector('.pdfhighlight-modal');
let dockHost = null;
let dockWidth = 0, dockResizeTimer = null;
const dockResize = new ResizeObserver(() => {
  if (!dockHost || Math.abs(dockHost.clientWidth - dockWidth) < 8) return;
  dockWidth = dockHost.clientWidth;
  clearTimeout(dockResizeTimer);
  dockResizeTimer = setTimeout(() => { if (dockHost && pdfDoc) goToPage(pageNum); }, 120);
});
const emptyEl = document.getElementById('pdfhighlight-empty');
const bodyEl = document.getElementById('pdfhighlight-body');
const canvasWrap = document.getElementById('pdfhighlight-canvas-wrap');
const canvas = document.getElementById('pdfhighlight-canvas');
const pageInfoEl = document.getElementById('pdfhighlight-pageinfo');
const prevBtn = document.getElementById('pdfhighlight-prev');
const nextBtn = document.getElementById('pdfhighlight-next');
const undoBtn = document.getElementById('pdfhighlight-undo');
const saveBtn = document.getElementById('pdfhighlight-save');
const modeHighlightBtn = document.getElementById('pdfhighlight-mode-highlight');
const modeTextBtn = document.getElementById('pdfhighlight-mode-text');
const modeSelectBtn = document.getElementById('pdfhighlight-mode-select');
const copyBtn = document.getElementById('pdfhighlight-copy');
const newNoteBtn = document.getElementById('pdfhighlight-new-note');
const addNoteBtn = document.getElementById('pdfhighlight-add-note');
const selectionInfo = document.getElementById('pdfhighlight-selection-info');
const sizeSelect = document.getElementById('pdfhighlight-size');
const colorInput = document.getElementById('pdfhighlight-color');
const formPanel = document.getElementById('pdfhighlight-form');
const documentName = document.getElementById('pdfhighlight-document-name');
const saveStatus = document.getElementById('pdfhighlight-save-status');
const pageInput = document.getElementById('pdfhighlight-page-input');
const zoomSelect = document.getElementById('pdfhighlight-zoom');
const textOptions = document.getElementById('pdfhighlight-text-options');
const modeHelp = document.getElementById('pdfhighlight-mode-help');
const selectionActions = modal.querySelector('.pdfhighlight-selection-actions');
const scrollHost = modal.querySelector('.pdfhighlight-scroll');
const ctx = canvas.getContext('2d');

let originalBytes = null; // Uint8Array del PDF tal cual, sin tocar (para pdf-lib al guardar)
let pdfDoc = null; // documento pdf.js, solo para renderizar
let baseName = 'documento.pdf';
let pageNum = 1;
let numPages = 0;
let scale = 1; // px de pantalla por punto PDF de la página actual
let baseCanvas = null; // página ya renderizada, sin subrayados encima (para redibujar rápido)
let highlights = {}; // { [pagina]: [{x,y,w,h}] } normalizado 0..1 sobre el canvas
let texts = {}; // { [pagina]: [{id,x,y,text,size,color}] } x/y normalizados (esquina sup. izq.), size en puntos PDF
let formFields = []; // [{ name, kind, options }]
let formValues = {}; // { nombreDeCampo: valor }
let mode = 'highlight'; // 'highlight' | 'text'
let dragStart = null;
let dragCurrent = null;
let nextTextId = 1;
let sourcePath = null;
let pageRenderId = 0;
let loadId = 0;
let selectedText = '';
let pageHasText = false;
let pageReady = false;
let savedEdits = null;
let saving = false;
let loadingCount = 0;
let savedPath = '';
let saveError = '';
let lastScrollWidth = 0;
let fitTimer;
new ResizeObserver(() => {
  const width = scrollHost.clientWidth;
  if (!width || width === lastScrollWidth) return;
  lastScrollWidth = width;
  clearTimeout(fitTimer);
  if (pdfDoc && !loadingCount && zoomSelect.value === 'fit') fitTimer = setTimeout(() => goToPage(pageNum), 150);
}).observe(scrollHost);

function updateDocumentStatus() {
  documentName.textContent = sourcePath ? baseName : 'Elige un documento para empezar';
  documentName.title = sourcePath || '';
  const dirty = hasUnsavedChanges();
  const count = Object.values(highlights).reduce((sum, list) => sum + list.length, 0) +
    Object.values(texts).reduce((sum, list) => sum + list.filter((text) => text.text.trim()).length, 0) + Object.keys(formValues).length;
  modal.setAttribute('aria-busy', String(saving || loadingCount > 0));
  saveBtn.disabled = !originalBytes || saving || loadingCount > 0 || !hasChanges();
  saveBtn.textContent = saving ? 'Guardando…' : 'Guardar copia…';
  document.getElementById('pdfhighlight-open').disabled = saving;
  saveStatus.textContent = saving ? 'Guardando la copia…' : loadingCount ? 'Abriendo PDF…' : saveError ||
    (!originalBytes ? 'Sin documento abierto' : dirty ? `${count} ${count === 1 ? 'anotación' : 'anotaciones'} sin guardar` : savedPath ? `Copia guardada: ${savedPath.split(/[\\/]/).pop()}` : 'Listo para anotar');
  saveStatus.title = savedPath || '';
  saveStatus.dataset.state = saveError ? 'error' : dirty ? 'pending' : savedPath ? 'saved' : 'ready';
}

function editsSnapshot() { return JSON.stringify([highlights, texts, formValues]); }
function hasUnsavedChanges() { return hasChanges() && editsSnapshot() !== savedEdits; }

function clearSelection() {
  selectedText = '';
  const selection = window.getSelection();
  if (selection?.anchorNode && canvasWrap.contains(selection.anchorNode)) selection.removeAllRanges();
  updateSelection();
}

function updateSelection() {
  copyBtn.disabled = newNoteBtn.disabled = !selectedText || mode !== 'select' || !pageReady;
  const info = window.mdTabs?.getActiveTabInfo();
  const activeMode = window.mdCodeMirror?.getOption('mode');
  const isMarkdown = (typeof activeMode === 'string' ? activeMode : activeMode?.name) === 'markdown';
  addNoteBtn.disabled = newNoteBtn.disabled || !info || !isMarkdown;
  addNoteBtn.title = info && isMarkdown ? `Añadir al final de ${info.filePath?.split(/[\\/]/).pop() || 'Sin título'}` : 'Abre una nota Markdown primero';
  selectionInfo.textContent = selectedText ? `${selectedText.length} caracteres seleccionados · página ${pageNum}` :
    !pdfDoc ? 'Abre un PDF para seleccionar texto.' : !pageReady ? 'Cargando página…' : !pageHasText ? 'Esta página no tiene texto extraíble; puede ser una imagen escaneada (sin OCR).' :
      mode === 'select' ? 'Arrastra sobre el texto original. Ctrl+C para copiar.' : 'Activa Seleccionar para copiar texto o llevarlo a una nota.';
}

document.addEventListener('selectionchange', () => {
  if ((!dockHost && overlay.hidden) || mode !== 'select' || !pageReady) return;
  const selection = window.getSelection();
  const layer = canvasWrap.querySelector('.pdf-select-text-layer');
  if (!layer || !selection?.anchorNode || !layer.contains(selection.anchorNode) || !layer.contains(selection.focusNode)) return;
  selectedText = selection.toString().replace(/\r\n?/g, '\n').trim();
  updateSelection();
});

function citation() {
  if (!selectedText || !sourcePath) return null;
  const target = sourcePath.split('/').map((part) => encodeURIComponent(part).replace(/\(/g, '%28').replace(/\)/g, '%29')).join('/');
  const label = baseName.replace(/[\r\n]/g, ' ').replace(/[\\[\]]/g, '\\$&');
  return selectedText.split('\n').map((line) => `> ${line}`).join('\n') + `\n\n[${label} — página ${pageNum}](md-local://file${target}#page=${pageNum})\n`;
}

function addSelectionToNote(createNew) {
  updateSelection();
  const fragment = citation();
  if (!fragment || (createNew ? newNoteBtn.disabled : addNoteBtn.disabled)) return;
  if (!dockHost) close();
  if (!dockHost && document.body.classList.contains('home-active')) window.mdHome.close();
  if (createNew) { window.mdTabs.newTab(''); window.mdCodeMirror.setValue(fragment); }
  else {
    document.querySelector('#tabbar .tab.active')?.click();
    const cm = window.mdCodeMirror;
    const line = cm.lineCount() - 1;
    cm.replaceRange(`\n\n${fragment}`, { line, ch: cm.getLine(line).length });
  }
  const cm = window.mdCodeMirror;
  if (window.mdModes?.getLayoutMode() === 'read') window.mdModes.setLayoutMode('normal');
  const last = cm.lineCount() - 1;
  cm.setCursor({ line: last, ch: cm.getLine(last).length });
  cm.scrollIntoView(cm.getCursor());
  cm.focus();
}

copyBtn.addEventListener('mousedown', (e) => e.preventDefault());
copyBtn.addEventListener('click', async () => {
  if (!selectedText) return;
  try { await window.mdEditor.clipboardWriteText(selectedText); selectionInfo.textContent = 'Selección copiada.'; }
  catch { alert('No se pudo copiar la selección.'); }
});
[newNoteBtn, addNoteBtn].forEach((button) => button.addEventListener('mousedown', (e) => e.preventDefault()));
newNoteBtn.addEventListener('click', () => addSelectionToNote(true));
addNoteBtn.addEventListener('click', () => addSelectionToNote(false));

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
  updateDocumentStatus();
}

function hasChanges() {
  return Object.values(highlights).some((l) => l && l.length) ||
    Object.values(texts).some((l) => l && l.some((t) => t.text.trim())) ||
    Object.keys(formValues).length > 0;
}

// ---- cuadros de texto ----

function textBoxFor(t) {
  const box = document.createElement('div');
  box.className = 'pdf-text-box';
  box.dataset.id = t.id;
  box.style.left = `${t.x * 100}%`;
  box.style.top = `${t.y * 100}%`;

  const handle = document.createElement('span');
  handle.className = 'pdf-text-handle';
  handle.title = 'Arrastrar para mover';
  handle.textContent = '⠿';
  const del = document.createElement('button');
  del.className = 'pdf-text-del';
  del.title = 'Borrar este texto';
  del.textContent = '×';
  const edit = document.createElement('div');
  edit.className = 'pdf-text-edit';
  edit.contentEditable = 'plaintext-only';
  edit.spellcheck = false;
  edit.textContent = t.text;
  edit.style.fontSize = `${t.size * scale}px`;
  edit.style.color = t.color;
  box.append(handle, edit, del);

  edit.setAttribute('role', 'textbox');
  edit.setAttribute('aria-label', 'Texto añadido al PDF');
  edit.addEventListener('input', () => { t.text = edit.innerText.replace(/\n$/, ''); saveError = ''; updateDocumentStatus(); });
  edit.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Escape/atajos globales: no cerrar el panel mientras se escribe
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveCopy(); }
    if (e.key === 'Escape') edit.blur();
  });
  edit.addEventListener('blur', () => {
    if (!t.text.trim()) removeText(t.id); // cuadro vacío: no queda nada
  });
  del.addEventListener('mousedown', (e) => e.preventDefault());
  del.addEventListener('click', () => removeText(t.id));
  box.addEventListener('mousedown', (e) => e.stopPropagation()); // no crear otro cuadro ni subrayar

  // Mover: arrastrar la agarradera.
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const x0 = t.x;
    const y0 = t.y;
    const onMove = (ev) => {
      t.x = Math.max(0, Math.min(0.98, x0 + (ev.clientX - startX) / rect.width));
      t.y = Math.max(0, Math.min(0.98, y0 + (ev.clientY - startY) / rect.height));
      box.style.left = `${t.x * 100}%`;
      box.style.top = `${t.y * 100}%`;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
  return { box, edit };
}

function renderTexts() {
  canvasWrap.querySelectorAll('.pdf-text-box').forEach((b) => b.remove());
  (texts[pageNum] || []).forEach((t) => canvasWrap.appendChild(textBoxFor(t).box));
}

function addText(xNorm, yNorm, initialText) {
  const t = {
    id: nextTextId++,
    x: xNorm,
    y: yNorm,
    text: initialText || '',
    size: Number(sizeSelect.value) || 12,
    color: colorInput.value || '#000000'
  };
  if (!texts[pageNum]) texts[pageNum] = [];
  texts[pageNum].push(t);
  const { box, edit } = textBoxFor(t);
  canvasWrap.appendChild(box);
  updateDocumentStatus();
  requestAnimationFrame(() => edit.focus());
  return t;
}

function removeText(id) {
  texts[pageNum] = (texts[pageNum] || []).filter((t) => t.id !== id);
  updateDocumentStatus();
  const box = canvasWrap.querySelector(`.pdf-text-box[data-id="${id}"]`);
  if (box) box.remove();
}

// ---- páginas ----

async function renderPage(n) {
  lastScrollWidth = scrollHost.clientWidth;
  const id = ++pageRenderId;
  const documentForPage = pdfDoc;
  pageReady = false;
  canvasWrap.classList.add('pdf-page-loading');
  canvasWrap.querySelector('.pdf-select-text-layer')?.remove();
  clearSelection();
  const page = await documentForPage.getPage(n);
  const unscaled = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(160, scrollHost.clientWidth ? scrollHost.clientWidth - 40 : 700);
  const pageScale = zoomSelect.value === 'fit' ? availableWidth / unscaled.width : Number(zoomSelect.value) || 1;
  const viewport = page.getViewport({ scale: pageScale });
  const rendered = document.createElement('canvas');
  rendered.width = viewport.width;
  rendered.height = viewport.height;
  await page.render({ canvasContext: rendered.getContext('2d'), viewport }).promise;
  const content = await page.getTextContent();
  const layer = document.createElement('div');
  layer.className = 'pdf-select-text-layer';
  layer.style.setProperty('--total-scale-factor', String(pageScale * (page.userUnit || 1)));
  layer.style.setProperty('--scale-round-x', '1px');
  layer.style.setProperty('--scale-round-y', '1px');
  const textLayer = new window.pdfjsLib.TextLayer({ textContentSource: content, container: layer, viewport });
  await textLayer.render();
  if (id !== pageRenderId || documentForPage !== pdfDoc || n !== pageNum) return;
  scale = pageScale;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvasWrap.style.width = `${viewport.width}px`;
  canvasWrap.style.height = `${viewport.height}px`;
  baseCanvas = rendered;
  canvasWrap.querySelector('.pdf-select-text-layer')?.remove();
  canvasWrap.appendChild(layer);
  pageHasText = content.items.some((item) => item.str?.trim());
  pageReady = true;
  canvasWrap.classList.remove('pdf-page-loading');
  updateSelection();
  redraw();
  renderTexts();
}

async function goToPage(n) {
  if (!pdfDoc) return;
  dragStart = dragCurrent = null;
  const targetDoc = pdfDoc;
  pageNum = Math.max(1, Math.min(numPages, n));
  const targetPage = pageNum;
  pageInfoEl.textContent = `Página ${pageNum} / ${numPages}`;
  pageInput.disabled = false;
  pageInput.max = String(numPages);
  pageInput.value = String(pageNum);
  prevBtn.disabled = pageNum <= 1;
  nextBtn.disabled = pageNum >= numPages;
  try { await renderPage(targetPage); }
  catch (error) {
    if (targetDoc !== pdfDoc || targetPage !== pageNum) return;
    window.mdEditor.logError('pdf:pagina', String(error));
    alert('No se pudo dibujar esta página del PDF.');
  }
  updateUndoBtn();
}

function setMode(next) {
  if (!['highlight', 'text', 'select'].includes(next)) return;
  dragStart = dragCurrent = null;
  clearSelection();
  mode = next;
  modeHighlightBtn.classList.toggle('pdfhighlight-mode-active', mode === 'highlight');
  modeTextBtn.classList.toggle('pdfhighlight-mode-active', mode === 'text');
  canvasWrap.classList.toggle('pdfhighlight-text-mode', mode === 'text');
  canvasWrap.classList.toggle('pdfhighlight-select-mode', mode === 'select');
  modeSelectBtn.classList.toggle('pdfhighlight-mode-active', mode === 'select');
  textOptions.hidden = mode !== 'text';
  selectionActions.hidden = mode !== 'select';
  modeHelp.textContent = mode === 'highlight' ? 'Arrastra sobre la página para subrayar. Puedes deshacer el último subrayado de esta página.' :
    mode === 'text' ? 'Haz clic en la página para escribir. Usa el asa del cuadro para moverlo y × para borrarlo.' :
    'Selecciona texto para copiarlo o llevarlo a tus notas.';
  [modeSelectBtn, modeHighlightBtn, modeTextBtn].forEach((button) => button.setAttribute('aria-pressed', String(button.classList.contains('pdfhighlight-mode-active'))));
  updateSelection();
}

canvas.addEventListener('mousedown', (e) => {
  if (!pageReady || mode === 'select' || e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  if (mode === 'text') {
    e.preventDefault();
    addText((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    return;
  }
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

// Tamaño/color: se aplican al cuadro que tiene el foco (y a los próximos).
function applyStyleToFocused() {
  const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.pdf-text-box');
  if (!focused) return;
  const t = (texts[pageNum] || []).find((x) => String(x.id) === focused.dataset.id);
  if (!t) return;
  t.size = Number(sizeSelect.value) || t.size;
  t.color = colorInput.value || t.color;
  const edit = focused.querySelector('.pdf-text-edit');
  edit.style.fontSize = `${t.size * scale}px`;
  edit.style.color = t.color;
  updateDocumentStatus();
}
[sizeSelect, colorInput].forEach((el) => {
  el.addEventListener('mousedown', () => {
    // Recordar el cuadro enfocado antes de que el select le robe el foco.
    const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.pdf-text-box');
    el._targetBox = focused || null;
  });
  el.addEventListener('change', () => {
    if (el._targetBox) {
      const edit = el._targetBox.querySelector('.pdf-text-edit');
      if (edit) edit.focus();
    }
    applyStyleToFocused();
  });
});

// ---- formulario (AcroForm) ----

// instanceof y no constructor.name: la build de pdf-lib viene minificada.
function fieldKind(field) {
  if (field instanceof PDFLib.PDFTextField) return 'text';
  if (field instanceof PDFLib.PDFCheckBox) return 'checkbox';
  if (field instanceof PDFLib.PDFDropdown) return 'dropdown';
  if (field instanceof PDFLib.PDFRadioGroup) return 'radio';
  if (field instanceof PDFLib.PDFOptionList) return 'list';
  return null;
}

async function loadFormFields() {
  const bytesForForm = originalBytes;
  formFields = [];
  formValues = {};
  try {
    const doc = await PDFLib.PDFDocument.load(bytesForForm);
    if (bytesForForm !== originalBytes) return;
    doc.getForm().getFields().forEach((f) => {
      const kind = fieldKind(f);
      if (!kind) return;
      const entry = { name: f.getName(), kind, options: [] };
      try {
        if (kind === 'text') entry.value = f.getText() || '';
        else if (kind === 'checkbox') entry.value = f.isChecked();
        else {
          entry.options = f.getOptions();
          const sel = kind === 'radio' ? f.getSelected() : (f.getSelected() || [])[0];
          entry.value = sel || '';
        }
      } catch {
        entry.value = '';
      }
      formFields.push(entry);
    });
  } catch {
    formFields = [];
  }
  renderFormPanel();
}

function renderFormPanel() {
  formPanel.innerHTML = '';
  formPanel.hidden = !formFields.length;
  if (!formFields.length) return;
  const title = document.createElement('div');
  title.className = 'pdfhighlight-form-title';
  title.textContent = `Formulario (${formFields.length} campo${formFields.length === 1 ? '' : 's'})`;
  formPanel.appendChild(title);
  formFields.forEach((f) => {
    const row = document.createElement('label');
    row.className = 'pdfhighlight-form-field';
    const name = document.createElement('span');
    name.textContent = f.name;
    let input;
    if (f.kind === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!f.value;
      input.addEventListener('change', () => { formValues[f.name] = input.checked; updateDocumentStatus(); });
      row.classList.add('pdfhighlight-form-check');
      row.append(input, name);
    } else if (f.kind === 'text') {
      input = document.createElement('input');
      input.value = f.value || '';
      input.addEventListener('input', () => { formValues[f.name] = input.value; updateDocumentStatus(); });
      row.append(name, input);
    } else {
      input = document.createElement('select');
      ['', ...f.options].forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o || '(sin elegir)';
        input.appendChild(opt);
      });
      input.value = f.value || '';
      input.addEventListener('change', () => { formValues[f.name] = input.value; updateDocumentStatus(); });
      row.append(name, input);
    }
    input.className = 'pdfhighlight-form-input';
    input.addEventListener('keydown', (e) => e.stopPropagation());
    formPanel.appendChild(row);
  });
}

// ---- abrir / guardar ----

async function loadFromPath(filePath) {
  if (saving) return false;
  loadingCount++;
  updateDocumentStatus();
  try { return await loadPdfFromPath(filePath); }
  finally { loadingCount--; updateDocumentStatus(); }
}

async function loadPdfFromPath(filePath) {
  if (sourcePath && hasUnsavedChanges() && !confirm('Hay anotaciones sin guardar. ¿Abrir otro PDF y descartarlas?')) return false;
  const id = ++loadId;
  const initialEdits = editsSnapshot();
  if (!window.pdfjsLib) {
    alert('El visor de PDF todavía está cargando, probá de nuevo en un segundo.');
    return;
  }
  const base64 = await window.mdEditor.pdfReadBytes(filePath);
  if (!base64) {
    alert('No se pudo leer el PDF.');
    return;
  }
  const bytes = base64ToBytes(base64);
  let loaded;
  try {
    loaded = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  } catch (e) {
    window.mdEditor.logError('pdf:abrir', (e && e.stack) || String(e));
    alert('Ese archivo no parece ser un PDF válido.');
    return;
  }
  if (id !== loadId) { await loaded.loadingTask.destroy(); return false; }
  if (initialEdits !== editsSnapshot() && hasUnsavedChanges() && !confirm('Has cambiado anotaciones mientras se abría el PDF. ¿Descartarlas?')) {
    await loaded.loadingTask.destroy();
    return false;
  }
  const previous = pdfDoc;
  pdfDoc = loaded;
  originalBytes = bytes;
  sourcePath = filePath;
  baseName = filePath.split(/[\\/]/).pop();
  highlights = {};
  texts = {};
  savedEdits = null;
  savedPath = saveError = '';
  clearSelection();
  if (previous) previous.loadingTask.destroy().catch(() => {});
  numPages = pdfDoc.numPages;
  emptyEl.hidden = true;
  bodyEl.hidden = false;
  saveBtn.disabled = false;
  await loadFormFields();
  if (id !== loadId) return false;
  await goToPage(1);
  return true;
}

// Helvetica (fuente estándar de PDF) cubre los acentos, ñ, ¿¡ del español
// (WinAnsi), pero no emojis u otros alfabetos: esos se reemplazan por "?"
// en vez de romper el guardado.
function drawableText(font, text) {
  return Array.from(text).map((ch) => {
    try {
      font.encodeText(ch);
      return ch;
    } catch {
      return '?';
    }
  }).join('');
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0;
  return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function buildPdf() {
  const [savedHighlights, savedTexts, savedForm] = JSON.parse(editsSnapshot());
  const bytesForSave = originalBytes;
  const pdfLibDoc = await PDFLib.PDFDocument.load(bytesForSave);
  const pages = pdfLibDoc.getPages();
  const font = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  Object.keys(savedHighlights).map(Number).forEach((n) => {
    const page = pages[n - 1];
    if (!page) return;
    const { width, height } = page.getSize();
    (savedHighlights[n] || []).forEach((h) => {
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

  Object.keys(savedTexts).map(Number).forEach((n) => {
    const page = pages[n - 1];
    if (!page) return;
    const { width, height } = page.getSize();
    (savedTexts[n] || []).forEach((t) => {
      if (!t.text.trim()) return;
      // Misma caja que en pantalla: esquina superior izquierda en (x, y),
      // interlineado 1.2; la línea base queda ~0.8 del tamaño abajo del borde.
      t.text.split('\n').forEach((line, i) => {
        page.drawText(drawableText(font, line), {
          x: t.x * width,
          y: height - t.y * height - t.size * (0.8 + i * 1.2),
          size: t.size,
          font,
          color: hexToRgb(t.color)
        });
      });
    });
  });

  const formNames = Object.keys(savedForm);
  if (formNames.length) {
    const form = pdfLibDoc.getForm();
    formNames.forEach((name) => {
      const v = savedForm[name];
      try {
        const field = form.getField(name);
        const kind = fieldKind(field);
        if (kind === 'text') {
          field.setText(drawableText(font, String(v)));
        } else if (kind === 'checkbox') {
          if (v) field.check(); else field.uncheck();
        } else if (v) {
          field.select(v); // dropdown, lista u opción de un grupo
        } else if (kind === 'dropdown' || kind === 'list') {
          field.clear();
        }
      } catch {
        // un campo raro no tiene que impedir guardar el resto
      }
    });
    try {
      form.updateFieldAppearances(font);
    } catch {
      // se guardan los valores aunque no se pueda regenerar la apariencia
    }
  }
  return pdfLibDoc.save();
}

document.getElementById('pdfhighlight-open').addEventListener('click', async () => {
  const paths = await window.mdEditor.pdfPickFiles(false);
  if (!paths) return;
  await loadFromPath(paths[0]);
});
document.getElementById('pdfhighlight-empty-open').addEventListener('click', () => document.getElementById('pdfhighlight-open').click());
document.getElementById('pdfhighlight-close').addEventListener('click', close);
pageInput.addEventListener('change', () => {
  const value = Number(pageInput.value);
  if (!Number.isInteger(value) || value < 1 || value > numPages) { pageInput.value = String(pageNum); return; }
  goToPage(value);
});
pageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); pageInput.dispatchEvent(new Event('change')); }
});
zoomSelect.addEventListener('change', () => { if (pdfDoc) goToPage(pageNum); });

prevBtn.addEventListener('click', () => goToPage(pageNum - 1));
nextBtn.addEventListener('click', () => goToPage(pageNum + 1));
modeHighlightBtn.addEventListener('click', () => setMode('highlight'));
modeTextBtn.addEventListener('click', () => setMode('text'));
modeSelectBtn.addEventListener('click', () => setMode('select'));

undoBtn.addEventListener('click', () => {
  if (!highlights[pageNum] || !highlights[pageNum].length) return;
  highlights[pageNum].pop();
  updateUndoBtn();
  redraw();
});

async function saveCopy() {
  if (!originalBytes || saving) return;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (!hasChanges()) {
    updateDocumentStatus();
    return;
  }
  const suffix = Object.values(texts).some((l) => l && l.length) || Object.keys(formValues).length ? '-editado.pdf' : '-subrayado.pdf';
  const saveName = baseName.replace(/\.pdf$/i, '') + suffix;
  const snapshot = editsSnapshot();
  const savingSource = sourcePath;
  saving = true;
  saveError = '';
  updateDocumentStatus();
  try {
    const bytes = await buildPdf();
    const base64 = await bytesToBase64(bytes);
    const exportedPath = await window.mdEditor.pdfSaveBytes(base64, saveName);
    if (exportedPath) {
      if (sourcePath === savingSource) {
        savedEdits = snapshot;
        savedPath = exportedPath;
      }
    }
  } catch (error) {
    window.mdEditor.logError('pdf:guardar', String(error));
    saveError = 'No se pudo guardar. Tus anotaciones siguen disponibles; vuelve a intentarlo.';
  } finally { saving = false; updateDocumentStatus(); }
}
saveBtn.addEventListener('click', saveCopy);
modal.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault(); event.stopPropagation(); saveCopy();
  }
});

async function open() {
  const box = modal;
  let tabs = box.querySelector('.pdf-document-tabs');
  if (!tabs) {
    tabs = document.createElement('nav');
    tabs.className = 'pdf-document-tabs';
    tabs.setAttribute('aria-label', 'Cambiar a un documento abierto');
    const links = document.createElement('details');
    links.className = 'pdf-note-links';
    const summary = document.createElement('summary');
    summary.textContent = 'Notas abiertas';
    links.append(summary, tabs);
    selectionActions.after(links);
  }
  tabs.replaceChildren();
  document.querySelectorAll('#tabbar .tab').forEach((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-button';
    button.textContent = tab.querySelector('.tab-label').textContent;
    button.title = tab.title;
    button.addEventListener('click', () => {
      if (!dockHost) close(); // En estudio, el PDF permanece visible al cambiar de nota.
      if (!dockHost && document.body.classList.contains('home-active')) window.mdHome.close();
      if (tab.isConnected) tab.click();
    });
    tabs.appendChild(button);
  });
  overlay.hidden = !!dockHost;
  updateSelection();
  updateDocumentStatus();
  if (pdfDoc && !loadingCount && zoomSelect.value === 'fit') await goToPage(pageNum);
}

function close() {
  if (dockHost) undock();
  overlay.hidden = true;
}
async function dock(host) {
  const changed = dockHost !== host;
  dockResize.disconnect(); clearTimeout(dockResizeTimer);
  dockHost = host; dockWidth = host.clientWidth; host.append(modal); modal.classList.add('pdf-study-docked'); await open();
  dockResize.observe(host);
  if (changed && pdfDoc) await goToPage(pageNum);
}
function undock() {
  const wasDocked = !!dockHost;
  dockResize.disconnect(); clearTimeout(dockResizeTimer);
  dockHost = null; overlay.append(modal); modal.classList.remove('pdf-study-docked'); overlay.hidden = true;
  if (wasDocked && pdfDoc) goToPage(pageNum);
}
// Las pestañas se reconstruyen al editar o cambiar de nota: no conservar
// botones que apunten a nodos antiguos mientras el PDF siga visible.
new MutationObserver(() => { if (dockHost || !overlay.hidden) open(); }).observe(document.getElementById('tabbar'), { childList: true, subtree: true });

async function openLink(href, basePath) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('md-local://file/')) return false;
  const match = /^(.+\.pdf)(?:#page=(\d+))?$/i.exec(href);
  if (!match) return false;
  try {
    const raw = decodeURIComponent(match[1].replace(/^md-local:\/\/file/, ''));
    if (!raw.startsWith('/') && !basePath) return false;
    const filePath = raw.startsWith('/') ? raw : window.mdEditor.resolveLocalPath(basePath, raw);
    if (filePath !== sourcePath && !await loadFromPath(filePath)) return true;
    await open();
    setMode('select');
    await goToPage(Number(match[2]) || 1);
  } catch (error) {
    window.mdEditor.logError('pdf:referencia', String(error));
    alert('No se pudo abrir la referencia PDF. Comprueba la ruta y abre su carpeta o el archivo primero.');
  }
  return true;
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) close();
});

document.getElementById('btn-pdfhighlight').addEventListener('click', async () => {
  await open();
  const path = window.mdState.currentFilePath;
  if (!dockHost && /\.pdf$/i.test(path || '') && path !== sourcePath) await loadFromPath(path);
});

window.mdPdfHighlight = {
  open,
  dock,
  undock,
  close,
  loadFromPath,
  setMode,
  openLink,
  goToPage,
  // Solo para test/renderer-checks.js: marca un subrayado / texto / campo
  // directo, sin simular el mouse real.
  addHighlightForTest: (xNorm, yNorm, wNorm, hNorm) => {
    if (!highlights[pageNum]) highlights[pageNum] = [];
    highlights[pageNum].push({ x: xNorm, y: yNorm, w: wNorm, h: hNorm });
    updateUndoBtn();
    redraw();
  },
  addTextForTest: (xNorm, yNorm, text) => addText(xNorm, yNorm, text),
  setFormValueForTest: (name, value) => { formValues[name] = value; updateDocumentStatus(); },
  buildPdfForTest: () => buildPdf(),
  getState: () => (pdfDoc ? {
    pageNum,
    sourcePath,
    mode,
    selectedText,
    pageHasText,
    pageReady,
    numPages,
    zoom: zoomSelect.value,
    saving,
    unsaved: hasUnsavedChanges(),
    savedPath,
    highlightCount: (highlights[pageNum] || []).length,
    textCount: (texts[pageNum] || []).length,
    formFields: formFields.map((f) => f.name)
  } : null)
};

setMode('select');

})();
