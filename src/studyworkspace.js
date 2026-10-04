(function () {
'use strict';
const pane = document.getElementById('secondary-pane');
const body = document.getElementById('secondary-pane-body');
let workspace = null, busy = false, previousMode = null;
function node(tag, text) { const el = document.createElement(tag); if (text) el.textContent = text; return el; }
function message(text) { const info = workspace?.querySelector('[role="status"]'); if (info) info.textContent = text; }
async function run(action) {
  if (busy) return; busy = true;
  workspace?.querySelectorAll('.study-workspace-toolbar button').forEach((b) => { b.disabled = true; });
  try { await action(); } catch (error) { message(error.message || 'No se pudo abrir el material.'); }
  finally { busy = false; workspace?.querySelectorAll('.study-workspace-toolbar button').forEach((b) => { b.disabled = false; }); }
}
function checkModule(name) { if (window.mdModules && !window.mdModules.isOn(name)) throw new Error(`Activa el módulo ${name} en Ajustes.`); }
async function showPdf(path) {
  checkModule('pdf');
  if (!/\.pdf$/i.test(path || '')) throw new Error('Elige un PDF.');
  const pdf = window.mdPdfHighlight;
  if (pdf.getState()?.sourcePath !== path && !await pdf.loadFromPath(path)) return false;
  await pdf.dock(workspace.querySelector('#study-workspace-pdf')); pdf.setMode('select');
  message('Selecciona texto en el PDF y usa Añadir al final de nota abierta. La nota es la pestaña Markdown activa.'); return true;
}
async function showDrawing(path) {
  if (path && !/\.excalidraw$/i.test(path)) throw new Error('Elige una pizarra .excalidraw.');
  const host = workspace.querySelector('#study-workspace-drawing');
  if (!await window.mdDrawing.dock(host, path)) return false;
  workspace.classList.add('has-drawing'); return true;
}
async function showNote(path) {
  if (!/\.(md|markdown)$/i.test(path || '')) throw new Error('Elige una nota Markdown guardada.');
  const file = await window.mdEditor.readFile(path);
  if (!file || file.binary || typeof file.content !== 'string') throw new Error('No se pudo leer la nota. Autoriza su carpeta primero.');
  await window.openFileAtPath(path);
  window.mdModes.setLayoutMode('focus');
}
function close() {
  if (!workspace) return true;
  const drawing = window.mdDrawing.getState();
  if (busy || drawing.opening || drawing.saving || (drawing.docked && !window.mdDrawing.close())) return false;
  window.mdPdfHighlight.undock(); workspace.remove(); workspace = null;
  pane.classList.remove('study-workspace-pane');
  pane.querySelector('.secondary-pane-hint').hidden = false;
  window.mdSecondaryPane.close();
  if (previousMode && window.mdModes.getLayoutMode() === 'focus') window.mdModes.setLayoutMode(previousMode);
  previousMode = null; return true;
}
async function open(options = {}) {
  if (busy) return false;
  if (!workspace) {
    window.mdSecondaryPane.close(); previousMode = window.mdModes.getLayoutMode();
    workspace = node('section'); workspace.id = 'study-workspace'; workspace.setAttribute('aria-label', 'Vista de estudio dividida');
    const toolbar = node('div'); toolbar.className = 'study-workspace-toolbar';
    function button(label, id, action) { const b = node('button', label); b.type = 'button'; b.className = 'toolbar-button'; b.id = id; b.addEventListener('click', () => run(action)); toolbar.append(b); }
    button('Abrir nota…', 'study-workspace-note-open', async () => { const path = await window.mdEditor.openFile(); if (path) await showNote(path); });
    button('Abrir PDF…', 'study-workspace-pdf-open', async () => { const path = await window.mdEditor.openFile(); if (path) await showPdf(path); });
    button('Abrir pizarra…', 'study-workspace-drawing-open', async () => { const path = await window.mdEditor.openFile(); if (path) await showDrawing(path); });
    button('Nueva pizarra', 'study-workspace-drawing-new', () => showDrawing(null));
    button('Ocultar pizarra', 'study-workspace-drawing-hide', () => { workspace.classList.remove('has-drawing'); });
    button('Mostrar pizarra', 'study-workspace-drawing-show', () => { if (window.mdDrawing.getState().docked) workspace.classList.add('has-drawing'); });
    const status = node('p', 'Abre un PDF junto a tu nota. Usa Todos los archivos en el diálogo para PDFs y pizarras.'); status.setAttribute('role', 'status');
    const pdf = node('div'); pdf.id = 'study-workspace-pdf';
    const drawing = node('div'); drawing.id = 'study-workspace-drawing';
    workspace.append(toolbar, status, pdf, drawing); body.replaceChildren(workspace);
    pane.classList.add('study-workspace-pane'); pane.hidden = false;
    document.getElementById('secondary-pane-title').textContent = 'Estudio · PDF, nota y pizarra';
    document.getElementById('secondary-pane-viewmode').hidden = true;
    pane.querySelector('.secondary-pane-hint').hidden = true;
    document.querySelector('.container').classList.add('has-secondary'); document.getElementById('resizer-secondary').hidden = false;
    window.mdModes.setLayoutMode('focus'); window.mdCodeMirror.refresh();
  }
  await run(async () => {
    if (options.notePath) await showNote(options.notePath);
    if (options.pdfPath) await showPdf(options.pdfPath);
    else if (window.mdPdfHighlight.getState()) { checkModule('pdf'); await window.mdPdfHighlight.dock(workspace.querySelector('#study-workspace-pdf')); }
    if (options.drawingPath) await showDrawing(options.drawingPath);
  });
  return true;
}
window.mdStudyWorkspace = { open, close, isOpen: () => !!workspace, showPdf: (path) => run(() => showPdf(path)), showDrawing: (path) => run(() => showDrawing(path)) };
})();
