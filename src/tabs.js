(function () {
'use strict';

const tabbarEl = document.getElementById('tabbar');
const tabCm = window.mdCodeMirror;

let tabs = [];
let activeId = null;
let nextId = 1;
let sessionTimer = null;

// Resaltado de sintaxis más allá de Markdown/LaTeX: código fuente en otros
// lenguajes se puede abrir y editar/guardar sin problema (es texto plano),
// pero sin esto CodeMirror lo intentaba resaltar como si fuera Markdown.
const MODE_BY_EXT = {
  tex: { mode: 'stex', label: 'LaTeX' },
  c: { mode: 'text/x-csrc', label: 'C' },
  h: { mode: 'text/x-csrc', label: 'C' },
  cpp: { mode: 'text/x-c++src', label: 'C++' },
  cc: { mode: 'text/x-c++src', label: 'C++' },
  cxx: { mode: 'text/x-c++src', label: 'C++' },
  hpp: { mode: 'text/x-c++src', label: 'C++' },
  java: { mode: 'text/x-java', label: 'Java' },
  py: { mode: 'python', label: 'Python' },
  sh: { mode: 'shell', label: 'Shell' },
  bash: { mode: 'shell', label: 'Shell' },
  zsh: { mode: 'shell', label: 'Zsh' },
  fish: { mode: 'shell', label: 'Fish' },
  // Estos cargan su modo recién al abrir el archivo (load: ver lazyload.js).
  js: { mode: 'javascript', label: 'JavaScript', load: 'javascript' },
  mjs: { mode: 'javascript', label: 'JavaScript', load: 'javascript' },
  cjs: { mode: 'javascript', label: 'JavaScript', load: 'javascript' },
  ts: { mode: 'text/typescript', label: 'TypeScript', load: 'javascript' },
  mts: { mode: 'text/typescript', label: 'TypeScript', load: 'javascript' },
  json: { mode: 'application/json', label: 'JSON', load: 'javascript' },
  rb: { mode: 'ruby', label: 'Ruby', load: 'ruby' },
  go: { mode: 'go', label: 'Go', load: 'go' },
  rs: { mode: 'rust', label: 'Rust', load: 'rust' },
  php: { mode: 'application/x-httpd-php', label: 'PHP', load: 'php' },
  pl: { mode: 'perl', label: 'Perl', load: 'perl' },
  pm: { mode: 'perl', label: 'Perl', load: 'perl' },
  lua: { mode: 'lua', label: 'Lua', load: 'lua' },
  r: { mode: 'r', label: 'R', load: 'r' },
  jl: { mode: 'julia', label: 'Julia', load: 'julia' },
  hs: { mode: 'haskell', label: 'Haskell', load: 'haskell' },
  dart: { mode: 'application/dart', label: 'Dart', load: 'dart' },
  swift: { mode: 'swift', label: 'Swift', load: 'swift' },
  kt: { mode: 'text/x-kotlin', label: 'Kotlin' },
  kts: { mode: 'text/x-kotlin', label: 'Kotlin' },
  cs: { mode: 'text/x-csharp', label: 'C#' },
  scala: { mode: 'text/x-scala', label: 'Scala' },
  sql: { mode: 'text/x-sql', label: 'SQL', load: 'sql' },
  ps1: { mode: 'powershell', label: 'PowerShell', load: 'powershell' },
  html: { mode: 'htmlmixed', label: 'HTML', load: 'htmlmixed' },
  htm: { mode: 'htmlmixed', label: 'HTML', load: 'htmlmixed' },
  css: { mode: 'css', label: 'CSS', load: 'css' },
  xml: { mode: 'xml', label: 'XML', load: 'xml' },
  yaml: { mode: 'yaml', label: 'YAML', load: 'yaml' },
  yml: { mode: 'yaml', label: 'YAML', load: 'yaml' },
  toml: { mode: 'toml', label: 'TOML', load: 'toml' }
};

// Carga el modo de un tipo de archivo si hace falta y repinta la pestaña.
// CodeMirror ignora setOption('mode') con el mismo valor, por eso se pasa
// primero por 'text/plain' (tab.modeStale: se repinta al activarla).
function ensureMode(tab, modeInfo) {
  if (window.mdCM6) return; // paquetes preparados: no invalidar el parser nativo
  if (!modeInfo.load || !window.mdLoadCmMode) return;
  window.mdLoadCmMode(modeInfo.load).then(() => {
    tab.modeStale = true;
    if (tab.id === activeId) refreshMode(tab);
  }).catch(() => {});
}

function refreshMode(tab) {
  if (!tab.modeStale) return;
  tab.modeStale = false;
  tabCm.setOption('mode', 'text/plain');
  tabCm.setOption('mode', tab.mode);
}

function modeInfoForPath(filePath) {
  const base = filePath ? filePath.split(/[\\/]/).pop() : '';
  if (/^(GNU)?makefile$/i.test(base)) return { mode: 'text/plain', label: 'Makefile' };
  const ext = filePath ? filePath.split('.').pop().toLowerCase() : '';
  return MODE_BY_EXT[ext] || { mode: 'markdown', label: 'Markdown' };
}

// Código fuente (no LaTeX/Markdown): el preview de MK renderiza Markdown,
// que no tiene sentido para estos archivos (los "#" de los comentarios se
// leían como encabezados, etc.) — ver preview.js, ahí se usa esto para no
// renderizar nada y darle todo el ancho al editor.
const CODE_MODES = new Set(Object.values(MODE_BY_EXT).map((m) => m.mode).filter((m) => m !== 'stex').concat('text/plain'));

function isActiveTabCode() {
  const tab = tabs.find((t) => t.id === activeId);
  return !!tab && CODE_MODES.has(tab.mode);
}

function labelFor(tab) {
  return tab.filePath ? tab.filePath.split(/[\\/]/).pop() : 'Sin título';
}

// diskContent: lo que había en disco la última vez que la pestaña se cargó
// o se guardó. Sirve para detectar que el archivo cambió FUERA de esta
// pestaña (otro programa, git, el Home/Kanban escribiendo el archivo, u otra
// copia de MK): antes una pestaña con contenido viejo lo pisaba al guardar.
function createTab(filePath, content, diskContent) {
  const modeInfo = modeInfoForPath(filePath);
  const doc = new CodeMirror.Doc(content, modeInfo.mode);
  const tab = {
    id: nextId++, filePath, doc, mode: modeInfo.mode, modeLabel: modeInfo.label, modified: false, autosaveTimer: null,
    diskContent: diskContent !== undefined ? diskContent : (filePath ? content : null),
    conflict: false
  };
  tabs.push(tab);
  ensureMode(tab, modeInfo);
  return tab;
}

let suppressChange = false; // recargas desde disco: no cuentan como edición

async function readDisk(tab) {
  if (!tab.filePath) return null;
  const r = await window.mdEditor.readFile(tab.filePath);
  return r && !r.binary ? r.content : null;
}

function replaceContent(tab, text) {
  const cursor = tab.doc.getCursor();
  suppressChange = true;
  try {
    tab.doc.setValue(text);
  } finally {
    suppressChange = false;
  }
  tab.doc.setCursor(cursor);
  if (tab.id === activeId && window.renderPreview) window.renderPreview();
}

// El archivo cambió afuera: sin cambios propios → se recarga solo; con
// cambios propios → queda marcado ⚠ (y el autoguardado no lo pisa).
async function syncWithDisk(tab) {
  if (!tab || !tab.filePath || tab.diskContent == null) return;
  const disk = await readDisk(tab);
  if (disk === null || disk === tab.diskContent) return;
  if (!tab.modified) {
    replaceContent(tab, disk);
    tab.diskContent = disk;
    tab.conflict = false;
  } else {
    tab.conflict = true;
  }
  renderTabbar();
  persistSession();
}

async function diskChangedSince(tab) {
  if (!tab.filePath || tab.diskContent == null) return false;
  const disk = await readDisk(tab);
  return disk !== null && disk !== tab.diskContent;
}

// Lectores de pantalla y teclado: pestañas con role="tab"; ←/→ cambian de
// pestaña, Supr la cierra (el foco va a la pestaña activa con Tab).
tabbarEl.setAttribute('role', 'tablist');
tabbarEl.setAttribute('aria-label', 'Archivos abiertos');
tabbarEl.addEventListener('keydown', (e) => {
  const idx = tabs.findIndex((t) => t.id === activeId);
  if (idx < 0) return;
  let next = null;
  if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length];
  else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length];
  else if (e.key === 'Home') next = tabs[0];
  else if (e.key === 'End') next = tabs[tabs.length - 1];
  else if (e.key === 'Delete') { e.preventDefault(); closeTab(activeId); }
  if (next) {
    e.preventDefault();
    activateTab(next.id);
    const el = tabbarEl.querySelector('.tab.active');
    if (el) el.focus();
  }
});

function renderTabbar() {
  const hadFocus = tabbarEl.contains(document.activeElement);
  tabbarEl.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeId ? ' active' : '') + (tab.conflict ? ' tab-conflict' : '');
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(tab.id === activeId));
    el.tabIndex = tab.id === activeId ? 0 : -1;
    el.title = tab.conflict
      ? `${tab.filePath}\n⚠ Cambió fuera de MK mientras tenías cambios sin guardar: el autoguardado está en pausa. Guardá (Ctrl+S) para elegir qué versión queda.`
      : (tab.filePath || 'Sin título');

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = (tab.conflict ? '⚠ ' : '') + labelFor(tab) + (tab.modified ? ' ●' : '');
    el.appendChild(label);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('role', 'button');
    closeBtn.setAttribute('aria-label', `Cerrar ${labelFor(tab)}`);
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener('click', () => activateTab(tab.id));
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabMenu(e.clientX, e.clientY, tab);
    });
    tabbarEl.appendChild(el);
  }
  if (hadFocus) {
    const active = tabbarEl.querySelector('.tab.active');
    if (active) active.focus();
  }
}

function activateTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  const started = window.performance.now();
  activeId = id;
  window.mdState.currentFilePath = tab.filePath;
  tabCm.swapDoc(tab.doc);
  const currentMode = tabCm.getOption('mode');
  const liveMarkdown = tab.mode === 'markdown' && currentMode?.name === 'markdown' && window.mdLivePreview?.isEnabled();
  if (currentMode !== tab.mode && !liveMarkdown) tabCm.setOption('mode', tab.mode);
  const editorReady = window.performance.now();
  refreshMode(tab);
  window.mdState.currentFilePath = tab.filePath;
  window.mdStatusMode.textContent = tab.modeLabel;
  if (window.mdModes) window.mdModes.releasePdfForcedReadMode();
  renderTabbar();
  if (window.mdPreview?.requestRender) window.mdPreview.requestRender();
  else if (window.renderPreview) window.renderPreview();
  const previewReady = window.performance.now();
  persistSession();
  syncWithDisk(tab);
  document.dispatchEvent(new CustomEvent('mk:active-file-changed'));
  lastActivationTimings = { editor: editorReady - started, uiAndPreview: previewReady - editorReady, total: previewReady - started };
}

let lastActivationTimings = null;
let lastOpenTimings = null;

function markModified(id, value) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || tab.modified === value) return;
  tab.modified = value;
  renderTabbar();
  // El sidebar marca con un punto los archivos con cambios sin guardar.
  document.dispatchEvent(new CustomEvent('mk:modified-changed'));
}

function getModifiedPaths() {
  return tabs.filter((t) => t.modified && t.filePath).map((t) => t.filePath);
}

function findTabByPath(filePath) {
  return tabs.find((t) => t.filePath && t.filePath === filePath);
}

function newTab(content) {
  const tab = createTab(null, content != null ? content : '# Nuevo documento\n\nEscribe aquí tu Markdown...\n');
  activateTab(tab.id);
}

async function openTab(filePath) {
  if (/\.excalidraw$/i.test(filePath)) return window.mdDrawing.open(filePath);
  const started = window.performance.now();
  const existing = findTabByPath(filePath);
  if (existing) {
    activateTab(existing.id);
    return;
  }
  // .docx no es texto plano (es un .zip con XML adentro) — se convierte a
  // Markdown (mammoth + turndown, ver docximport.js) en vez de pasar por
  // el camino normal de abajo, que lo detectaría como binario.
  if (/\.docx$/i.test(filePath)) {
    await window.mdDocxImport.openAsMarkdown(filePath);
    return;
  }
  const result = await window.mdEditor.readFile(filePath);
  const readReady = window.performance.now();
  if (result === null) return;
  if (result.binary) {
    // No se abre como pestaña real de ese archivo (filePath: null) para que
    // "Guardar" no pueda pisar el binario original con este aviso — a lo
    // sumo pide "Guardar como" si alguien igual le da a guardar.
    const name = filePath.split(/[\\/]/).pop();
    const tab = createTab(
      null,
      `No se puede editar "${name}": formato desconocido o binario.\n\nEste archivo no se abrió — lo que escribas acá no lo va a sobreescribir. Si es una imagen, hacé clic en ella desde el árbol de la izquierda para verla.`
    );
    activateTab(tab.id);
    return;
  }
  const tab = createTab(filePath, result.content, result.content);
  const docReady = window.performance.now();
  activateTab(tab.id);
  lastOpenTimings = { read: readReady - started, createDoc: docReady - readReady, activate: window.performance.now() - docReady, activation: lastActivationTimings };
}

async function openViaDialog() {
  const filePath = await window.mdEditor.openFile();
  if (!filePath) return;
  await openTab(filePath);
}

let savingActive = false;

function chooseConflict(tab, disk) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay conflict-overlay';
    const box = document.createElement('div');
    box.className = 'modal conflict-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'conflict-title');
    const heading = document.createElement('h2');
    heading.id = 'conflict-title';
    heading.textContent = `Conflicto en ${labelFor(tab)}`;
    const description = document.createElement('p');
    description.textContent = 'El archivo cambió fuera de MK. Compara las versiones antes de decidir. Conservar ambas abre tus cambios como una copia sin guardar y mantiene el archivo del disco.';
    const versions = document.createElement('div');
    versions.className = 'conflict-versions';
    for (const [title, text] of [['Versión del disco', disk], ['Tus cambios', tab.doc.getValue()]]) {
      const section = document.createElement('section');
      const label = document.createElement('h3');
      label.textContent = title;
      const pre = document.createElement('pre');
      pre.tabIndex = 0;
      pre.setAttribute('aria-label', title);
      pre.textContent = text.length > 100000 ? text.slice(0, 100000) + '\n… Vista limitada a 100.000 caracteres; la versión completa se conserva.' : text;
      section.append(label, pre);
      versions.appendChild(section);
    }
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    function finish(action) {
      overlay.remove();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      resolve(action);
    }
    for (const [action, label] of [['cancel', 'Cancelar'], ['reload', 'Usar disco'], ['overwrite', 'Sobrescribir disco'], ['keep', 'Conservar ambas']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toolbar-button';
      button.dataset.conflictAction = action;
      button.textContent = label;
      button.addEventListener('click', () => finish(action));
      actions.appendChild(button);
    }
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish('cancel'); }
      if (e.key !== 'Tab') e.stopPropagation();
    });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) finish('cancel'); });
    box.append(heading, description, versions, actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    actions.firstElementChild.focus();
  });
}

async function saveActive(forceDialog = false) {
  if (savingActive) return;
  savingActive = true;
  try {
    await saveActiveOnce(forceDialog);
  } finally {
    savingActive = false;
  }
}

async function saveActiveOnce(forceDialog = false) {
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return;
  clearTimeout(tab.autosaveTimer);
  if (!forceDialog && await diskChangedSince(tab)) {
    tab.conflict = true;
    renderTabbar();
    let disk = await readDisk(tab);
    if (disk === null) return;
    const action = await chooseConflict(tab, disk);
    if (action === 'cancel') return;
    if (action === 'reload' || action === 'keep') {
      disk = await readDisk(tab);
      if (disk === null) return; // no descartar cambios si ahora no se puede leer
      let copy;
      if (action === 'keep') {
        copy = createTab(null, tab.doc.getValue());
        markModified(copy.id, true);
      }
      if (disk !== null) {
        replaceContent(tab, disk);
        tab.diskContent = disk;
        tab.conflict = false;
        markModified(tab.id, false);
        renderTabbar();
      }
      if (copy) activateTab(copy.id);
      persistSession();
      return;
    }
    // No sobrescribir cambios nuevos que llegaron mientras se comparaba.
    if (await readDisk(tab) !== disk) {
      alert('El archivo volvió a cambiar mientras comparabas. Guarda otra vez para revisar la nueva versión.');
      return;
    }
  }
  const content = tab.doc.getValue();
  const filePath = await window.mdEditor.saveFile(content, tab.filePath, forceDialog);
  if (!filePath) return;
  tab.diskContent = content;
  tab.conflict = false;
  tab.filePath = filePath;
  const modeInfo = modeInfoForPath(filePath);
  tab.mode = modeInfo.mode;
  tab.modeLabel = modeInfo.label;
  if (tab.id === activeId) tabCm.setOption('mode', tab.mode);
  ensureMode(tab, modeInfo); // "Guardar como" con otra extensión
  if (tab.id === activeId) {
    window.mdState.currentFilePath = filePath;
    window.mdStatusMode.textContent = tab.modeLabel;
  }
  markModified(tab.id, tab.doc.getValue() !== content);
  persistSession();
  // Guardado a mano: un destello sutil en la pestaña confirma que se guardó.
  const activeTabEl = document.querySelector('#tabbar .tab.active');
  if (activeTabEl) {
    activeTabEl.classList.add('tab-saved-flash');
    setTimeout(() => activeTabEl.classList.remove('tab-saved-flash'), 800);
  }

  // Sync con git: solo en guardado manual (no en cada tick de autoguardado,
  // para no llenar el historial de commits) y solo si está prendido.
  if (window.mdGetGitSyncEnabled && window.mdGetGitSyncEnabled() && window.mdState.rootFolder) {
    window.mdEditor.gitSync(window.mdState.rootFolder);
  }
}

// Pestañas cerradas, para reabrirlas (Ctrl+Alt+W, menú de pestañas,
// paleta): la ruta y dónde estaba el cursor; las "Sin título" con texto
// guardan el texto (si no, se perdería al cerrarlas).
const CLOSED_MAX = 20;
const DEFAULT_NEW_TEXT = '# Nuevo documento\n\nEscribe aquí tu Markdown...\n';
let closedTabs = [];

function rememberClosed(tab) {
  const content = tab.filePath ? null : tab.doc.getValue();
  if (!tab.filePath && (!content.trim() || content === DEFAULT_NEW_TEXT)) return;
  closedTabs = closedTabs.filter((c) => !c.filePath || c.filePath !== tab.filePath);
  closedTabs.push({ filePath: tab.filePath, content, cursor: tab.doc.getCursor() });
  if (closedTabs.length > CLOSED_MAX) closedTabs.shift();
}

async function reopenClosed() {
  while (closedTabs.length) {
    const c = closedTabs.pop();
    if (c.filePath) {
      if (findTabByPath(c.filePath)) continue;
      await openTab(c.filePath);
      const tab = findTabByPath(c.filePath);
      if (!tab) continue; // ya no existe: la anterior
      tab.doc.setCursor(c.cursor);
      tabCm.scrollIntoView(null, 120);
    } else {
      const tab = createTab(null, c.content);
      tab.doc.setCursor(c.cursor);
      markModified(tab.id, true);
      activateTab(tab.id);
    }
    return true;
  }
  return false;
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const tab = tabs[idx];
  if (tab.modified && !confirm(`"${labelFor(tab)}" tiene cambios sin guardar. ¿Cerrar de todas formas?`)) {
    return;
  }
  clearTimeout(tab.autosaveTimer);
  rememberClosed(tab);
  tabs.splice(idx, 1);
  if (tabs.length === 0) {
    createTab(null, '');
  }
  if (activeId === id) {
    const next = tabs[idx] || tabs[idx - 1] || tabs[0];
    activateTab(next.id);
  } else {
    renderTabbar();
    persistSession();
  }
}

// Cerrar varias de una (menú contextual de la pestaña): una sola pregunta si
// alguna tiene cambios sin guardar, en vez de una por pestaña.
function closeTabs(ids) {
  const targets = tabs.filter((t) => ids.includes(t.id));
  if (!targets.length) return;
  const unsaved = targets.filter((t) => t.modified);
  if (unsaved.length) {
    const names = unsaved.slice(0, 5).map((t) => `• ${labelFor(t)}`).join('\n') + (unsaved.length > 5 ? '\n…' : '');
    if (!confirm(`${unsaved.length} pestaña(s) tienen cambios sin guardar:\n${names}\n\n¿Cerrarlas igual (se pierden esos cambios)?`)) return;
  }
  targets.forEach((t) => { clearTimeout(t.autosaveTimer); rememberClosed(t); });
  const activeClosing = ids.includes(activeId);
  const activeIdx = tabs.findIndex((t) => t.id === activeId);
  tabs = tabs.filter((t) => !ids.includes(t.id));
  if (!tabs.length) createTab(null, '');
  if (activeClosing) {
    // La más cercana a la que estaba activa entre las que quedan.
    activateTab((tabs[Math.min(activeIdx, tabs.length - 1)] || tabs[0]).id);
  } else {
    renderTabbar();
    persistSession();
  }
}

let tabMenuEl = null;

function hideTabMenu() {
  if (tabMenuEl) tabMenuEl.hidden = true;
}

function showTabMenu(x, y, tab) {
  if (!tabMenuEl) {
    tabMenuEl = document.createElement('div');
    tabMenuEl.className = 'context-menu tab-menu';
    tabMenuEl.hidden = true;
    document.body.appendChild(tabMenuEl);
    document.addEventListener('mousedown', (e) => { if (tabMenuEl && !tabMenuEl.contains(e.target)) hideTabMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTabMenu(); });
  }
  tabMenuEl.innerHTML = '';
  const idx = tabs.findIndex((t) => t.id === tab.id);
  const add = (label, fn, disabled) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', () => { hideTabMenu(); fn(); });
    tabMenuEl.appendChild(b);
  };
  add('Cerrar', () => closeTab(tab.id));
  add('Cerrar las otras', () => closeTabs(tabs.filter((t) => t.id !== tab.id).map((t) => t.id)), tabs.length < 2);
  add('Cerrar las de la derecha', () => closeTabs(tabs.slice(idx + 1).map((t) => t.id)), idx === tabs.length - 1);
  add('Cerrar las guardadas', () => closeTabs(tabs.filter((t) => !t.modified).map((t) => t.id)), !tabs.some((t) => !t.modified));
  add('Cerrar todas', () => closeTabs(tabs.map((t) => t.id)));
  add('Reabrir la cerrada  (Ctrl+Alt+W)', () => reopenClosed(), !closedTabs.length);
  if (tab.filePath) add('Copiar ruta', () => window.mdEditor.clipboardWriteText(tab.filePath));
  tabMenuEl.hidden = false;
  const rect = tabMenuEl.getBoundingClientRect();
  tabMenuEl.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`;
  tabMenuEl.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`;
}

// Igual que closeTab pero sin confirmar ni bloquear: usada al "descartar" en
// el diálogo de recuperación de sesión (ahí ya se decidió tirar los cambios).
function closeTabSilently(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  clearTimeout(tabs[idx].autosaveTimer);
  tabs.splice(idx, 1);
  if (tabs.length === 0) createTab(null, '');
  if (activeId === id) {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    activateTab(next.id);
  }
}

function cycleTab(delta) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeId);
  const next = tabs[(idx + delta + tabs.length) % tabs.length];
  activateTab(next.id);
}

// Autoguardado: por pestaña (no por "la pestaña activa"), así si el usuario
// cambia de tab antes de que salte el debounce, no escribe en el archivo equivocado.
function scheduleAutosave(tab) {
  clearTimeout(tab.autosaveTimer);
  const interval = window.mdGetAutosaveInterval ? window.mdGetAutosaveInterval() : 1500;
  if (!interval) return;
  tab.autosaveTimer = setTimeout(async () => {
    if (!tab.filePath || !tab.modified || tab.conflict) return;
    if (await diskChangedSince(tab)) {
      // Nunca pisar en silencio una versión más nueva del disco.
      tab.conflict = true;
      renderTabbar();
      return;
    }
    const content = tab.doc.getValue();
    const savedPath = await window.mdEditor.saveFile(content, tab.filePath, false);
    if (savedPath) {
      tab.diskContent = content;
      markModified(tab.id, false);
      persistSession();
    }
  }, interval);
}

// Snapshot de sesión (todas las pestañas, con o sin ruta) para recuperar
// tras un cierre inesperado o simplemente restaurar al reabrir la app.
function persistSession() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    const data = {
      activeIndex: tabs.findIndex((t) => t.id === activeId),
      tabs: tabs.map((t) => ({ filePath: t.filePath, content: t.doc.getValue(), modified: t.modified }))
    };
    window.mdEditor.saveSession(data);
  }, 300);
}

tabCm.on('change', () => {
  if (suppressChange) return;
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return;
  markModified(tab.id, true);
  scheduleAutosave(tab);
  persistSession();
});

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (window.mdShortcuts) return;
  if (!ctrl) return;
  if (e.altKey && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    reopenClosed();
  } else if (e.key.toLowerCase() === 'w') {
    e.preventDefault();
    if (activeId != null) closeTab(activeId);
  } else if (e.key === 'Tab') {
    e.preventDefault();
    cycleTab(e.shiftKey ? -1 : 1);
  }
});

// Estado liviano de la pestaña activa (barra de estado): sin copiar el texto.
function getActiveState() {
  const tab = tabs.find((t) => t.id === activeId);
  return tab ? { filePath: tab.filePath, modified: tab.modified, conflict: !!tab.conflict } : null;
}

function getActiveTabInfo() {
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return null;
  return { filePath: tab.filePath, modified: tab.modified, content: tab.doc.getValue() };
}

function showRestoreDialog(unsavedTabs) {
  const overlay = document.getElementById('restore-dialog');
  const list = document.getElementById('restore-file-list');
  list.innerHTML = '';
  unsavedTabs.forEach((t) => {
    const li = document.createElement('li');
    li.textContent = labelFor(t);
    list.appendChild(li);
  });
  overlay.hidden = false;

  document.getElementById('btn-restore-keep').onclick = () => {
    overlay.hidden = true;
  };

  document.getElementById('btn-restore-discard').onclick = async () => {
    overlay.hidden = true;
    for (const t of unsavedTabs) {
      if (t.filePath) {
        const result = await window.mdEditor.readFile(t.filePath);
        if (result !== null && !result.binary) {
          t.doc.setValue(result.content);
          t.modified = false;
        }
      } else {
        closeTabSilently(t.id);
      }
    }
    renderTabbar();
    if (window.renderPreview) window.renderPreview();
    persistSession();
  };
}

// Si el archivo de una pestaña ya abierta se renombra/mueve desde el
// sidebar, actualiza esa pestaña para que "Guardar" siga escribiendo en el
// lugar correcto en vez de resucitar el archivo en su ruta vieja.
function updateTabPath(oldPath, newPath) {
  const tab = tabs.find((t) => t.filePath === oldPath);
  if (!tab) return;
  tab.filePath = newPath;
  const modeInfo = modeInfoForPath(newPath);
  tab.mode = modeInfo.mode;
  tab.modeLabel = modeInfo.label;
  if (tab.id === activeId) {
    tabCm.setOption('mode', tab.mode);
    window.mdState.currentFilePath = newPath;
    window.mdStatusMode.textContent = tab.modeLabel;
  }
  renderTabbar();
  persistSession();
}

// Volver a la ventana (por ejemplo después de editar en otro programa o
// hacer git pull): revisar si el archivo activo cambió afuera.
window.addEventListener('focus', () => syncWithDisk(tabs.find((t) => t.id === activeId)));

// Carpeta movida/renombrada desde el sidebar: todas las pestañas de archivos
// que estaban adentro pasan a la ruta nueva.
function updateTabPathsUnder(oldDir, newDir) {
  tabs.filter((t) => t.filePath && t.filePath.startsWith(oldDir + '/'))
    .forEach((t) => updateTabPath(t.filePath, newDir + t.filePath.slice(oldDir.length)));
}

// Archivos que cambiaron en disco (aviso de folderwatch.js): recargar las
// pestañas que los tienen abiertos.
function syncPaths(paths) {
  const changed = new Set(paths);
  tabs.filter((t) => t.filePath && changed.has(t.filePath)).forEach((t) => syncWithDisk(t));
}

window.mdTabs = { reopenClosed, closedCount: () => closedTabs.length, getActiveState, getModifiedPaths, syncPaths, newTab, openTab, openViaDialog, saveActive, closeTab, closeTabs, updateTabPathsUnder, cycleTab, getActiveTabInfo, updateTabPath, isActiveTabCode, syncActiveWithDisk: () => syncWithDisk(tabs.find((t) => t.id === activeId)) };
window.mdTabs.timings = () => lastOpenTimings ? JSON.parse(JSON.stringify(lastOpenTimings)) : null;
window.openFileAtPath = openTab;

window.mdEditor.onOpenExternalFile((filePath) => openTab(filePath));

(async () => {
  const session = await window.mdEditor.loadSession();
  if (session && Array.isArray(session.tabs) && session.tabs.length) {
    for (const t of session.tabs) {
      // La sesión guarda el contenido de cada pestaña: si mientras tanto el
      // archivo cambió en disco y la pestaña no tenía cambios propios, manda
      // el disco (antes se restauraba la versión vieja y el siguiente
      // guardado pisaba la nueva).
      let content = t.content;
      let disk;
      if (t.filePath) {
        const r = await window.mdEditor.readFile(t.filePath);
        disk = r && !r.binary ? r.content : null;
        if (disk !== null && !t.modified && disk !== t.content) content = disk;
      }
      const tab = createTab(t.filePath, content, t.filePath ? (disk != null ? disk : t.content) : null);
      tab.modified = !!t.modified;
    }
    const idx = Math.min(Math.max(session.activeIndex || 0, 0), tabs.length - 1);
    activateTab(tabs[idx].id);

    const unsavedTabs = tabs.filter((t) => t.modified);
    if (unsavedTabs.length) showRestoreDialog(unsavedTabs);
  } else {
    newTab();
  }
})();

})();
