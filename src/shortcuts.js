(function () {
'use strict';
const L = window.mdShortcutLogic;
let bindings = L.defaults(), draft = { ...bindings }, saving = false;
const list = document.getElementById('shortcut-list');
const status = document.getElementById('shortcut-status');
function toggleOverlay(id, api) { document.getElementById(id).hidden ? api.open() : api.close(); }
const handlers = {
  new: () => window.mdTabs.newTab(), open: () => window.mdTabs.openViaDialog(), save: () => window.mdTabs.saveActive(false), saveAs: () => window.mdTabs.saveActive(true),
  closeTab: () => document.querySelector('#tabbar .tab.active .tab-close')?.click(), reopenTab: () => window.mdTabs.reopenClosed(), nextTab: () => window.mdTabs.cycleTab(1), previousTab: () => window.mdTabs.cycleTab(-1),
  quickOpen: () => toggleOverlay('file-open-panel', window.mdFileOpen), palette: () => toggleOverlay('command-palette', window.mdCommandPalette), find: () => window.mdFindReplace.open(),
  search: () => toggleOverlay('search-panel', window.mdSearch), sidebar: () => window.mdSidebarToggle.toggle(), focus: () => window.mdModes.toggleMode('focus'), read: () => window.mdModes.toggleMode('read'), live: () => window.mdModes.toggleMode('live'),
  fullscreen: async () => { const on = await window.mdEditor.toggleFullscreen(); document.body.classList.toggle('fullscreen-write', on); window.mdCodeMirror.refresh(); },
  settings: () => window.mdSettingsPanel.isOpen() ? window.mdSettingsPanel.close() : window.mdSettingsPanel.open(), home: () => document.getElementById('btn-home').click(),
  tags: () => document.getElementById('btn-tags').click(), backlinks: () => document.getElementById('btn-backlinks').click(), toc: () => document.getElementById('btn-toc').click(), daily: () => window.mdDailyNote.open()
};
function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
function contextual(event) {
  // La terminal y Excalidraw conservan sus teclas locales (guardar dibujo,
  // buscar en terminal, etc.). No capturar escritura ni atajos de esos editores.
  return event.target?.closest?.('#drawing-panel, #terminal-body, .pdfhighlight-modal');
}
window.addEventListener('keydown', (event) => {
  if (event.target?.closest?.('.ask-overlay')) return;
  const input = event.target?.closest?.('[data-shortcut]');
  if (input && list.contains(input)) {
    if (event.key === 'Tab' || event.key === 'Escape') return;
    consume(event);
    if (saving || event.repeat) return;
    if (['Backspace', 'Delete'].includes(event.key)) draft[input.dataset.shortcut] = '';
    else {
      const key = L.fromEvent(event);
      if (!key) { status.textContent = 'Pulsa Ctrl/Alt y una tecla, o una tecla F1–F12. AltGr y teclas de escritura no se asignan.'; return; }
      draft[input.dataset.shortcut] = key;
    }
    input.value = draft[input.dataset.shortcut] || 'Sin atajo'; status.textContent = L.validate(draft) || 'Cambio pendiente: pulsa Guardar atajos.'; return;
  }
  const key = L.fromEvent(event); if (!key) return;
  const action = L.actions.find((item) => bindings[item.id] === key);
  if (!action) return;
  if (contextual(event) && !['palette', 'home', 'fullscreen'].includes(action.id)) return;
  consume(event);
  if (event.repeat || (action.module && window.mdModules && !window.mdModules.isOn(action.module))) return;
  try { Promise.resolve(handlers[action.id]()).catch((error) => alert(error.message || 'No se pudo ejecutar el atajo.')); }
  catch (error) { alert(error.message || 'No se pudo ejecutar el atajo.'); }
}, true);
function render() {
  list.replaceChildren();
  for (const action of L.actions) {
    const row = document.createElement('div'); row.className = 'set-row'; row.dataset.keywords = `atajo teclado ${action.label}`;
    const text = document.createElement('div'); text.className = 'set-text';
    const label = document.createElement('label'); label.className = 'set-title'; label.textContent = action.label; label.htmlFor = `shortcut-${action.id}`; text.append(label);
    const control = document.createElement('div'); control.className = 'set-control';
    const input = document.createElement('input'); input.id = label.htmlFor; input.className = 'settings-text-input'; input.dataset.shortcut = action.id; input.readOnly = true; input.value = draft[action.id] || 'Sin atajo'; input.setAttribute('aria-label', `Atajo para ${action.label}`);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'toolbar-button'; reset.textContent = 'Predeterminado'; reset.setAttribute('aria-label', `Restaurar atajo de ${action.label}`);
    reset.addEventListener('click', () => { if (saving) return; draft[action.id] = action.key; input.value = action.key; status.textContent = L.validate(draft) || 'Cambio pendiente: pulsa Guardar atajos.'; });
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'toolbar-button'; clear.textContent = 'Quitar'; clear.setAttribute('aria-label', `Quitar atajo de ${action.label}`);
    clear.addEventListener('click', () => { if (saving) return; draft[action.id] = ''; input.value = 'Sin atajo'; status.textContent = L.validate(draft) || 'Cambio pendiente: pulsa Guardar atajos.'; });
    control.append(input, reset, clear); row.append(text, control); list.append(row);
  }
}
function updateHints() {
  window.mdModes?.refreshShortcutHints?.();
  const ids = { new: 'btn-new', open: 'btn-open', save: 'btn-save', saveAs: 'btn-save-as', sidebar: 'btn-toggle-sidebar', palette: 'btn-command-palette', search: 'btn-search', home: 'btn-home', tags: 'btn-tags', backlinks: 'btn-backlinks', toc: 'btn-toc', settings: 'btn-settings' };
  for (const action of L.actions) {
    const button = document.getElementById(ids[action.id]); if (!button) continue;
    button.title = `${action.label}${bindings[action.id] ? ` (${bindings[action.id]})` : ' (sin atajo)'}`;
    if (bindings[action.id]) button.setAttribute('aria-keyshortcuts', bindings[action.id].replace('Ctrl', 'Control')); else button.removeAttribute('aria-keyshortcuts');
  }
  const daily = document.querySelector('[data-section="notes"] .dailynote-settings')?.closest('.set-row')?.querySelector('.set-desc code');
  if (daily) daily.textContent = bindings.daily || 'Sin atajo';
}
async function save(next) {
  if (saving) return;
  const error = L.validate(next); if (error) { status.textContent = error; return; }
  const overrides = Object.fromEntries(L.actions.filter((a) => next[a.id] !== a.key).map((a) => [a.id, next[a.id]]));
  saving = true;
  document.querySelectorAll('[data-section="shortcuts"] button, [data-shortcut]').forEach((node) => { node.disabled = true; });
  try {
    await window.mdEditor.setConfig({ shortcuts: overrides });
    const stored = await window.mdEditor.getConfig();
    if (JSON.stringify(stored.shortcuts || {}) !== JSON.stringify(overrides)) throw new Error('No se confirmó el guardado. Reintenta antes de cerrar MK; los atajos anteriores siguen activos.');
    bindings = { ...next }; draft = { ...next }; updateHints(); render(); status.textContent = 'Atajos guardados y activos.';
  } catch (err) { status.textContent = err.message || 'No se pudieron guardar los atajos.'; }
  finally { saving = false; document.querySelectorAll('[data-section="shortcuts"] button, [data-shortcut]').forEach((node) => { node.disabled = false; }); }
}
document.getElementById('shortcut-apply').addEventListener('click', () => save({ ...draft }));
document.getElementById('shortcut-reset').addEventListener('click', () => save(L.defaults()));
document.getElementById('shortcut-discard').addEventListener('click', () => { if (saving) return; draft = { ...bindings }; render(); status.textContent = 'Cambios pendientes descartados.'; });
const ready = (async () => {
  try { const config = await window.mdEditor.getConfig(); const loaded = L.resolve(config.shortcuts); bindings = loaded.bindings; draft = { ...bindings }; status.textContent = loaded.error ? `${loaded.error} Se usan los predeterminados.` : ''; }
  catch { status.textContent = 'No se pudo leer la configuración. Se usan los predeterminados.'; }
  render(); updateHints();
})();
function ownsEvent(event) {
  const input = event.target?.closest?.('[data-shortcut]');
  if (input && list.contains(input)) return true;
  const key = L.fromEvent(event);
  return !!key && L.actions.some((action) => bindings[action.id] === key);
}
window.mdShortcuts = { ready, ownsEvent, getBindings: () => ({ ...bindings }) };
})();
