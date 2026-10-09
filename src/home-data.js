import { el } from './home-ui.js';
import { categoryFilter, close, homeInFolder, mainEl, modeDayBtn, modeHoursBtn, modeMonthBtn, modeWeekBtn, open, render } from './home.js';
import { clearUndo, offerUndo } from './home-feedback.js';

'use strict';

// Modelo de datos y persistencia del Home (ver home.js y sus home-*.js
// hermanos): tareas, categorías, archivo de terminadas viejas, recordatorios
// (aviso en pantalla, resumen diario por correo), filas de bases de datos y
// tareas de notas con fecha, nota enlazada, Pomodoro y "plan de hoy".
// setMode/setCursor/setArchiveDays: home.js (núcleo) y home-views.js no
// pueden reasignar `mode`/`cursor`/`archiveAfterDays` directamente (son de
// este módulo) — llaman a estas en vez de hacerlo a mano.

export const showDbToggle = document.getElementById('home-show-db');

export const showNotesToggle = document.getElementById('home-show-notes');

export const weekBeforeToggle = document.getElementById('home-week-before');

export const weekBeforeTime = document.getElementById('home-week-before-time');

export const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: '#ef476f' },
  { value: 'media', label: 'Media', color: '#f2cc8f' },
  { value: 'baja', label: 'Baja', color: '#81b29a' }
];
// Categorías de las tareas (editables en el Home → 🏷 Categorías).

// Categorías de las tareas (editables en el Home → 🏷 Categorías).
export const DEFAULT_CATEGORIES = [
  { id: 'universidad', name: 'Universidad', color: '#3b82f6' },
  { id: 'trabajo', name: 'Trabajo', color: '#8b5cf6' },
  { id: 'casa', name: 'Casa', color: '#f59e0b' },
  { id: 'economia', name: 'Economía', color: '#10b981' },
  { id: 'salud', name: 'Salud', color: '#ef4444' },
  { id: 'personal', name: 'Personal', color: '#06b6d4' }
];

export const REPEAT_OPTIONS = [
  { value: '', label: 'No se repite' },
  { value: 'daily', label: 'Todos los días' },
  { value: 'weekdays', label: 'Días hábiles (lun–vie)' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual (mismo día del mes)' },
  { value: 'yearly', label: 'Anual' }
];

export const REMIND_OPTIONS = [
  { value: '', label: 'Sin aviso' },
  { value: '0', label: 'A la hora' },
  { value: '5', label: '5 min antes' },
  { value: '15', label: '15 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1 hora antes' }
];

export const REMINDER_GRACE_MS = 10 * 60 * 1000; // avisos atrasados más que esto (app cerrada) se descartan

// weekBefore: aviso automático una semana antes de TODO lo que tenga fecha
// (tareas del Home no recurrentes, tareas 📅 de notas y fechas de bases de
// datos), sin tener que configurarlo tarea por tarea. Activado por defecto.
export const WEEK_BEFORE_DEFAULT = { on: true, time: '09:00' };

export let data = { tasks: [], goals: {}, notes: {}, showDatabases: true, showNotes: true, notified: {}, snoozes: [], weekBefore: { ...WEEK_BEFORE_DEFAULT }, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) };

export let noteItems = []; // tareas "- [ ] ... 📅 AAAA-MM-DD" encontradas en las notas de la carpeta

export let saveTimer = null;

export let mode = 'day'; // 'day' | 'week' | 'month' | 'hours'

export let cursor = new Date(); // cualquier día dentro de la semana/mes visible

export let dbItems = []; // [{ date, title, done, databaseId, databaseName }]

export const { pad, iso, parseIso, addDays, occursOn, NOTE_TASK_RE, parseNoteTasks } = window.mdHomeLogic;

export function mondayOf(d) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function todayIso() {
  return iso(new Date());
}

// Número de semana ISO 8601 (la semana 1 es la que contiene el primer jueves).
export function isoWeekNumber(d) {
  const thursday = addDays(mondayOf(d), 3);
  const firstThursday = addDays(mondayOf(new Date(thursday.getFullYear(), 0, 4)), 3);
  return 1 + Math.round((thursday - firstThursday) / (7 * 86400000));
}

export function weekKey() {
  return 'semana:' + iso(mondayOf(cursor));
}

export function monthKey() {
  return `mes:${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
}

export function periodKey() {
  return mode === 'month' ? monthKey() : weekKey();
}

export function formatLong(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export let dataRoot = null; // de dónde se cargaron los datos actuales (ahí se guardan)

export function wantedRoot() {
  return homeInFolder && window.mdState.rootFolder ? window.mdState.rootFolder : null;
}

export async function readStored(root) {
  clearUndo();
  let stored = await window.mdEditor.homeLoad(root);
  let seeded = false;
  if (!stored && root) {
    // Primera vez en esta carpeta: arranca con las tareas que ya tenías.
    stored = await window.mdEditor.homeLoad(null);
    seeded = true;
  }
  dataRoot = root;
  if (stored && typeof stored === 'object') {
    data = {
      tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
      goals: stored.goals && typeof stored.goals === 'object' ? stored.goals : {},
      notes: stored.notes && typeof stored.notes === 'object' ? stored.notes : {},
      showDatabases: stored.showDatabases !== false,
      showNotes: stored.showNotes !== false,
      notified: stored.notified && typeof stored.notified === 'object' ? stored.notified : {},
      snoozes: Array.isArray(stored.snoozes) ? stored.snoozes : [],
      weekBefore: stored.weekBefore && typeof stored.weekBefore === 'object'
        ? { on: stored.weekBefore.on !== false, time: /^\d{2}:\d{2}$/.test(stored.weekBefore.time) ? stored.weekBefore.time : WEEK_BEFORE_DEFAULT.time }
        : { ...WEEK_BEFORE_DEFAULT },
      categories: Array.isArray(stored.categories) ? stored.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      study: window.mdStudyLogic.normalize(stored.study),
      archivedDays: stored.archivedDays && typeof stored.archivedDays === 'object' ? stored.archivedDays : {}
    };
  }
  if (!data.archivedDays) data.archivedDays = {};
  showDbToggle.checked = data.showDatabases;
  showNotesToggle.checked = data.showNotes;
  weekBeforeToggle.checked = data.weekBefore.on;
  weekBeforeTime.value = data.weekBefore.time;
  if (seeded) await window.mdEditor.homeSave(data, dataRoot);
}

// Una sola lectura compartida: el arranque (recordatorios) y open() pueden
// pedirla a la vez. Si cambió dónde tienen que vivir los datos (otra carpeta
// abierta, o se activó/desactivó la opción), se vuelve a leer.
export let loadPromise = null;

export let loadingFor; // carpeta (o null) que se está cargando o ya se cargó

export function load() {
  const want = wantedRoot();
  if (!loadPromise || want !== loadingFor) {
    loadingFor = want;
    loadPromise = switchLocation(want, loadPromise);
  }
  return loadPromise;
}

export async function switchLocation(want, previous) {
  if (previous) {
    // Recién cuando terminó la carga anterior hay datos reales: guardarlos
    // donde estaban antes de pasar a la ubicación nueva. (Sin esto, dos
    // cargas simultáneas podían guardar datos vacíos encima de las tareas.)
    await previous;
    clearTimeout(saveTimer);
    await window.mdEditor.homeSave(data, dataRoot);
  }
  await readStored(want);
  const config = await window.mdEditor.getConfig();
  archiveAfterDays = Number.isInteger(config.homeArchiveDays) ? config.homeArchiveDays : 90;
  await archiveOld();
}

export function save() {
  updatePetMood();
  clearTimeout(saveTimer);
  const root = dataRoot;
  saveTimer = setTimeout(() => window.mdEditor.homeSave(data, root), 300);
}

// Abrieron otra carpeta (sidebar.js) o cambió la opción: recargar el Home
// si sus datos tienen que salir de otro lado.
export async function rootChanged() {
  if (!loadPromise || wantedRoot() === loadingFor) return;
  await load();
  await Promise.all([loadDbItems(), loadNoteItems(), loadDbReminders()]);
  render();
  window.mdStudy?.refresh();
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Lunes = 0 ... domingo = 6 (igual que DAY_NAMES).
// Lo que se dibuja en un día: una tarea común con esa fecha, o una
// repetición de una tarea recurrente. { task, date, done, recurring }.
export function occurrencesOn(dateIso) {
  const items = [];
  data.tasks.forEach((task) => {
    if (task.repeat && task.repeat.freq) {
      if (occursOn(task, dateIso)) items.push({ task, date: dateIso, done: (task.doneDates || []).includes(dateIso), recurring: true });
    } else if (task.date === dateIso) {
      items.push({ task, date: dateIso, done: !!task.done, recurring: false });
    }
  });
  return items.sort((a, b) =>
    Number(a.done) - Number(b.done) ||
    (a.task.time || '99:99').localeCompare(b.task.time || '99:99') ||
    priorityRank(a.task) - priorityRank(b.task));
}

export function itemFor(task) {
  return { task, date: task.date, done: !!task.done, recurring: false };
}

export function priorityRank(task) {
  const idx = PRIORITIES.findIndex((p) => p.value === task.priority);
  return idx === -1 ? PRIORITIES.length : idx;
}

export function priorityColor(task) {
  const p = PRIORITIES.find((x) => x.value === task.priority);
  return p ? p.color : 'var(--border)';
}

export function categoryById(id) {
  return (data.categories || []).find((c) => c.id === id) || null;
}

// "@uni repasar parcial" → categoría Universidad, título "repasar parcial".
export function parseCategoryToken(text) {
  return window.mdHomeLogic.parseCategoryToken(text, data.categories);
}

export function matchesFilter(task) {
  if (!categoryFilter) return true;
  if (categoryFilter === 'none') return !task.category || !categoryById(task.category);
  return task.category === categoryFilter;
}

export function shownOn(dateIso) {
  return occurrencesOn(dateIso).filter((it) => matchesFilter(it.task));
}

export function addTask(title, date, extra) {
  const parsed = parseCategoryToken(title.trim());
  const text = parsed.title;
  if (!text) return;
  // Sin @categoría, hereda la del filtro activo (si hay una elegida).
  const category = parsed.category || (categoryFilter && categoryFilter !== 'none' ? categoryFilter : null);
  const task = { id: newId(), title: text, date: date || null, done: false, priority: 'media', notes: '', category, ...(extra || {}) };
  data.tasks.push(task);
  save();
  render();
  return task;
}

export function updateTask(id, patch) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;
  Object.assign(task, patch);
  save();
  render();
}

function captureFields(task, keys) {
  return Object.fromEntries(keys.map((key) => [key, window.structuredClone(task[key])]));
}

function offerTaskUndo(message, task, before, created) {
  const root = dataRoot;
  const after = captureFields(task, Object.keys(before));
  const createdState = created ? JSON.stringify(created) : null;
  offerUndo(message, () => {
    const current = data.tasks.find((t) => t.id === task.id);
    if (dataRoot !== root || !current || Object.keys(after).some((key) => JSON.stringify(current[key]) !== JSON.stringify(after[key]))) return false;
    if (created) {
      const extra = data.tasks.find((t) => t.id === created.id);
      if (!extra || JSON.stringify(extra) !== createdState) return false;
      data.tasks = data.tasks.filter((t) => t.id !== created.id);
    }
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete current[key]; else current[key] = value;
    }
    save();
    render();
    return true;
  });
}

export function updateTaskWithUndo(id, patch, message) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;
  const before = captureFields(task, Object.keys(patch));
  updateTask(id, patch);
  offerTaskUndo(message, task, before);
}

export function deleteTask(id) {
  data.tasks = data.tasks.filter((t) => t.id !== id);
  save();
  render();
}

export function setItemDone(item, done) {
  if (item.task.kind === 'reminder') return;
  const before = captureFields(item.task, item.recurring ? ['doneDates', 'subtasks'] : ['done', 'doneAt', 'subtasks']);
  const subtasks = (item.task.subtasks || []).map((subtask) => window.mdHomeLogic.setSubtaskDone(subtask, item, done));
  // La mascota gana experiencia (una vez por tarea y día, ver pet.js).
  if (done && !item.done && window.mdPet) window.mdPet.gain('task', `home:${item.task.id}|${item.date}`);
  if (item.recurring) {
    const dates = new Set(item.task.doneDates || []);
    if (done) dates.add(item.date); else dates.delete(item.date);
    updateTask(item.task.id, { doneDates: Array.from(dates), subtasks });
  } else {
    // doneAt: para archivar después las terminadas sin fecha (ver archiveOld).
    updateTask(item.task.id, { done, doneAt: done ? todayIso() : null, subtasks });
  }
  offerTaskUndo(done ? 'Tarea completada' : 'Tarea marcada como pendiente', item.task, before);
}

export function setItemSubtaskDone(item, subtaskId, done) {
  const subtasks = (item.task.subtasks || []).map((subtask) => subtask.id === subtaskId ? window.mdHomeLogic.setSubtaskDone(subtask, item, done) : subtask);
  const patch = { subtasks };
  // Reabrir una subtarea también reabre la tarea principal de ese día.
  if (!done) {
    if (item.recurring) patch.doneDates = (item.task.doneDates || []).filter((date) => date !== item.date);
    else Object.assign(patch, { done: false, doneAt: null });
  }
  updateTaskWithUndo(item.task.id, patch, done ? 'Subtarea completada' : 'Subtarea marcada como pendiente');
}

// ---- archivo de tareas terminadas viejas ----
// Con años de uso, home.json crecía con miles de tareas hechas que se
// recorren en cada dibujo y cada 30 s (avisos). Las comunes terminadas hace
// más de N días (Ajustes → Home y avisos; 90 por defecto) pasan a
// home-archive.json al lado: siguen en la búsqueda global (y al elegir una
// vuelve al Home) y cuentan para la racha de las estadísticas (archivedDays).
// Las recurrentes (hábitos) no se archivan.
export let archiveAfterDays = 90;

export let archiveCache = null; // { root, tasks } — se lee recién cuando hace falta

export async function loadArchive() {
  if (archiveCache && archiveCache.root === dataRoot) return archiveCache.tasks;
  const stored = await window.mdEditor.homeArchiveLoad(dataRoot);
  archiveCache = { root: dataRoot, tasks: stored && Array.isArray(stored.tasks) ? stored.tasks : [] };
  return archiveCache.tasks;
}

export function archiveCutoff() {
  return iso(addDays(new Date(), -archiveAfterDays));
}

export function isArchivable(t, cutoff) {
  if ((t.repeat && t.repeat.freq) || !t.done) return false;
  if (t.unarchivedAt && t.unarchivedAt >= cutoff) return false; // la sacaste del archivo hace poco
  const when = t.date || t.doneAt;
  return !!when && when < cutoff;
}

export async function archiveOld() {
  if (!archiveAfterDays) return 0;
  const today = todayIso();
  // Terminadas de antes (sin doneAt): se cuentan desde hoy.
  let stamped = false;
  data.tasks.forEach((t) => {
    if (t.done && !t.date && !t.doneAt && !(t.repeat && t.repeat.freq)) { t.doneAt = today; stamped = true; }
  });
  const cutoff = archiveCutoff();
  const old = data.tasks.filter((t) => isArchivable(t, cutoff));
  if (!old.length) {
    if (stamped) save();
    return 0;
  }
  const archived = await loadArchive();
  const ids = new Set(archived.map((t) => t.id));
  old.forEach((t) => { if (!ids.has(t.id)) archived.push(t); });
  // Primero el archivo, después el Home: si algo se corta en el medio, a lo
  // sumo la tarea queda en los dos (y no se duplica al reintentar).
  const okArchive = await window.mdEditor.homeArchiveSave({ tasks: archived }, dataRoot);
  if (!okArchive) return 0;
  old.forEach((t) => {
    const day = t.date || t.doneAt;
    data.archivedDays[day] = (data.archivedDays[day] || 0) + 1;
  });
  const oldIds = new Set(old.map((t) => t.id));
  data.tasks = data.tasks.filter((t) => !oldIds.has(t.id));
  clearTimeout(saveTimer);
  await window.mdEditor.homeSave(data, dataRoot);
  return old.length;
}

// Vuelve una tarea archivada al Home (al elegirla en la búsqueda).
export async function unarchive(id) {
  const archived = await loadArchive();
  const task = archived.find((t) => t.id === id);
  if (!task) return null;
  archiveCache.tasks = archived.filter((t) => t.id !== id);
  await window.mdEditor.homeArchiveSave({ tasks: archiveCache.tasks }, dataRoot);
  const day = task.date || task.doneAt;
  if (day && data.archivedDays[day]) {
    data.archivedDays[day]--;
    if (!data.archivedDays[day]) delete data.archivedDays[day];
  }
  // Recién desarchivada: que no se vuelva a archivar enseguida.
  task.unarchivedAt = todayIso();
  data.tasks.push(task);
  save();
  return task;
}

// Saca una sola repetición de la serie (la agrega a skipDates).
export function skipOccurrence(item) {
  const skips = new Set(item.task.skipDates || []);
  skips.add(item.date);
  const doneDates = (item.task.doneDates || []).filter((d) => d !== item.date);
  updateTask(item.task.id, { skipDates: Array.from(skips), doneDates });
}

// Mover una tarea de día. Si es una repetición, se "desprende" de la serie:
// se saca ese día de la serie y se crea una tarea común en el día nuevo.
export function moveItem(item, newDate, extra = {}) {
  if (!item.recurring) {
    updateTaskWithUndo(item.task.id, { date: newDate, ...extra }, 'Tarea reprogramada');
    return;
  }
  if (newDate === item.date) {
    if (Object.keys(extra).length) updateTaskWithUndo(item.task.id, extra, 'Horario actualizado');
    return;
  }
  const t = item.task;
  const before = captureFields(t, ['skipDates', 'doneDates']);
  data.tasks.push({
    ...window.structuredClone(t), repeat: null, doneDates: undefined, skipDates: undefined,
    id: newId(), title: t.title, date: newDate, done: item.done, priority: t.priority,
    notes: t.notes || '', time: t.time || null, remind: t.remind != null ? t.remind : null,
    advance: t.advance || [], ...extra
  });
  const created = data.tasks[data.tasks.length - 1];
  skipOccurrence(item);
  offerTaskUndo('Repetición reprogramada', t, before, created);
}

export function findItem(taskId, dateIso) {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  if (task.repeat && task.repeat.freq) return { task, date: dateIso, done: (task.doneDates || []).includes(dateIso), recurring: true };
  return itemFor(task);
}

// Tareas comunes sin terminar con fecha anterior a hoy (las repeticiones
// pasadas no cuentan: una tarea diaria llenaría la lista sola).
export function overdueTasks() {
  const today = todayIso();
  return data.tasks.filter((t) => t.kind !== 'reminder' && !(t.repeat && t.repeat.freq) && t.date && t.date < today && !t.done);
}

// Ánimo de la mascota: preocupada si hay atrasadas (Home + tareas de notas).
export function overdueCount() {
  const today = todayIso();
  const notes = noteItems.filter((it) => !it.done && it.date < today).length;
  return overdueTasks().length + notes;
}

export function updatePetMood() {
  if (window.mdPet) window.mdPet.setOverdue(overdueCount());
}

export function itemsInRange(fromIso, toIso) {
  const items = [];
  for (let d = parseIso(fromIso); iso(d) <= toIso; d = addDays(d, 1)) items.push(...occurrencesOn(iso(d)));
  return items;
}

export const MAX_ADVANCE_DAYS = 30; // hasta cuántos días hacia adelante se buscan avisos anticipados

export let dbReminderItems = []; // filas de bases de datos cuya columna Fecha tiene avisos configurados

export function formatWhen(dateIso, time) {
  const text = parseIso(dateIso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const cap = text.charAt(0).toUpperCase() + text.slice(1);
  return time ? `${cap} a las ${time}` : cap;
}

// Título de la notificación según cuántos días faltan.
export function reminderTitle(days, title, time) {
  if (days === 0) return time ? `Hoy a las ${time}: ${title}` : `Hoy: ${title}`;
  if (days === 1) return `Mañana: ${title}`;
  if (days === 7) return `Falta 1 semana para ${title}`;
  if (days === 14) return `Faltan 2 semanas para ${title}`;
  if (days === 30) return `Falta 1 mes para ${title}`;
  return `Faltan ${days} días para ${title}`;
}

export function atTime(dateIso, hhmm, minusMinutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = parseIso(dateIso);
  d.setHours(h, m - (minusMinutes || 0), 0, 0);
  return d.getTime();
}

// Todos los avisos que suenan HOY (a cualquier hora): los del mismo día
// ("15 min antes" de la hora de la tarea) y los anticipados de tareas y
// filas de bases de datos con fecha dentro de los próximos 30 días.
// La clave empieza con el día en que suena: así se puede olvidar sin
// riesgo al día siguiente.
export function remindersFiringToday() {
  const today = todayIso();
  const out = [];
  for (let offset = 0; offset <= MAX_ADVANCE_DAYS; offset++) {
    const date = iso(addDays(parseIso(today), offset));
    occurrencesOn(date).forEach((item) => {
      if (item.done) return;
      const t = item.task;
      const src = `home:${t.id}|${date}`;
      if (offset === 0 && t.time && t.remind != null) {
        out.push({
          key: `${today}|${src}|rel${t.remind}|${t.time}`,
          at: atTime(date, t.time, Number(t.remind)),
          title: Number(t.remind) ? `En ${t.remind} min: ${t.title}` : reminderTitle(0, t.title, t.time),
          body: formatWhen(date, t.time) + (t.notes ? `\n${t.notes}` : ''),
          source: { kind: 'home', taskId: t.id, date }
        });
      }
      (t.advance || []).forEach((r) => {
        if (r.days !== offset || !r.time) return;
        out.push({
          key: `${today}|${src}|adv${r.days}@${r.time}`,
          at: atTime(today, r.time),
          title: reminderTitle(r.days, t.title, t.time),
          body: formatWhen(date, t.time) + (t.notes ? `\n${t.notes}` : ''),
          source: { kind: 'home', taskId: t.id, date }
        });
      });
    });
    dbReminderItems.forEach((it) => {
      if (it.done || it.date !== date) return;
      it.reminders.forEach((r) => {
        if (r.days !== offset || !r.time) return;
        out.push({
          key: `${today}|db:${it.rowId}:${it.columnId}|${date}|adv${r.days}@${r.time}`,
          at: atTime(today, r.time),
          title: reminderTitle(r.days, it.title, null),
          body: `${formatWhen(date, null)}\nBase de datos: ${it.databaseName} · ${it.columnName}`,
          source: { kind: 'db', databaseId: it.databaseId, rowId: it.rowId, doneColumnId: it.doneColumnId }
        });
      });
    });
  }
  out.push(...weekBeforeReminders(today));
  return out;
}

// El aviso automático "una semana antes" (data.weekBefore). Se salta lo que
// ya tiene su propio aviso de 7 días (no avisar dos veces) y las tareas
// recurrentes (una tarea diaria avisaría todos los días).
export const WEEK_DAYS = 7;

export function weekBeforeReminders(today) {
  const wb = data.weekBefore;
  if (!wb || !wb.on) return [];
  const date = iso(addDays(parseIso(today), WEEK_DAYS));
  const at = atTime(today, wb.time);
  const out = [];
  occurrencesOn(date).forEach((item) => {
    const t = item.task;
    if (item.done || item.recurring || (t.advance || []).some((r) => r.days === WEEK_DAYS)) return;
    out.push({
      key: `${today}|home:${t.id}|${date}|week`,
      at,
      lateOk: true,
      title: reminderTitle(WEEK_DAYS, t.title, t.time),
      body: formatWhen(date, t.time) + (t.notes ? `\n${t.notes}` : ''),
      source: { kind: 'home', taskId: t.id, date }
    });
  });
  noteItemsOn(date).forEach((it) => {
    if (it.done) return;
    out.push({
      key: `${today}|note:${it.filePath}|${it.title}|${date}|week`,
      at,
      lateOk: true,
      title: reminderTitle(WEEK_DAYS, it.title, null),
      body: `${formatWhen(date, null)}\nNota: ${it.filePath.split(/[\\/]/).pop()}`,
      source: { kind: 'note', item: it }
    });
  });
  dbItemsOn(date).forEach((it) => {
    if (it.done) return;
    const own = dbReminderItems.find((r) => r.rowId === it.rowId && r.columnId === it.columnId);
    if (own && own.reminders.some((r) => r.days === WEEK_DAYS)) return;
    out.push({
      key: `${today}|db:${it.rowId}:${it.columnId}|${date}|week`,
      at,
      lateOk: true,
      title: reminderTitle(WEEK_DAYS, it.title, null),
      body: `${formatWhen(date, null)}\nBase de datos: ${it.databaseName}`,
      source: { kind: 'db', databaseId: it.databaseId, rowId: it.rowId, doneColumnId: null }
    });
  });
  return out;
}

export const SNOOZE_OPTIONS = [
  { label: '10 min', ms: 10 * 60 * 1000 },
  { label: '1 hora', ms: 60 * 60 * 1000 },
  { label: 'Mañana 9:00', tomorrowAt: '09:00' }
];

export let toastHost = null;

export function openSource(source) {
  if (window.mdEditor.focusWindow) window.mdEditor.focusWindow();
  if (source && source.kind === 'db') {
    if (window.mdDatabase) window.mdDatabase.open(source.databaseId);
  } else if (source && source.kind === 'note') {
    window.openFileAtPath(source.item.filePath);
  } else {
    open();
  }
}

export async function markSourceDone(source) {
  if (!source) return;
  if (source.kind === 'home') {
    const item = findItem(source.taskId, source.date);
    if (item && !item.done) setItemDone(item, true);
  } else if (source.kind === 'note') {
    if (!source.item.done) await toggleNoteItem(source.item);
  } else if (source.kind === 'db' && source.doneColumnId && window.mdState.rootFolder) {
    if (window.mdPet) window.mdPet.gain('task', `db:${source.rowId}:${source.doneColumnId}|${todayIso()}`);
    await window.mdEditor.db.setCell(window.mdState.rootFolder, source.rowId, source.doneColumnId, '1');
    await loadDbReminders();
  }
}

export function snoozeReminder(r, option) {
  let at;
  if (option.tomorrowAt) {
    at = atTime(iso(addDays(new Date(), 1)), option.tomorrowAt);
  } else {
    at = Date.now() + option.ms;
  }
  data.snoozes.push({
    id: newId(), at,
    title: r.title.replace(/^\(pospuesto\) /, ''),
    body: r.body,
    source: r.source || null
  });
  save();
}

export function showReminderToast(r) {
  if (!toastHost) {
    toastHost = el('div', 'reminder-toasts');
    document.body.appendChild(toastHost);
  }
  const toast = el('div', 'reminder-toast');
  const head = el('div', 'reminder-toast-title', `🔔 ${r.snoozed ? '(pospuesto) ' : ''}${r.title}`);
  head.title = 'Abrir';
  head.addEventListener('click', () => openSource(r.source));
  const close = el('button', 'reminder-toast-close', '×');
  close.title = 'Descartar';
  close.addEventListener('click', () => toast.remove());
  const top = el('div', 'reminder-toast-top');
  top.append(head, close);
  toast.appendChild(top);
  if (r.body) toast.appendChild(el('div', 'reminder-toast-body', r.body));

  const actions = el('div', 'reminder-toast-actions');
  const canComplete = r.source && ((r.source.kind === 'home' && data.tasks.find((task) => task.id === r.source.taskId)?.kind !== 'reminder') || r.source.kind === 'note' || r.source.doneColumnId);
  if (canComplete) {
    const done = el('button', 'reminder-toast-btn reminder-toast-done', '✓ Hecho');
    done.addEventListener('click', async () => {
      toast.remove();
      await markSourceDone(r.source);
    });
    actions.appendChild(done);
  }
  const later = el('span', 'reminder-toast-later', 'Posponer:');
  actions.appendChild(later);
  SNOOZE_OPTIONS.forEach((opt) => {
    const b = el('button', 'reminder-toast-btn', opt.label);
    b.addEventListener('click', () => {
      toast.remove();
      snoozeReminder(r, opt);
    });
    actions.appendChild(b);
  });
  toast.appendChild(actions);
  toastHost.appendChild(toast);
  return toast;
}

export function fireReminder(r) {
  try {
    const n = new Notification(`🔔 ${r.snoozed ? '(pospuesto) ' : ''}${r.title}`, { body: r.body });
    n.onclick = () => openSource(r.source);
  } catch {
    // Notification puede no estar disponible en algunos entornos
  }
  showReminderToast(r);
  // También por correo, si está activado (ver mailsettings.js / ipc-mail.js).
  if (window.mdMail) window.mdMail.notify(`🔔 ${r.snoozed ? '(pospuesto) ' : ''}${r.title}`, `${r.body || ''}\n\n— MK`);
}

// ---- resumen diario por correo ----
// A la hora elegida en ⚙ Ajustes → Correo: lo de hoy, lo atrasado de las
// últimas dos semanas y lo que viene en los próximos 7 días. Si MK se abre
// más tarde ese día, se manda igual (una vez por día).
export function itemLine(title, time, extra) {
  return `• ${time ? time + ' ' : ''}${title}${extra ? ` (${extra})` : ''}`;
}

export function dayItems(dateIso) {
  const lines = [];
  occurrencesOn(dateIso).forEach((it) => { if (!it.done) lines.push(itemLine(it.task.title, it.task.time)); });
  noteItemsOn(dateIso).forEach((it) => { if (!it.done) lines.push(itemLine(it.title, null, 'nota')); });
  dbItemsOn(dateIso).forEach((it) => { if (!it.done) lines.push(itemLine(it.title, null, it.databaseName)); });
  return lines;
}

export function dailySummaryText(today) {
  const base = parseIso(today);
  const out = [];
  const todayLines = dayItems(today);
  out.push(`HOY (${formatWhen(today, null)})`);
  out.push(...(todayLines.length ? todayLines : ['• Nada planificado.']));
  const overdue = [];
  for (let i = 14; i >= 1; i--) {
    const d = iso(addDays(base, -i));
    occurrencesOn(d).forEach((it) => { if (!it.done && !it.recurring) overdue.push(itemLine(it.task.title, null, formatWhen(d, null))); });
    noteItemsOn(d).forEach((it) => { if (!it.done) overdue.push(itemLine(it.title, null, formatWhen(d, null))); });
  }
  if (overdue.length) out.push('', `ATRASADAS (${overdue.length})`, ...overdue);
  const next = [];
  for (let i = 1; i <= 7; i++) {
    const d = iso(addDays(base, i));
    dayItems(d).forEach((l) => next.push(`${l} — ${formatWhen(d, null)}`));
  }
  if (next.length) out.push('', 'PRÓXIMOS 7 DÍAS', ...next);
  return { subject: `MK: tu día — ${todayLines.length} para hoy${overdue.length ? `, ${overdue.length} atrasadas` : ''}`, text: out.join('\n') + '\n\n— MK' };
}

export function checkDailySummary(now, today) {
  const daily = window.mdMail && window.mdMail.getDaily();
  if (!daily || !daily.on) return false;
  const key = `${today}|mail-summary`;
  if (data.notified[key] || now < atTime(today, daily.time)) return false;
  data.notified[key] = true;
  const { subject, text } = dailySummaryText(today);
  window.mdMail.notify(subject, text);
  return true;
}

export function checkReminders() {
  const now = Date.now();
  const today = todayIso();
  let changed = false;
  remindersFiringToday().forEach((r) => {
    if (now < r.at || data.notified[r.key]) return;
    data.notified[r.key] = true;
    changed = true;
    // Sonaba con la app cerrada: se descarta — salvo los de "1 semana antes"
    // (lateOk), que siguen sirviendo si abrís MK más tarde ese mismo día.
    if (now - r.at > REMINDER_GRACE_MS && !r.lateOk) return;
    fireReminder(r);
  });
  if (checkDailySummary(now, today)) changed = true;
  // Avisos pospuestos: suenan cuando les toca aunque la app haya estado
  // cerrada un rato (los pediste vos a propósito).
  const due = data.snoozes.filter((s) => s.at <= now);
  if (due.length) {
    data.snoozes = data.snoozes.filter((s) => s.at > now);
    due.forEach((s) => fireReminder({ ...s, snoozed: true }));
    changed = true;
  }
  // Claves de días anteriores ya no pueden volver a sonar.
  Object.keys(data.notified).forEach((key) => {
    if (key.split('|')[0] !== today) { delete data.notified[key]; changed = true; }
  });
  if (changed) save();
}

// Filas de bases de datos con avisos (columna Fecha con "Avisos" configurados).
// Independiente del toggle "Fechas de bases de datos" del Home: ese solo
// decide si se ven en el calendario.
export async function loadDbReminders() {
  const root = window.mdState.rootFolder;
  if (!root || !window.mdEditor.db) { dbReminderItems = []; return; }
  const items = [];
  try {
    const databases = await window.mdEditor.db.listDatabases(root);
    for (const db of databases) {
      const columns = await window.mdEditor.db.listColumns(root, db.id);
      const withReminders = columns.filter((c) => {
        if (c.type !== 'date') return false;
        try {
          const o = JSON.parse(c.options || '{}');
          return Array.isArray(o.reminders) && o.reminders.length;
        } catch {
          return false;
        }
      });
      if (!withReminders.length) continue;
      const rows = await window.mdEditor.db.listRows(root, db.id);
      const titleCol = columns.find((c) => c.type === 'text') || columns[0];
      const doneCol = columns.find((c) => c.type === 'checkbox');
      withReminders.forEach((col) => {
        const reminders = JSON.parse(col.options).reminders;
        rows.forEach((row) => {
          const date = row.cells[col.id];
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          items.push({
            rowId: row.id, columnId: col.id, columnName: col.name, date, reminders,
            title: (titleCol && row.cells[titleCol.id]) || '(sin nombre)',
            done: doneCol ? row.cells[doneCol.id] === '1' : false,
            doneColumnId: doneCol ? doneCol.id : null,
            databaseId: db.id, databaseName: (db.icon ? db.icon + ' ' : '') + db.name
          });
        });
      });
    }
  } catch {
    return; // si falla la lectura, se mantienen los de la vuelta anterior
  }
  dbReminderItems = items;
}

export async function loadDbItems() {
  dbItems = [];
  const root = window.mdState.rootFolder;
  if (!root || !data.showDatabases || !window.mdEditor.db) return;
  try {
    const databases = await window.mdEditor.db.listDatabases(root);
    for (const db of databases) {
      const [columns, rows] = await Promise.all([
        window.mdEditor.db.listColumns(root, db.id),
        window.mdEditor.db.listRows(root, db.id)
      ]);
      const dateCols = columns.filter((c) => c.type === 'date');
      if (!dateCols.length) continue;
      const titleCol = columns.find((c) => c.type === 'text') || columns[0];
      const doneCol = columns.find((c) => c.type === 'checkbox');
      rows.forEach((row) => {
        dateCols.forEach((col) => {
          const value = row.cells[col.id];
          if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
          const title = (titleCol && row.cells[titleCol.id]) || '(sin nombre)';
          dbItems.push({
            date: value,
            title: dateCols.length > 1 ? `${title} · ${col.name}` : title,
            done: doneCol ? row.cells[doneCol.id] === '1' : false,
            databaseId: db.id,
            databaseName: (db.icon ? db.icon + ' ' : '') + db.name,
            rowId: row.id,
            columnId: col.id
          });
        });
      });
    }
  } catch {
    dbItems = [];
  }
}

export function dbItemsOn(dateIso) {
  return dbItems.filter((it) => it.date === dateIso);
}

let noteLoadRevision = 0;
export async function loadNoteItems() {
  const revision = ++noteLoadRevision;
  const root = window.mdState.rootFolder;
  if (!root || !data.showNotes) { noteItems = []; return; }
  try {
    const files = await window.mdEditor.kanbanReadFolderFiles(root);
    const next = files.flatMap((f) => parseNoteTasks(f.path, f.content));
    if (revision === noteLoadRevision && root === window.mdState.rootFolder && data.showNotes) noteItems = next;
  } catch {
    if (revision === noteLoadRevision) noteItems = [];
  }
}

export function noteItemsOn(dateIso) {
  return noteItems.filter((it) => it.date === dateIso);
}

// Reescribe la línea de una tarea de nota con fn(match) → línea nueva (o
// null si la línea ya no está). Busca por contenido si el archivo cambió.
export function rewriteLine(text, item, fn) {
  const lines = text.split('\n');
  const idx = lines[item.line] === item.raw ? item.line : lines.indexOf(item.raw);
  if (idx === -1) return null;
  const m = lines[idx].match(NOTE_TASK_RE);
  if (!m) return null;
  lines[idx] = fn(m);
  return lines.join('\n');
}

// Aplica rewriteLine al archivo de la tarea: si está abierto en el editor,
// al buffer (lo guarda el autoguardado); si no, directo al disco.
export async function editNoteItem(item, fn) {
  const active = window.mdTabs && window.mdTabs.getActiveTabInfo();
  if (active && active.filePath === item.filePath) {
    const updated = rewriteLine(window.mdCodeMirror.getValue(), item, fn);
    if (updated !== null) window.mdCodeMirror.setValue(updated);
  } else {
    const result = await window.mdEditor.readFile(item.filePath);
    if (!result || result.binary) return;
    const updated = rewriteLine(result.content, item, fn);
    if (updated === null) {
      alert('Esa tarea cambió en el archivo desde que se cargó el Home. Volvé a abrirlo.');
    } else {
      await window.mdEditor.saveFile(updated, item.filePath, false);
    }
  }
  await loadNoteItems();
  render();
}

export function toggleNoteItem(item) {
  if (!item.done && window.mdPet) window.mdPet.gain('task', `note:${item.filePath}|${item.title}|${item.date}`);
  return editNoteItem(item, ([, pre, mark, post, rest1, date, rest2]) =>
    `${pre}${mark.trim() ? ' ' : 'x'}${post}${rest1} 📅 ${date}${rest2}`);
}

// Arrastrar una tarea de nota a otro día cambia su "📅 fecha" en el archivo;
// soltarla en "Sin fecha" le saca la fecha (deja de aparecer en el Home).
export function moveNoteItem(item, newDate) {
  return editNoteItem(item, ([, pre, mark, post, rest1, , rest2]) =>
    `${pre}${mark}${post}${rest1}${newDate ? ` 📅 ${newDate}` : ''}${rest2}`);
}

export async function openLinkedNote(name) {
  const root = window.mdState.rootFolder;
  if (!root) {
    alert('Abrí una carpeta primero para poder abrir notas enlazadas.');
    return;
  }
  const target = await window.mdEditor.resolveWikilink(root, name.replace(/\.md$/i, ''));
  if (!target) {
    alert(`No encontré la nota "${name}" en la carpeta abierta.`);
    return;
  }
  close();
  await window.openFileAtPath(target);
}

// Nombres de las notas de la carpeta, para autocompletar el campo "Nota".
export async function noteNames() {
  const root = window.mdState.rootFolder;
  if (!root) return [];
  const names = [];
  const walk = (nodes) => (nodes || []).forEach((n) => {
    if (n.esCarpeta) walk(n.hijos);
    else if (/\.(md|markdown|txt)$/i.test(n.nombre)) names.push(n.nombre.replace(/\.(md|markdown|txt)$/i, ''));
  });
  try {
    walk(await window.mdEditor.readFolder(root));
  } catch {
    return [];
  }
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

export async function startPomodoroFor(item, focusCategory) {
  if (!window.mdPomodoro || !window.mdPomodoro.startFor) return;
  const task = item.task;
  await window.mdPomodoro.startFor(task.title, () => {
    const t = data.tasks.find((x) => x.id === task.id);
    if (!t) return false;
    t.pomodoros = (t.pomodoros || 0) + 1;
    save();
    render();
    const current = findItem(t.id, item.date);
    if (current && !current.done && confirm(`Pomodoro: terminó el foco de "${t.title}".\n\n¿La marcás como hecha?`)) {
      setItemDone(current, true);
      return false; // tarea terminada: el Pomodoro sigue, pero ya sin tarea asociada
    }
    return true;
  }, focusCategory ?? categoryById(task.category)?.name ?? '');
  close();
}

export function todayPlanLines() {
  const today = todayIso();
  const lines = occurrencesOn(today).map((it) =>
    `- [${it.done ? 'x' : ' '}] ${it.task.time ? it.task.time + ' ' : ''}${it.task.title}${it.task.note ? ` ([[${it.task.note}]])` : ''}`);
  noteItemsOn(today).forEach((it) => lines.push(`- [${it.done ? 'x' : ' '}] ${it.title}`));
  dbItemsOn(today).forEach((it) => lines.push(`- [${it.done ? 'x' : ' '}] ${it.title} (${it.databaseName})`));
  return lines;
}

export async function sendPlanToDailyNote() {
  if (!window.mdState.rootFolder) {
    alert('Abrí una carpeta primero: la nota diaria se guarda dentro de ella.');
    return;
  }
  await loadNoteItems();
  const lines = todayPlanLines();
  if (!lines.length) {
    alert('No hay nada planificado para hoy.');
    return;
  }
  close();
  await window.mdDailyNote.open();
  const cm = window.mdCodeMirror;
  const text = cm.getValue();
  const heading = '## Plan del día';
  // Sin duplicar: solo se agregan las líneas cuyo texto (sin la casilla) no esté ya.
  const missing = lines.filter((l) => !text.includes(l.slice(6)));
  if (!missing.length) return;
  const all = text.split('\n');
  const hIdx = all.findIndex((l) => l.trim() === heading);
  if (hIdx === -1) {
    cm.setValue(text.replace(/\s*$/, '') + `\n\n${heading}\n\n${missing.join('\n')}\n`);
  } else {
    let insertAt = hIdx + 1;
    while (insertAt < all.length && (all[insertAt].trim() === '' || /^\s*[-*]\s/.test(all[insertAt]))) insertAt++;
    while (insertAt > hIdx + 1 && all[insertAt - 1].trim() === '') insertAt--;
    all.splice(insertAt, 0, ...missing);
    cm.setValue(all.join('\n'));
  }
  cm.setCursor(cm.lineCount() - 1, 0);
}

export function setMode(next) {
  if (!['day', 'week', 'month', 'hours'].includes(next)) return;
  mode = next;
  for (const [button, value] of [[modeDayBtn, 'day'], [modeWeekBtn, 'week'], [modeMonthBtn, 'month'], [modeHoursBtn, 'hours']]) {
    if (!button) continue;
    button.classList.toggle('home-mode-active', mode === value);
    button.setAttribute('aria-pressed', String(mode === value));
  }
  mainEl.scrollTop = 0;
  render();
}

export function setCursor(d) { cursor = d; }

export function setArchiveDays(n) { archiveAfterDays = n; }
