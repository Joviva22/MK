(function () {
'use strict';
const L = window.mdPomodoroLogic;
let data = L.normalize(null);
let dirty = false;
let queue = Promise.resolve();
const ready = window.mdEditor.getConfig().then((config) => { data = L.normalize(config.pomodoroHistory); });
function changed() { document.dispatchEvent(new CustomEvent('mk:pomodoro-history')); }
async function persist() {
  dirty = true;
  changed();
  const result = await window.mdEditor.setConfig({ pomodoroHistory: data });
  if (JSON.stringify(result.pomodoroHistory) !== JSON.stringify(data)) throw new Error('El guardado está bloqueado durante la importación de datos.');
  dirty = false;
  changed();
}
function mutate(fn) {
  queue = queue.catch(() => {}).then(async () => { await ready; fn(data); await persist(); });
  return queue;
}
function addCategory(name) {
  name = L.category(name);
  if (!name) return Promise.reject(new Error('Escribe un nombre de categoría.'));
  return mutate((next) => { if (!next.categories.includes(name)) next.categories.push(name); });
}
function selectCategory(name) {
  name = L.category(name);
  return mutate((next) => {
    next.selectedCategory = name;
    if (name && !next.categories.includes(name)) next.categories.push(name);
  });
}
function record(entry) {
  if (!L.validSeconds(entry.seconds)) return Promise.reject(new Error('La duración debe ser mayor que cero y no superar 1440 minutos.'));
  const date = entry.date || new Date().toISOString();
  if (!Number.isFinite(Date.parse(date))) return Promise.reject(new Error('Fecha no válida.'));
  const r = { id: entry.id || crypto.randomUUID(), category: L.category(entry.category), seconds: entry.seconds, date: new Date(date).toISOString(), completed: entry.completed === true, task: String(entry.task || '').slice(0, 500), notePath: L.notePath(entry.notePath), detail: L.detail(entry.detail) };
  return mutate((next) => {
    const existing = next.records.findIndex((item) => item.id === r.id);
    if (existing < 0) next.records.push(r); else next.records[existing] = r;
    if (r.category && !next.categories.includes(r.category)) next.categories.push(r.category);
  });
}
function edit(id, values) {
  if (!L.validSeconds(values.seconds) || !Number.isFinite(Date.parse(values.date))) return Promise.reject(new Error('Revisa la fecha y los minutos (mayor que cero, máximo 1440).'));
  return mutate((next) => {
    const r = next.records.find((r) => r.id === id);
    if (!r) throw new Error('El registro ya no existe.');
    Object.assign(r, { category: L.category(values.category), seconds: values.seconds, date: new Date(values.date).toISOString(), completed: values.completed === true });
    if (Object.hasOwn(values, 'notePath')) r.notePath = L.notePath(values.notePath);
    if (Object.hasOwn(values, 'detail')) r.detail = L.detail(values.detail);
    if (r.category && !next.categories.includes(r.category)) next.categories.push(r.category);
  });
}
function remove(id) { return mutate((next) => { next.records = next.records.filter((r) => r.id !== id); }); }
function renameCategory(oldName, newName) {
  newName = L.category(newName);
  if (!newName) return Promise.reject(new Error('Escribe el nuevo nombre.'));
  return mutate((next) => {
    next.categories = [...new Set(next.categories.map((c) => c === oldName ? newName : c))];
    next.records.forEach((r) => { if (r.category === oldName) r.category = newName; });
    if (next.selectedCategory === oldName) next.selectedCategory = newName;
  });
}
window.mdPomodoroHistory = {
  ready, addCategory, selectCategory, record, edit, remove, renameCategory,
  retry: () => mutate(() => {}),
  getState: () => JSON.parse(JSON.stringify(data)),
  isDirty: () => dirty,
  settled: () => queue
};
})();
