(function () {
'use strict';

const tabbarEl = document.getElementById('tabbar');
const tabCm = window.mdCodeMirror;

let tabs = [];
let activeId = null;
let nextId = 1;
let sessionTimer = null;

function modeForPath(filePath) {
  return filePath && /\.tex$/i.test(filePath) ? 'stex' : 'markdown';
}

function labelFor(tab) {
  return tab.filePath ? tab.filePath.split(/[\\/]/).pop() : 'Sin título';
}

function createTab(filePath, content) {
  const mode = modeForPath(filePath);
  const doc = new CodeMirror.Doc(content, mode);
  const tab = { id: nextId++, filePath, doc, mode, modified: false, autosaveTimer: null };
  tabs.push(tab);
  return tab;
}

function renderTabbar() {
  tabbarEl.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeId ? ' active' : '');
    el.title = tab.filePath || 'Sin título';

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = labelFor(tab) + (tab.modified ? ' ●' : '');
    el.appendChild(label);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener('click', () => activateTab(tab.id));
    tabbarEl.appendChild(el);
  }
}

function activateTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  activeId = id;
  tabCm.swapDoc(tab.doc);
  tabCm.setOption('mode', tab.mode);
  window.mdState.currentFilePath = tab.filePath;
  window.mdStatusMode.textContent = tab.mode === 'stex' ? 'LaTeX' : 'Markdown';
  renderTabbar();
  if (window.renderPreview) window.renderPreview();
  persistSession();
}

function markModified(id, value) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || tab.modified === value) return;
  tab.modified = value;
  renderTabbar();
}

function findTabByPath(filePath) {
  return tabs.find((t) => t.filePath && t.filePath === filePath);
}

function newTab(content) {
  const tab = createTab(null, content != null ? content : '# Nuevo documento\n\nEscribe aquí tu Markdown...\n');
  activateTab(tab.id);
}

async function openTab(filePath) {
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
  const tab = createTab(filePath, result.content);
  activateTab(tab.id);
}

async function openViaDialog() {
  const filePath = await window.mdEditor.openFile();
  if (!filePath) return;
  await openTab(filePath);
}

async function saveActive(forceDialog = false) {
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return;
  clearTimeout(tab.autosaveTimer);
  const content = tab.doc.getValue();
  const filePath = await window.mdEditor.saveFile(content, tab.filePath, forceDialog);
  if (!filePath) return;
  tab.filePath = filePath;
  tab.mode = modeForPath(filePath);
  tabCm.setOption('mode', tab.mode);
  window.mdState.currentFilePath = filePath;
  window.mdStatusMode.textContent = tab.mode === 'stex' ? 'LaTeX' : 'Markdown';
  markModified(tab.id, false);
  persistSession();

  // Sync con git: solo en guardado manual (no en cada tick de autoguardado,
  // para no llenar el historial de commits) y solo si está prendido.
  if (window.mdGetGitSyncEnabled && window.mdGetGitSyncEnabled() && window.mdState.rootFolder) {
    window.mdEditor.gitSync(window.mdState.rootFolder);
  }
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const tab = tabs[idx];
  if (tab.modified && !confirm(`"${labelFor(tab)}" tiene cambios sin guardar. ¿Cerrar de todas formas?`)) {
    return;
  }
  clearTimeout(tab.autosaveTimer);
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
    if (!tab.filePath || !tab.modified) return;
    const content = tab.doc.getValue();
    const savedPath = await window.mdEditor.saveFile(content, tab.filePath, false);
    if (savedPath) {
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
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return;
  markModified(tab.id, true);
  scheduleAutosave(tab);
  persistSession();
});

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;
  if (e.key.toLowerCase() === 'w') {
    e.preventDefault();
    if (activeId != null) closeTab(activeId);
  } else if (e.key === 'Tab') {
    e.preventDefault();
    cycleTab(e.shiftKey ? -1 : 1);
  }
});

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
  tab.mode = modeForPath(newPath);
  if (tab.id === activeId) {
    tabCm.setOption('mode', tab.mode);
    window.mdState.currentFilePath = newPath;
    window.mdStatusMode.textContent = tab.mode === 'stex' ? 'LaTeX' : 'Markdown';
  }
  renderTabbar();
  persistSession();
}

window.mdTabs = { newTab, openTab, openViaDialog, saveActive, closeTab, cycleTab, getActiveTabInfo, updateTabPath };
window.openFileAtPath = openTab;

window.mdEditor.onOpenExternalFile((filePath) => openTab(filePath));

(async () => {
  const session = await window.mdEditor.loadSession();
  if (session && Array.isArray(session.tabs) && session.tabs.length) {
    for (const t of session.tabs) {
      const tab = createTab(t.filePath, t.content);
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
