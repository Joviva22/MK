(function () {
'use strict';
let panel, engine, filePath = null, disk = null, current = '', clean = '', saving = false, opening = false;
let dockHost = null;
let docking = false;
let preserveDocument = false;
let initialized = false;
let feedback = '';
function dirty() { return current !== clean; }
function status(message) {
  if (message !== undefined) feedback = message;
  const node = panel?.querySelector('[role="status"]');
  const title = panel?.querySelector('.drawing-document-name');
  if (title) { title.textContent = filePath ? filePath.split(/[\\/]/).pop() : 'Pizarra nueva'; title.title = filePath || 'Elige una ubicación al guardar'; }
  if (node) {
    node.textContent = saving ? 'Guardando…' : !initialized ? 'Preparando pizarra…' :
      feedback ? `${feedback}${dirty() ? ' · Cambios sin guardar' : ''}` : dirty() ? 'Cambios sin guardar' : filePath ? 'Guardada' : 'Todavía no se ha guardado';
    node.dataset.state = saving ? 'saving' : dirty() ? 'pending' : filePath ? 'saved' : 'new';
  }
  panel?.setAttribute('aria-busy', String(saving || opening));
  panel?.querySelectorAll('.drawing-toolbar button').forEach((button) => {
    button.disabled = saving || opening || !initialized || (button.id === 'drawing-save' && !!filePath && !dirty());
  });
  const saveButton = panel?.querySelector('#drawing-save');
  if (saveButton) saveButton.textContent = saving ? 'Guardando…' : 'Guardar';
  if (filePath && !dockHost && !preserveDocument) window.mdTabs?.updateDrawing(filePath, dirty());
}
function close() {
  if (saving || (dirty() && !confirm('Hay cambios en la pizarra sin guardar. ¿Descartarlos y cerrar?'))) return false;
  const wasActive = panel && !dockHost && !preserveDocument && window.mdTabs?.getActiveState()?.kind === 'drawing';
  engine?.unmount(); engine = null; panel?.remove(); panel = null; dockHost = null; current = clean = '';
  if (filePath) window.mdTabs?.updateDrawing(filePath, false);
  if (wasActive) window.mdTabs.activatePreviousDocument();
  return true;
}
async function save(as = false) {
  if (!panel || saving || !initialized) return;
  saving = true;
  feedback = '';
  status();
  const snapshot = current;
  try {
    const result = await window.mdEditor.drawingSave({ content: snapshot, filePath, expected: disk, forceDialog: as });
    if (result?.error) throw new Error(result.error);
    if (result?.path) {
      const oldPath = filePath;
      filePath = result.path; disk = snapshot; clean = snapshot; feedback = 'Guardada';
      if (!dockHost && !preserveDocument) {
        if (oldPath) window.mdTabs?.updateTabPath(oldPath, filePath);
        window.mdTabs?.trackViewer(filePath, 'drawing');
        document.dispatchEvent(new CustomEvent('mk:active-file-changed'));
      }
      window.mdNoteAccess?.record(filePath);
      window.mdNotify.saved(filePath);
      document.dispatchEvent(new CustomEvent('mk:drawing-saved', { detail: { path: filePath } }));
    }
    else feedback = 'Guardado cancelado';
    status();
  } catch (error) { status(error.message); window.mdErrorToast.show({ message: 'No se pudo guardar la pizarra', detail: error.message, actionLabel: 'Volver a intentarlo', onAction: () => save(as) }); }
  finally { saving = false; status(); }
}
async function open(path = null, options = {}) {
  if (opening || saving) return false;
  opening = true;
  try { return await openScene(path, !!options.preserveDocument); } finally { opening = false; status(); }
}
async function openScene(path, keepDocument) {
  const host = dockHost;
  let initial = { elements: [], appState: {}, files: {} }, source = null;
  if (path) {
    const result = await window.mdEditor.drawingRead(path);
    if (!result || result.error) throw new Error(result?.error || 'No se pudo abrir la pizarra. Autoriza su carpeta o elige el archivo de nuevo.');
    source = result.content; initial = JSON.parse(source);
  }
  if (panel && !close()) return false;
  preserveDocument = keepDocument;
  window.EXCALIDRAW_ASSET_PATH = new window.URL('drawing-assets/', document.baseURI).href;
  if (!document.getElementById('drawing-css')) {
    const css = document.createElement('link'); css.id = 'drawing-css'; css.rel = 'stylesheet'; css.href = 'drawing-assets/index.css'; document.head.append(css);
  }
  await window.mdLoadLib('drawing');
  filePath = path; disk = source;
  current = clean = window.mdDrawingEngine.serialize(initial.elements, initial.appState || {}, initial.files || {});
  panel = document.createElement('section'); panel.id = 'drawing-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Pizarra Excalidraw');
  const toolbar = document.createElement('div'); toolbar.className = 'drawing-toolbar';
  const heading = document.createElement('div'); heading.className = 'drawing-heading';
  const name = document.createElement('span'); name.className = 'drawing-document-name';
  const info = document.createElement('span'); info.className = 'drawing-status'; info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite');
  heading.append(name, info); toolbar.appendChild(heading);
  const actions = document.createElement('div'); actions.className = 'drawing-file-actions'; toolbar.appendChild(actions);
  function button(id, label, hint, action, primary = false) {
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = `toolbar-button${primary ? ' set-primary' : ''}`;
    b.textContent = label; b.title = hint;
    b.addEventListener('click', () => Promise.resolve().then(action).catch((e) => status(e.message))); actions.append(b);
  }
  button('drawing-new', 'Nueva', 'Crear otra pizarra', () => open());
  button('drawing-open', 'Abrir…', 'Abrir una pizarra Excalidraw', async () => { const p = await window.mdEditor.openFile(); if (p) await open(p); });
  button('drawing-save', 'Guardar', 'Guardar esta pizarra (Ctrl+S)', () => save(), true);
  button('drawing-save-as', 'Guardar como…', 'Elegir otro nombre o ubicación (Ctrl+Shift+S)', () => save(true));
  button('drawing-close', 'Cerrar', 'Cerrar la pizarra', close);
  const canvas = document.createElement('div'); canvas.style.flex = '1'; canvas.style.minHeight = '0';
  panel.append(toolbar, canvas); document.body.append(panel);
  if (host) { dockHost = host; host.append(panel); panel.classList.add('drawing-study-docked'); panel.setAttribute('role', 'region'); }
  initialized = false;
  feedback = '';
  engine = window.mdDrawingEngine.mount(canvas, initial, (elements, appState, files) => {
    const next = window.mdDrawingEngine.serialize(elements, appState, files);
    if (next !== current) feedback = '';
    current = next;
    if (!initialized) { clean = current; initialized = true; }
    status();
  });
  panel.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); save(event.shiftKey); }
    else if (event.key === 'Escape' && event.target.closest('button')) close();
  });
  if (path) {
    window.mdNoteAccess?.record(path);
    if (!host && !docking && !preserveDocument) { window.mdTabs?.trackViewer(path, 'drawing'); document.dispatchEvent(new CustomEvent('mk:active-file-changed')); }
  }
  status(); return true;
}
window.addEventListener('beforeunload', (event) => { if (dirty() || saving) { event.preventDefault(); event.returnValue = false; } });
async function dock(host, path = filePath) {
  docking = true;
  try { if (!panel || path !== filePath) { if (!await open(path, { preserveDocument: true })) return false; } }
  finally { docking = false; }
  dockHost = host; host.append(panel); panel.classList.add('drawing-study-docked');
  panel.setAttribute('role', 'region');
  return true;
}
window.mdDrawing = { open, close, save, dock, getState: () => ({ filePath, dirty: dirty(), saving, opening, ready: !!panel && initialized, docked: !!dockHost }), getAPI: () => engine?.getAPI() };
})();
