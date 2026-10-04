(function () {
'use strict';
let panel, engine, filePath = null, disk = null, current = '', clean = '', saving = false, opening = false;
let dockHost = null;
function dirty() { return current !== clean; }
function status(message) {
  const node = panel?.querySelector('[role="status"]');
  if (node) node.textContent = message || `${filePath || 'Pizarra sin guardar'}${dirty() ? ' · Cambios sin guardar' : ''}`;
}
function close() {
  if (saving || (dirty() && !confirm('Hay cambios en la pizarra sin guardar. ¿Descartarlos y cerrar?'))) return false;
  engine?.unmount(); engine = null; panel?.remove(); panel = null; dockHost = null; current = clean = ''; return true;
}
async function save(as = false) {
  if (!panel || saving) return;
  saving = true;
  const snapshot = current;
  try {
    const result = await window.mdEditor.drawingSave({ content: snapshot, filePath, expected: disk, forceDialog: as });
    if (result?.error) throw new Error(result.error);
    if (result?.path) { filePath = result.path; disk = snapshot; clean = snapshot; document.dispatchEvent(new CustomEvent('mk:drawing-saved', { detail: { path: filePath } })); }
    status();
  } catch (error) { status(error.message); }
  finally { saving = false; }
}
async function open(path = null) {
  if (opening || saving) return false;
  opening = true;
  try { return await openScene(path); } finally { opening = false; }
}
async function openScene(path) {
  const host = dockHost;
  let initial = { elements: [], appState: {}, files: {} }, source = null;
  if (path) {
    const result = await window.mdEditor.drawingRead(path);
    if (!result || result.error) throw new Error(result?.error || 'No se pudo abrir la pizarra. Autoriza su carpeta o elige el archivo de nuevo.');
    source = result.content; initial = JSON.parse(source);
  }
  if (panel && !close()) return false;
  window.EXCALIDRAW_ASSET_PATH = new window.URL('drawing-assets/', document.baseURI).href;
  if (!document.getElementById('drawing-css')) {
    const css = document.createElement('link'); css.id = 'drawing-css'; css.rel = 'stylesheet'; css.href = 'drawing-assets/index.css'; document.head.append(css);
  }
  await window.mdLoadLib('drawing');
  filePath = path; disk = source;
  current = clean = window.mdDrawingEngine.serialize(initial.elements, initial.appState || {}, initial.files || {});
  panel = document.createElement('section'); panel.id = 'drawing-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Pizarra Excalidraw');
  Object.assign(panel.style, { position: 'fixed', inset: '20px', zIndex: '1200', background: 'var(--bg, white)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #888)' });
  const toolbar = document.createElement('div'); toolbar.style.padding = '8px';
  function button(label, action) { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', () => Promise.resolve().then(action).catch((e) => status(e.message))); toolbar.append(b); }
  button('Nueva', () => open());
  button('Abrir…', async () => { const p = await window.mdEditor.openFile(); if (p) await open(p); });
  button('Guardar', () => save()); button('Guardar como…', () => save(true)); button('Cerrar', close);
  const info = document.createElement('span'); info.setAttribute('role', 'status'); toolbar.append(info);
  const canvas = document.createElement('div'); canvas.style.flex = '1'; canvas.style.minHeight = '0';
  panel.append(toolbar, canvas); document.body.append(panel);
  if (host) { dockHost = host; host.append(panel); panel.classList.add('drawing-study-docked'); }
  let initialized = false;
  engine = window.mdDrawingEngine.mount(canvas, initial, (elements, appState, files) => {
    current = window.mdDrawingEngine.serialize(elements, appState, files);
    if (!initialized) { clean = current; initialized = true; }
    status();
  });
  panel.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); save(event.shiftKey); }
    else if (event.key === 'Escape' && event.target.closest('button')) close();
  });
  status(); return true;
}
window.addEventListener('beforeunload', (event) => { if (dirty() || saving) { event.preventDefault(); event.returnValue = false; } });
async function dock(host, path = filePath) {
  if (!panel || path !== filePath) { if (!await open(path)) return false; }
  dockHost = host; host.append(panel); panel.classList.add('drawing-study-docked');
  return true;
}
window.mdDrawing = { open, close, save, dock, getState: () => ({ filePath, dirty: dirty(), saving, opening, docked: !!dockHost }), getAPI: () => engine?.getAPI() };
})();
