(function (root) {
'use strict';
const actions = [
  ['new', 'Nuevo documento', 'Ctrl+N'], ['open', 'Abrir archivo', 'Ctrl+O'], ['save', 'Guardar', 'Ctrl+S'], ['saveAs', 'Guardar como', 'Ctrl+Shift+S'],
  ['closeTab', 'Cerrar pestaña', 'Ctrl+W'], ['reopenTab', 'Reabrir pestaña cerrada', 'Ctrl+Alt+W'], ['nextTab', 'Pestaña siguiente', 'Ctrl+Tab'], ['previousTab', 'Pestaña anterior', 'Ctrl+Shift+Tab'],
  ['quickOpen', 'Abrir nota por nombre', 'Ctrl+P'], ['palette', 'Paleta de comandos', 'Ctrl+Shift+P'], ['find', 'Buscar en el documento', 'Ctrl+F'], ['search', 'Búsqueda global', 'Ctrl+Shift+F'],
  ['sidebar', 'Mostrar u ocultar sidebar', 'Ctrl+B'], ['focus', 'Modo enfoque', 'Ctrl+Shift+E'], ['read', 'Modo lectura', 'Ctrl+Shift+R'], ['live', 'Live Preview', 'Ctrl+Shift+L'],
  ['fullscreen', 'Pantalla completa', 'F11'], ['settings', 'Abrir o cerrar Ajustes', 'Ctrl+,'], ['home', 'Home', 'Ctrl+Shift+H', 'home'],
  ['tags', 'Etiquetas', 'Ctrl+Shift+T', 'links'], ['backlinks', 'Backlinks', 'Ctrl+Shift+B', 'links'], ['toc', 'Índice del documento', 'Ctrl+Shift+O'], ['daily', 'Nota diaria', 'Ctrl+Shift+D']
].map(([id, label, key, module]) => ({ id, label, key, module }));
const reserved = new Set(['Ctrl+Q', 'Ctrl+A', 'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+D', 'Ctrl+I', 'Ctrl+U', 'Ctrl+K', 'Ctrl+L', 'Ctrl+E', 'Ctrl+H', 'Ctrl+T', 'Ctrl+M', 'Ctrl+Alt+H', 'Alt+L', 'Alt+U', 'Ctrl+Shift+U', 'Ctrl+Shift+Z', 'Ctrl+Shift+C', 'Ctrl+Shift+V', 'Ctrl+Shift+K', 'Ctrl+Shift+M', 'Ctrl+Shift+5', 'Ctrl+Space', 'Ctrl+=', 'Ctrl+-', 'Ctrl+0', 'Ctrl+`', 'Ctrl+Ñ', 'F5']);
function normalize(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || value.length > 80) return null;
  const parts = value.trim().split('+').map((part) => part.trim());
  const modifiers = new Set(); let key = null;
  for (const part of parts) {
    const lower = part.toLowerCase();
    const modifier = ['ctrl', 'control', 'cmd', 'meta', 'mod'].includes(lower) ? 'Ctrl' : lower === 'alt' ? 'Alt' : lower === 'shift' ? 'Shift' : null;
    if (modifier) { if (modifiers.has(modifier)) return null; modifiers.add(modifier); }
    else { if (key || !part) return null; key = lower === 'tab' ? 'Tab' : lower === 'space' ? 'Space' : /^f(?:[1-9]|1[0-2])$/i.test(part) ? part.toUpperCase() : /^[a-z0-9ñ,`=\-]$/i.test(part) ? part.toUpperCase() : null; if (!key) return null; }
  }
  if (!key || (!modifiers.has('Ctrl') && !modifiers.has('Alt') && !/^F\d+$/.test(key))) return null;
  return [...['Ctrl', 'Alt', 'Shift'].filter((part) => modifiers.has(part)), key].join('+');
}
function fromEvent(event) {
  if (event.isComposing || event.key === 'Dead' || event.getModifierState?.('AltGraph')) return null;
  return normalize([event.ctrlKey || event.metaKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', event.key === ' ' ? 'Space' : event.key].filter(Boolean).join('+'));
}
function defaults() { return Object.fromEntries(actions.map((action) => [action.id, action.key])); }
function validate(bindings) {
  const seen = new Map();
  for (const action of actions) {
    const key = normalize(bindings[action.id]);
    if (key === null) return `Atajo inválido para ${action.label}. Usa Ctrl/Alt y una tecla, o F1–F12.`;
    if (!key) continue;
    if (reserved.has(key) || ['Ctrl+Alt+M', 'Alt+Tab', 'Alt+Shift+Tab', 'Ctrl+Alt+Tab', 'Alt+Space', 'Ctrl+Alt+L'].includes(key) || /^Alt\+(?:Shift\+)?F\d+$/.test(key) || /^Ctrl\+Alt\+(?:Shift\+)?F\d+$/.test(key)) return `${key} está reservado por el editor, la terminal o el sistema.`;
    if (seen.has(key)) return `${key} ya está asignado a ${seen.get(key)}; entra en conflicto con ${action.label}.`;
    seen.set(key, action.label);
  }
  return '';
}
function resolve(source) {
  const bindings = defaults();
  for (const action of actions) if (source && Object.prototype.hasOwnProperty.call(source, action.id)) bindings[action.id] = normalize(source[action.id]);
  const error = validate(bindings);
  return { bindings: error ? defaults() : bindings, error };
}
const api = { actions, normalize, fromEvent, defaults, validate, resolve };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.mdShortcutLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
