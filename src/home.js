(function () {
'use strict';

// Pestaña "Home": planificador semanal y mensual con calendario. Las tareas
// y objetivos son personales (no de una carpeta), así que viven en
// <userData>/home.json vía IPC (home:load / home:save, ver main.js) y el
// Home funciona aunque no haya carpeta abierta. Si SÍ hay carpeta, además
// muestra (solo lectura) las filas de las bases de datos que tengan una
// columna de tipo Fecha — clic en una lleva a esa base (ver database.js).
//
// Tareas recurrentes: una sola tarea "serie" con task.repeat; las
// repeticiones se calculan al vuelo por día (occursOn) en vez de guardarse
// una por una. Qué días se completaron va en task.doneDates y los días
// borrados/movidos sueltos en task.skipDates. Recordatorios: task.time
// (HH:MM) + task.remind (minutos antes, null = sin aviso), revisados cada
// 30 s desde que arranca la app aunque el Home esté cerrado.

const overlay = document.getElementById('home-panel');
const sideEl = document.getElementById('home-side');
const mainEl = document.getElementById('home-main');
const rangeLabel = document.getElementById('home-range-label');
const modeWeekBtn = document.getElementById('home-mode-week');
const modeMonthBtn = document.getElementById('home-mode-month');
const showDbToggle = document.getElementById('home-show-db');
const showNotesToggle = document.getElementById('home-show-notes');
const weekBeforeToggle = document.getElementById('home-week-before');
const weekBeforeTime = document.getElementById('home-week-before-time');
const startupToggle = document.getElementById('home-startup-toggle');
const DRAG_MIME = 'application/x-mk-home-task';
const NOTE_DRAG_MIME = 'application/x-mk-home-note'; // tarea "📅" de una nota
const DB_DRAG_MIME = 'application/x-mk-home-dbrow'; // fila de base de datos con fecha

const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: '#ef476f' },
  { value: 'media', label: 'Media', color: '#f2cc8f' },
  { value: 'baja', label: 'Baja', color: '#81b29a' }
];
// Categorías de las tareas (editables en el Home → 🏷 Categorías).
const DEFAULT_CATEGORIES = [
  { id: 'universidad', name: 'Universidad', color: '#3b82f6' },
  { id: 'trabajo', name: 'Trabajo', color: '#8b5cf6' },
  { id: 'casa', name: 'Casa', color: '#f59e0b' },
  { id: 'economia', name: 'Economía', color: '#10b981' },
  { id: 'salud', name: 'Salud', color: '#ef4444' },
  { id: 'personal', name: 'Personal', color: '#06b6d4' }
];
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const REPEAT_OPTIONS = [
  { value: '', label: 'No se repite' },
  { value: 'daily', label: 'Todos los días' },
  { value: 'weekdays', label: 'Días hábiles (lun–vie)' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual (mismo día del mes)' },
  { value: 'yearly', label: 'Anual' }
];
const REMIND_OPTIONS = [
  { value: '', label: 'Sin aviso' },
  { value: '0', label: 'A la hora' },
  { value: '5', label: '5 min antes' },
  { value: '15', label: '15 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1 hora antes' }
];
const CLICK_DELAY_MS = 250; // para distinguir clic (abrir editor) de doble clic (renombrar)
const REMINDER_GRACE_MS = 10 * 60 * 1000; // avisos atrasados más que esto (app cerrada) se descartan

// weekBefore: aviso automático una semana antes de TODO lo que tenga fecha
// (tareas del Home no recurrentes, tareas 📅 de notas y fechas de bases de
// datos), sin tener que configurarlo tarea por tarea. Activado por defecto.
const WEEK_BEFORE_DEFAULT = { on: true, time: '09:00' };
let data = { tasks: [], goals: {}, notes: {}, showDatabases: true, showNotes: true, notified: {}, snoozes: [], weekBefore: { ...WEEK_BEFORE_DEFAULT }, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) };
let categoryFilter = ''; // '' = todas; 'none' = sin categoría; o el id
let noteItems = []; // tareas "- [ ] ... 📅 AAAA-MM-DD" encontradas en las notas de la carpeta
let saveTimer = null;
let mode = 'week'; // 'week' | 'month'
let cursor = new Date(); // cualquier día dentro de la semana/mes visible
let dbItems = []; // [{ date, title, done, databaseId, databaseName }]
let editorEl = null;

// ---- fechas (siempre en hora local, formato YYYY-MM-DD) ----

const { pad, iso, parseIso, addDays, occursOn, NOTE_TASK_RE, parseNoteTasks } = window.mdHomeLogic;

function mondayOf(d) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

function todayIso() {
  return iso(new Date());
}

// Número de semana ISO 8601 (la semana 1 es la que contiene el primer jueves).
function isoWeekNumber(d) {
  const thursday = addDays(mondayOf(d), 3);
  const firstThursday = addDays(mondayOf(new Date(thursday.getFullYear(), 0, 4)), 3);
  return 1 + Math.round((thursday - firstThursday) / (7 * 86400000));
}

function weekKey() {
  return 'semana:' + iso(mondayOf(cursor));
}

function monthKey() {
  return `mes:${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
}

function periodKey() {
  return mode === 'week' ? weekKey() : monthKey();
}

function formatLong(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---- persistencia ----

// Dónde viven las tareas: null = configuración de la app (por defecto), o
// la carpeta abierta (<carpeta>/.mk/home.json) si está activada la opción
// "Guardar el Home en la carpeta abierta" en Ajustes.
let homeInFolder = false;
let dataRoot = null; // de dónde se cargaron los datos actuales (ahí se guardan)

function wantedRoot() {
  return homeInFolder && window.mdState.rootFolder ? window.mdState.rootFolder : null;
}

async function readStored(root) {
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
      categories: Array.isArray(stored.categories) ? stored.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c }))
    };
  }
  showDbToggle.checked = data.showDatabases;
  showNotesToggle.checked = data.showNotes;
  weekBeforeToggle.checked = data.weekBefore.on;
  weekBeforeTime.value = data.weekBefore.time;
  if (seeded) await window.mdEditor.homeSave(data, dataRoot);
}

// Una sola lectura compartida: el arranque (recordatorios) y open() pueden
// pedirla a la vez. Si cambió dónde tienen que vivir los datos (otra carpeta
// abierta, o se activó/desactivó la opción), se vuelve a leer.
let loadPromise = null;
let loadingFor; // carpeta (o null) que se está cargando o ya se cargó
function load() {
  const want = wantedRoot();
  if (!loadPromise || want !== loadingFor) {
    loadingFor = want;
    loadPromise = switchLocation(want, loadPromise);
  }
  return loadPromise;
}

async function switchLocation(want, previous) {
  if (previous) {
    // Recién cuando terminó la carga anterior hay datos reales: guardarlos
    // donde estaban antes de pasar a la ubicación nueva. (Sin esto, dos
    // cargas simultáneas podían guardar datos vacíos encima de las tareas.)
    await previous;
    clearTimeout(saveTimer);
    await window.mdEditor.homeSave(data, dataRoot);
  }
  await readStored(want);
}

function save() {
  updatePetMood();
  clearTimeout(saveTimer);
  const root = dataRoot;
  saveTimer = setTimeout(() => window.mdEditor.homeSave(data, root), 300);
}

// Abrieron otra carpeta (sidebar.js) o cambió la opción: recargar el Home
// si sus datos tienen que salir de otro lado.
async function rootChanged() {
  if (!loadPromise || wantedRoot() === loadingFor) return;
  await load();
  await Promise.all([loadDbItems(), loadNoteItems(), loadDbReminders()]);
  render();
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- tareas ----

// Lunes = 0 ... domingo = 6 (igual que DAY_NAMES).
// Lo que se dibuja en un día: una tarea común con esa fecha, o una
// repetición de una tarea recurrente. { task, date, done, recurring }.
function occurrencesOn(dateIso) {
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

function itemFor(task) {
  return { task, date: task.date, done: !!task.done, recurring: false };
}

function priorityRank(task) {
  const idx = PRIORITIES.findIndex((p) => p.value === task.priority);
  return idx === -1 ? PRIORITIES.length : idx;
}

function priorityColor(task) {
  const p = PRIORITIES.find((x) => x.value === task.priority);
  return p ? p.color : 'var(--border)';
}

// ---- categorías ----

function categoryById(id) {
  return (data.categories || []).find((c) => c.id === id) || null;
}

// "@uni repasar parcial" → categoría Universidad, título "repasar parcial".
function parseCategoryToken(text) {
  return window.mdHomeLogic.parseCategoryToken(text, data.categories);
}

function matchesFilter(task) {
  if (!categoryFilter) return true;
  if (categoryFilter === 'none') return !task.category || !categoryById(task.category);
  return task.category === categoryFilter;
}

function shownOn(dateIso) {
  return occurrencesOn(dateIso).filter((it) => matchesFilter(it.task));
}

function addTask(title, date) {
  const parsed = parseCategoryToken(title.trim());
  const text = parsed.title;
  if (!text) return;
  // Sin @categoría, hereda la del filtro activo (si hay una elegida).
  const category = parsed.category || (categoryFilter && categoryFilter !== 'none' ? categoryFilter : null);
  data.tasks.push({ id: newId(), title: text, date: date || null, done: false, priority: 'media', notes: '', category });
  save();
  render();
}

function updateTask(id, patch) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;
  Object.assign(task, patch);
  save();
  render();
}

function deleteTask(id) {
  data.tasks = data.tasks.filter((t) => t.id !== id);
  save();
  render();
}

function setItemDone(item, done) {
  // La mascota gana experiencia (una vez por tarea y día, ver pet.js).
  if (done && !item.done && window.mdPet) window.mdPet.gain('task', `home:${item.task.id}|${item.date}`);
  if (item.recurring) {
    const dates = new Set(item.task.doneDates || []);
    if (done) dates.add(item.date); else dates.delete(item.date);
    updateTask(item.task.id, { doneDates: Array.from(dates) });
  } else {
    updateTask(item.task.id, { done });
  }
}

// Saca una sola repetición de la serie (la agrega a skipDates).
function skipOccurrence(item) {
  const skips = new Set(item.task.skipDates || []);
  skips.add(item.date);
  const doneDates = (item.task.doneDates || []).filter((d) => d !== item.date);
  updateTask(item.task.id, { skipDates: Array.from(skips), doneDates });
}

// Mover una tarea de día. Si es una repetición, se "desprende" de la serie:
// se saca ese día de la serie y se crea una tarea común en el día nuevo.
function moveItem(item, newDate) {
  if (!item.recurring) {
    updateTask(item.task.id, { date: newDate });
    return;
  }
  if (newDate === item.date) return;
  const t = item.task;
  data.tasks.push({
    id: newId(), title: t.title, date: newDate, done: item.done, priority: t.priority,
    notes: t.notes || '', time: t.time || null, remind: t.remind != null ? t.remind : null,
    advance: t.advance || []
  });
  skipOccurrence(item);
}

function findItem(taskId, dateIso) {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  if (task.repeat && task.repeat.freq) return { task, date: dateIso, done: (task.doneDates || []).includes(dateIso), recurring: true };
  return itemFor(task);
}

// Tareas comunes sin terminar con fecha anterior a hoy (las repeticiones
// pasadas no cuentan: una tarea diaria llenaría la lista sola).
function overdueTasks() {
  const today = todayIso();
  return data.tasks.filter((t) => !(t.repeat && t.repeat.freq) && t.date && t.date < today && !t.done);
}

// Ánimo de la mascota: preocupada si hay atrasadas (Home + tareas de notas).
function overdueCount() {
  const today = todayIso();
  const notes = noteItems.filter((it) => !it.done && it.date < today).length;
  return overdueTasks().length + notes;
}

function updatePetMood() {
  if (window.mdPet) window.mdPet.setOverdue(overdueCount());
}

function itemsInRange(fromIso, toIso) {
  const items = [];
  for (let d = parseIso(fromIso); iso(d) <= toIso; d = addDays(d, 1)) items.push(...occurrencesOn(iso(d)));
  return items;
}

// ---- recordatorios ----

const MAX_ADVANCE_DAYS = 30; // hasta cuántos días hacia adelante se buscan avisos anticipados
let dbReminderItems = []; // filas de bases de datos cuya columna Fecha tiene avisos configurados

function formatWhen(dateIso, time) {
  const text = parseIso(dateIso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const cap = text.charAt(0).toUpperCase() + text.slice(1);
  return time ? `${cap} a las ${time}` : cap;
}

// Título de la notificación según cuántos días faltan.
function reminderTitle(days, title, time) {
  if (days === 0) return time ? `Hoy a las ${time}: ${title}` : `Hoy: ${title}`;
  if (days === 1) return `Mañana: ${title}`;
  if (days === 7) return `Falta 1 semana para ${title}`;
  if (days === 14) return `Faltan 2 semanas para ${title}`;
  if (days === 30) return `Falta 1 mes para ${title}`;
  return `Faltan ${days} días para ${title}`;
}

function atTime(dateIso, hhmm, minusMinutes) {
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
function remindersFiringToday() {
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
const WEEK_DAYS = 7;

function weekBeforeReminders(today) {
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

// ---- aviso en pantalla + acciones (hecho / posponer) ----
// Las notificaciones del sistema en Linux no pueden llevar botones (Electron
// solo los soporta en macOS), así que cada aviso también aparece como una
// tarjeta dentro de MK, abajo a la derecha, con las acciones.

const SNOOZE_OPTIONS = [
  { label: '10 min', ms: 10 * 60 * 1000 },
  { label: '1 hora', ms: 60 * 60 * 1000 },
  { label: 'Mañana 9:00', tomorrowAt: '09:00' }
];

let toastHost = null;

function openSource(source) {
  if (window.mdEditor.focusWindow) window.mdEditor.focusWindow();
  if (source && source.kind === 'db') {
    if (window.mdDatabase) window.mdDatabase.open(source.databaseId);
  } else if (source && source.kind === 'note') {
    window.openFileAtPath(source.item.filePath);
  } else {
    open();
  }
}

async function markSourceDone(source) {
  if (!source) return;
  if (source.kind === 'home') {
    const item = findItem(source.taskId, source.date);
    if (item && !item.done) setItemDone(item, true);
  } else if (source.kind === 'note') {
    if (!source.item.done) await toggleNoteItem(source.item);
  } else if (source.kind === 'db' && source.doneColumnId && window.mdState.rootFolder) {
    await window.mdEditor.db.setCell(window.mdState.rootFolder, source.rowId, source.doneColumnId, '1');
    await loadDbReminders();
  }
}

function snoozeReminder(r, option) {
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

function showReminderToast(r) {
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
  const canComplete = r.source && (r.source.kind === 'home' || r.source.kind === 'note' || r.source.doneColumnId);
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

function fireReminder(r) {
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
function itemLine(title, time, extra) {
  return `• ${time ? time + ' ' : ''}${title}${extra ? ` (${extra})` : ''}`;
}

function dayItems(dateIso) {
  const lines = [];
  occurrencesOn(dateIso).forEach((it) => { if (!it.done) lines.push(itemLine(it.task.title, it.task.time)); });
  noteItemsOn(dateIso).forEach((it) => { if (!it.done) lines.push(itemLine(it.title, null, 'nota')); });
  dbItemsOn(dateIso).forEach((it) => { if (!it.done) lines.push(itemLine(it.title, null, it.databaseName)); });
  return lines;
}

function dailySummaryText(today) {
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

function checkDailySummary(now, today) {
  const daily = window.mdMail && window.mdMail.getDaily();
  if (!daily || !daily.on) return false;
  const key = `${today}|mail-summary`;
  if (data.notified[key] || now < atTime(today, daily.time)) return false;
  data.notified[key] = true;
  const { subject, text } = dailySummaryText(today);
  window.mdMail.notify(subject, text);
  return true;
}

function checkReminders() {
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
async function loadDbReminders() {
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

// ---- filas de bases de datos con fecha (solo lectura) ----

async function loadDbItems() {
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

function dbItemsOn(dateIso) {
  return dbItems.filter((it) => it.date === dateIso);
}

// ---- tareas escritas en las notas (.md) con fecha ----
// Cualquier "- [ ] texto 📅 2026-10-03" (o "* [x] ...") en un archivo de la
// carpeta abierta aparece ese día en el calendario. Tildarla desde el Home
// reescribe esa línea del archivo, igual que el Kanban en modo carpeta.

async function loadNoteItems() {
  noteItems = [];
  const root = window.mdState.rootFolder;
  if (!root || !data.showNotes) return;
  try {
    const files = await window.mdEditor.kanbanReadFolderFiles(root);
    files.forEach((f) => { noteItems.push(...parseNoteTasks(f.path, f.content)); });
  } catch {
    noteItems = [];
  }
}

function noteItemsOn(dateIso) {
  return noteItems.filter((it) => it.date === dateIso);
}

// Reescribe la línea de una tarea de nota con fn(match) → línea nueva (o
// null si la línea ya no está). Busca por contenido si el archivo cambió.
function rewriteLine(text, item, fn) {
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
async function editNoteItem(item, fn) {
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

function toggleNoteItem(item) {
  if (!item.done && window.mdPet) window.mdPet.gain('task', `note:${item.filePath}|${item.title}|${item.date}`);
  return editNoteItem(item, ([, pre, mark, post, rest1, date, rest2]) =>
    `${pre}${mark.trim() ? ' ' : 'x'}${post}${rest1} 📅 ${date}${rest2}`);
}

// Arrastrar una tarea de nota a otro día cambia su "📅 fecha" en el archivo;
// soltarla en "Sin fecha" le saca la fecha (deja de aparecer en el Home).
function moveNoteItem(item, newDate) {
  return editNoteItem(item, ([, pre, mark, post, rest1, , rest2]) =>
    `${pre}${mark}${post}${rest1}${newDate ? ` 📅 ${newDate}` : ''}${rest2}`);
}

// ---- nota enlazada a una tarea ----

async function openLinkedNote(name) {
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
async function noteNames() {
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

// ---- Pomodoro sobre una tarea ----

function startPomodoroFor(item) {
  if (!window.mdPomodoro || !window.mdPomodoro.startFor) return;
  const task = item.task;
  window.mdPomodoro.startFor(task.title, () => {
    const t = data.tasks.find((x) => x.id === task.id);
    if (!t) return false;
    t.pomodoros = (t.pomodoros || 0) + 1;
    save();
    render();
    const current = findItem(t.id, item.date);
    if (current && !current.done && confirm(`🍅 Terminó el foco de "${t.title}".\n\n¿La marcás como hecha?`)) {
      setItemDone(current, true);
      return false; // tarea terminada: el Pomodoro sigue, pero ya sin tarea asociada
    }
    return true;
  });
  close();
}

// ---- plan de hoy → nota diaria ----

function todayPlanLines() {
  const today = todayIso();
  const lines = occurrencesOn(today).map((it) =>
    `- [${it.done ? 'x' : ' '}] ${it.task.time ? it.task.time + ' ' : ''}${it.task.title}${it.task.note ? ` ([[${it.task.note}]])` : ''}`);
  noteItemsOn(today).forEach((it) => lines.push(`- [${it.done ? 'x' : ' '}] ${it.title}`));
  dbItemsOn(today).forEach((it) => lines.push(`- [${it.done ? 'x' : ' '}] ${it.title} (${it.databaseName})`));
  return lines;
}

async function sendPlanToDailyNote() {
  if (!window.mdState.rootFolder) {
    alert('Abrí una carpeta primero: la nota diaria se guarda dentro de ella.');
    return;
  }
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

// ---- helpers de DOM ----

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Días (semana), celdas (mes) y "Sin fecha" aceptan tres cosas arrastradas:
// tareas del Home, tareas "📅" de notas (se reescribe la fecha en el
// archivo) y filas de bases de datos (se cambia su columna Fecha).
const DROP_MIMES = [DRAG_MIME, NOTE_DRAG_MIME, DB_DRAG_MIME];

function makeDropTarget(node, getDate) {
  const accepts = (e) => DROP_MIMES.some((m) => e.dataTransfer.types.includes(m));
  node.addEventListener('dragover', (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    node.classList.add('drag-over');
  });
  node.addEventListener('dragleave', (e) => {
    if (!node.contains(e.relatedTarget)) node.classList.remove('drag-over');
  });
  node.addEventListener('drop', async (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.stopPropagation();
    node.classList.remove('drag-over');
    const date = getDate();
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      const [taskId, fromDate] = e.dataTransfer.getData(DRAG_MIME).split('|');
      const item = findItem(taskId, fromDate || null);
      if (item) moveItem(item, date);
    } else if (e.dataTransfer.types.includes(NOTE_DRAG_MIME)) {
      const ref = JSON.parse(e.dataTransfer.getData(NOTE_DRAG_MIME));
      const item = noteItems.find((it) => it.filePath === ref.filePath && it.raw === ref.raw);
      if (item && item.date !== date) await moveNoteItem(item, date);
    } else {
      const ref = JSON.parse(e.dataTransfer.getData(DB_DRAG_MIME));
      if (ref.date === date || !window.mdState.rootFolder) return;
      await window.mdEditor.db.setCell(window.mdState.rootFolder, ref.rowId, ref.columnId, date);
      await Promise.all([loadDbItems(), loadDbReminders()]);
      render();
    }
  });
}

// Input de "+ Agregar tarea": Enter agrega y deja el input listo para otra,
// Escape lo vacía.
function quickAddInput(date, placeholder) {
  const input = el('input', 'home-quick-add');
  input.placeholder = placeholder || '+ Agregar tarea';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = input.value;
      input.value = '';
      addTask(value, date);
      const again = mainEl.querySelector(`.home-quick-add[data-date="${date || ''}"]`) ||
        sideEl.querySelector(`.home-quick-add[data-date="${date || ''}"]`);
      if (again) again.focus();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      input.value = '';
      input.blur();
    }
  });
  input.dataset.date = date || '';
  return input;
}

function taskCard(item, compact) {
  const task = item.task;
  const card = el('div', 'home-task' + (item.done ? ' home-task-done' : '') + (compact ? ' home-task-compact' : ''));
  card.style.borderLeftColor = priorityColor(task);
  card.draggable = true;
  const details = [
    task.time ? `Hora: ${task.time}` : '',
    item.recurring ? `Se repite: ${(REPEAT_OPTIONS.find((o) => o.value === task.repeat.freq) || {}).label}` : '',
    task.remind != null && task.time ? `Aviso: ${(REMIND_OPTIONS.find((o) => o.value === String(task.remind)) || {}).label}` : '',
    task.notes || ''
  ].filter(Boolean).join('\n');
  card.title = details ? `${task.title}\n\n${details}` : task.title;
  card.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, `${task.id}|${item.date || ''}`);
  });

  const box = el('input');
  box.type = 'checkbox';
  box.checked = item.done;
  box.setAttribute('aria-label', `Hecha: ${task.title}`);
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => setItemDone(item, box.checked));
  card.appendChild(box);

  if (task.time) card.appendChild(el('span', 'home-task-time', task.time));
  const titleEl = el('span', 'home-task-title', task.title);
  titleEl.title = 'Doble clic: renombrar';
  titleEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    clearTimeout(card._clickTimer);
    startInlineRename(card, titleEl, task);
  });
  card.appendChild(titleEl);
  const cat = categoryById(task.category);
  if (cat) {
    const chip = el('span', 'home-task-cat', cat.name);
    chip.style.setProperty('--cat', cat.color);
    chip.title = `Categoría: ${cat.name}`;
    card.appendChild(chip);
    card.dataset.category = cat.id;
  }
  const badges = (item.recurring ? '🔁' : '') + ((task.remind != null && task.time) || (task.advance && task.advance.length) ? '🔔' : '') + (task.pomodoros ? `🍅${task.pomodoros}` : '');
  if (badges) card.appendChild(el('span', 'home-task-badges', badges));
  if (task.note) {
    const link = el('button', 'home-task-note', '📄');
    link.title = `Abrir la nota "${task.note}"`;
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      openLinkedNote(task.note);
    });
    card.appendChild(link);
  }
  // Clic abre el editor, pero con un pequeño retraso: si llega un doble clic
  // sobre el título (renombrar) se cancela, así no se abren las dos cosas.
  card.addEventListener('click', (e) => {
    if (card.classList.contains('home-task-renaming')) return;
    clearTimeout(card._clickTimer);
    if (e.detail > 1) return;
    card._clickTimer = setTimeout(() => openTaskEditor(item), CLICK_DELAY_MS);
  });
  return card;
}

// Renombrar en el lugar: el título se vuelve un input. Enter / clic afuera
// guarda, Escape cancela.
function startInlineRename(card, titleEl, task) {
  card.classList.add('home-task-renaming');
  card.draggable = false;
  const input = el('input', 'home-task-rename');
  input.value = task.title;
  titleEl.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (commit && value && value !== task.title) updateTask(task.id, { title: value });
    else render();
  };
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function noteChip(item) {
  const chip = el('div', 'home-note-item' + (item.done ? ' home-task-done' : ''));
  const box = el('input');
  box.type = 'checkbox';
  box.checked = item.done;
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => toggleNoteItem(item));
  chip.appendChild(box);
  chip.appendChild(el('span', 'home-task-title', item.title));
  const fileName = item.filePath.split(/[\\/]/).pop();
  chip.title = `${item.title}\nNota: ${fileName}\n(clic para abrirla · arrastrá para cambiar el día)`;
  chip.draggable = true;
  chip.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(NOTE_DRAG_MIME, JSON.stringify({ filePath: item.filePath, raw: item.raw }));
  });
  chip.addEventListener('click', async (e) => {
    e.stopPropagation();
    close();
    await window.openFileAtPath(item.filePath);
  });
  return chip;
}

function dbChip(item) {
  const chip = el('div', 'home-db-item' + (item.done ? ' home-task-done' : ''), item.title);
  chip.title = `${item.title}\nBase de datos: ${item.databaseName}\n(clic para abrirla · arrastrá para cambiar la fecha)`;
  chip.draggable = true;
  chip.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DB_DRAG_MIME, JSON.stringify({ rowId: item.rowId, columnId: item.columnId, date: item.date }));
  });
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
    if (window.mdDatabase) window.mdDatabase.open(item.databaseId);
  });
  return chip;
}

function progressBar(tasks) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const wrap = el('div', 'home-progress');
  const bar = el('div', 'home-progress-bar');
  const fill = el('div', 'home-progress-fill');
  fill.style.width = pct + '%';
  bar.appendChild(fill);
  wrap.appendChild(bar);
  wrap.appendChild(el('div', 'home-progress-label', total ? `${done} de ${total} tareas hechas (${pct}%)` : 'Sin tareas en este período'));
  return wrap;
}

// ---- panel lateral: objetivos, notas, atrasadas, sin fecha ----

function renderSide(periodTasks) {
  sideEl.innerHTML = '';
  const key = periodKey();
  const ofPeriod = mode === 'week' ? 'de la semana' : 'del mes';

  sideEl.appendChild(el('div', 'home-side-title', `Progreso ${ofPeriod}`));
  sideEl.appendChild(progressBar(periodTasks));
  const planBtn = el('button', 'toolbar-button home-small-button home-plan-button', '📝 Plan de hoy → nota diaria');
  planBtn.title = 'Copia las tareas de hoy como checklist en la nota diaria (sección "Plan del día")';
  planBtn.addEventListener('click', sendPlanToDailyNote);
  sideEl.appendChild(planBtn);

  // Objetivos del período
  sideEl.appendChild(el('div', 'home-side-title', `Objetivos ${ofPeriod}`));
  const goals = data.goals[key] || [];
  const goalList = el('div', 'home-goal-list');
  goals.forEach((goal) => {
    const row = el('div', 'home-goal' + (goal.done ? ' home-task-done' : ''));
    const box = el('input');
    box.type = 'checkbox';
    box.checked = !!goal.done;
    box.addEventListener('change', () => { goal.done = box.checked; save(); render(); });
    row.appendChild(box);
    row.appendChild(el('span', 'home-goal-text', goal.text));
    const del = el('button', 'home-icon-button', '×');
    del.title = 'Quitar objetivo';
    del.addEventListener('click', () => {
      data.goals[key] = goals.filter((g) => g.id !== goal.id);
      save();
      render();
    });
    row.appendChild(del);
    goalList.appendChild(row);
  });
  sideEl.appendChild(goalList);
  const goalInput = el('input', 'home-quick-add');
  goalInput.placeholder = '+ Agregar objetivo';
  goalInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !goalInput.value.trim()) return;
    data.goals[key] = [...goals, { id: newId(), text: goalInput.value.trim(), done: false }];
    save();
    render();
    const again = sideEl.querySelector('.home-goal-input');
    if (again) again.focus();
  });
  goalInput.classList.add('home-goal-input');
  sideEl.appendChild(goalInput);

  // Notas del período
  sideEl.appendChild(el('div', 'home-side-title', 'Notas'));
  const notes = el('textarea', 'home-notes');
  notes.placeholder = `Ideas, pendientes o reflexión ${ofPeriod}...`;
  notes.value = data.notes[key] || '';
  notes.addEventListener('input', () => {
    if (notes.value) data.notes[key] = notes.value; else delete data.notes[key];
    save();
  });
  sideEl.appendChild(notes);

  // Atrasadas
  const overdue = overdueTasks().filter(matchesFilter);
  if (overdue.length) {
    const titleRow = el('div', 'home-side-title home-side-title-row');
    titleRow.appendChild(el('span', 'home-overdue-title', `Atrasadas (${overdue.length})`));
    const moveAll = el('button', 'toolbar-button home-small-button', 'Pasar a hoy');
    moveAll.title = 'Mover todas las tareas atrasadas a hoy';
    moveAll.addEventListener('click', () => {
      const today = todayIso();
      overdue.forEach((t) => { t.date = today; });
      save();
      render();
    });
    const moveTomorrow = el('button', 'toolbar-button home-small-button', 'A mañana');
    moveTomorrow.title = 'Mover todas las tareas atrasadas a mañana';
    moveTomorrow.addEventListener('click', () => {
      const tomorrow = iso(addDays(new Date(), 1));
      overdue.forEach((t) => { t.date = tomorrow; });
      save();
      render();
    });
    const btns = el('span', 'home-side-buttons');
    btns.append(moveAll, moveTomorrow);
    titleRow.appendChild(btns);
    sideEl.appendChild(titleRow);
    const list = el('div', 'home-task-list');
    overdue.sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
      const card = taskCard(itemFor(t));
      card.appendChild(el('span', 'home-task-date', parseIso(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })));
      list.appendChild(card);
    });
    sideEl.appendChild(list);
  }

  // Sin fecha (backlog): se puede arrastrar desde/hacia los días
  sideEl.appendChild(el('div', 'home-side-title', 'Sin fecha'));
  const backlog = el('div', 'home-task-list home-backlog');
  data.tasks.filter((t) => !t.date && matchesFilter(t)).forEach((t) => backlog.appendChild(taskCard(itemFor(t))));
  makeDropTarget(backlog, () => null);
  sideEl.appendChild(backlog);
  sideEl.appendChild(quickAddInput(null, '+ Tarea sin fecha'));
}

// ---- vista semana ----

function renderWeek() {
  const monday = mondayOf(cursor);
  const sunday = addDays(monday, 6);
  const today = todayIso();
  rangeLabel.textContent = `Semana ${isoWeekNumber(monday)} · ` +
    `${monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ` +
    `${sunday.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  renderSide(itemsInRange(iso(monday), iso(sunday)).filter((it) => matchesFilter(it.task)));

  mainEl.innerHTML = '';
  const grid = el('div', 'home-week');
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const dayIso = iso(day);
    const col = el('div', 'home-day' + (dayIso === today ? ' home-today' : '') + (i >= 5 ? ' home-weekend' : ''));
    const header = el('div', 'home-day-header');
    header.appendChild(el('span', 'home-day-name', DAY_NAMES[i]));
    header.appendChild(el('span', 'home-day-number', String(day.getDate())));
    const dayTasks = shownOn(dayIso);
    if (dayTasks.length) {
      header.appendChild(el('span', 'home-day-count', `${dayTasks.filter((t) => t.done).length}/${dayTasks.length}`));
    }
    header.title = formatLong(day);
    col.appendChild(header);

    const list = el('div', 'home-task-list');
    dayTasks.forEach((t) => list.appendChild(taskCard(t)));
    noteItemsOn(dayIso).forEach((it) => list.appendChild(noteChip(it)));
    dbItemsOn(dayIso).forEach((it) => list.appendChild(dbChip(it)));
    col.appendChild(list);
    col.appendChild(quickAddInput(dayIso));
    makeDropTarget(col, () => dayIso);
    grid.appendChild(col);
  }
  mainEl.appendChild(grid);
}

// ---- vista mes (calendario) ----

function renderMonth() {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const today = todayIso();
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  rangeLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);

  renderSide(itemsInRange(iso(first), iso(last)).filter((it) => matchesFilter(it.task)));

  mainEl.innerHTML = '';
  const cal = el('div', 'home-calendar');
  DAY_NAMES.forEach((name) => cal.appendChild(el('div', 'home-calendar-dayname', name)));

  const start = mondayOf(first);
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7);
  const MAX_VISIBLE = 3;
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    const dayIso = iso(day);
    const inMonth = day.getMonth() === cursor.getMonth();
    const cell = el('div', 'home-calendar-cell' + (inMonth ? '' : ' home-calendar-outside') + (dayIso === today ? ' home-today' : ''));

    const num = el('button', 'home-calendar-number', String(day.getDate()));
    num.title = `Ver la semana del ${formatLong(day)}`;
    num.addEventListener('click', (e) => {
      e.stopPropagation();
      cursor = day;
      setMode('week');
    });
    cell.appendChild(num);

    const items = [
      ...shownOn(dayIso).map((it) => taskCard(it, true)),
      ...noteItemsOn(dayIso).map((it) => noteChip(it)),
      ...dbItemsOn(dayIso).map((it) => dbChip(it))
    ];
    items.slice(0, MAX_VISIBLE).forEach((node) => cell.appendChild(node));
    if (items.length > MAX_VISIBLE) {
      const more = el('button', 'home-calendar-more', `+${items.length - MAX_VISIBLE} más`);
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        cursor = day;
        setMode('week');
      });
      cell.appendChild(more);
    }

    // Doble clic en un hueco del día: agregar tarea ahí mismo.
    cell.addEventListener('dblclick', (e) => {
      if (e.target !== cell) return;
      const input = quickAddInput(dayIso, 'Nueva tarea...');
      input.addEventListener('blur', () => input.remove());
      cell.appendChild(input);
      input.focus();
    });
    cell.title = 'Doble clic: agregar tarea · Arrastrá tareas entre días';
    makeDropTarget(cell, () => dayIso);
    cal.appendChild(cell);
  }
  mainEl.appendChild(cal);
}

// ---- editor de tarea ----

function closeTaskEditor() {
  if (editorEl) {
    editorEl.remove();
    editorEl = null;
  }
}

function openTaskEditor(item) {
  const task = item.task;
  closeTaskEditor();
  const modal = el('div', 'modal-overlay palette-overlay');
  const box = el('div', 'command-palette home-editor');
  modal.appendChild(box);

  box.appendChild(el('div', 'backlinks-title', item.recurring ? 'Editar tarea recurrente' : 'Editar tarea'));
  if (item.recurring) {
    box.appendChild(el('div', 'home-editor-hint', 'Los cambios se aplican a todas las repeticiones.'));
  }

  const field = (labelText, input, parent) => {
    const wrap = el('label', 'home-editor-field');
    wrap.appendChild(el('span', null, labelText));
    wrap.appendChild(input);
    (parent || box).appendChild(wrap);
    return input;
  };
  const selectOf = (options, value) => {
    const sel = el('select', 'home-editor-input');
    options.forEach((o) => {
      const opt = el('option', null, o.label);
      opt.value = o.value;
      sel.appendChild(opt);
    });
    sel.value = value;
    return sel;
  };

  const titleInput = field('Título', el('input', 'home-editor-input'));
  titleInput.value = task.title;

  const row1 = el('div', 'home-editor-row');
  box.appendChild(row1);
  const dateInput = field(item.recurring ? 'Empieza' : 'Fecha', el('input', 'home-editor-input'), row1);
  dateInput.type = 'date';
  dateInput.value = task.date || '';
  const timeInput = field('Hora', el('input', 'home-editor-input'), row1);
  timeInput.type = 'time';
  timeInput.value = task.time || '';
  const remindSelect = field('Aviso (según la hora)', selectOf(REMIND_OPTIONS, task.remind != null ? String(task.remind) : ''), row1);

  // Repetición
  const rep = task.repeat || {};
  const row2 = el('div', 'home-editor-row');
  box.appendChild(row2);
  const repeatSelect = field('Repetir', selectOf(REPEAT_OPTIONS, rep.freq || ''), row2);
  const untilInput = field('Hasta (opcional)', el('input', 'home-editor-input'), row2);
  untilInput.type = 'date';
  untilInput.value = rep.until || '';

  const daysWrap = el('div', 'home-editor-days');
  const startWeekday = task.date ? (parseIso(task.date).getDay() + 6) % 7 : 0;
  const selectedDays = new Set(Array.isArray(rep.days) && rep.days.length ? rep.days : [startWeekday]);
  const dayBoxes = DAY_NAMES.map((name, idx) => {
    const lbl = el('label', 'home-editor-day');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = selectedDays.has(idx);
    lbl.append(cb, document.createTextNode(name));
    daysWrap.appendChild(lbl);
    return cb;
  });
  box.appendChild(daysWrap);

  const syncRepeatUi = () => {
    const freq = repeatSelect.value;
    untilInput.closest('.home-editor-field').hidden = !freq;
    daysWrap.hidden = freq !== 'weekly';
    remindSelect.disabled = !timeInput.value;
    if (!timeInput.value) remindSelect.value = '';
  };
  repeatSelect.addEventListener('change', syncRepeatUi);
  timeInput.addEventListener('input', syncRepeatUi);
  syncRepeatUi();

  // Avisos anticipados: "N días antes, a las HH:MM" (ver reminderui.js).
  const advWrap = el('div', 'home-editor-field');
  advWrap.appendChild(el('span', null, 'Avisos anticipados (notificación "Faltan N días para…")'));
  box.appendChild(advWrap);
  const getAdvance = window.mdReminderUI.build(advWrap, task.advance || []);

  const prioSelect = field('Prioridad', selectOf(PRIORITIES, task.priority || 'media'));
  const catSelect = field('Categoría', selectOf([{ value: '', label: 'Sin categoría' }, ...(data.categories || []).map((c) => ({ value: c.id, label: c.name }))], task.category || ''));

  const noteInput = field('Nota enlazada (opcional)', el('input', 'home-editor-input'));
  noteInput.placeholder = 'Nombre de una nota de la carpeta';
  noteInput.value = task.note || '';
  const noteList = el('datalist');
  noteList.id = 'home-note-names';
  noteInput.setAttribute('list', noteList.id);
  box.appendChild(noteList);
  noteNames().then((names) => names.forEach((n) => {
    const opt = el('option');
    opt.value = n;
    noteList.appendChild(opt);
  }));

  const notesInput = field('Notas', el('textarea', 'home-editor-input home-editor-notes'));
  notesInput.value = task.notes || '';

  const actions = el('div', 'home-editor-actions');
  if (item.recurring) {
    const delOne = el('button', 'toolbar-button home-danger', 'Eliminar este día');
    delOne.addEventListener('click', () => {
      closeTaskEditor();
      skipOccurrence(item);
    });
    const delAll = el('button', 'toolbar-button home-danger', 'Eliminar serie');
    delAll.addEventListener('click', () => {
      if (!confirm(`¿Eliminar "${task.title}" y todas sus repeticiones?`)) return;
      closeTaskEditor();
      deleteTask(task.id);
    });
    actions.append(delOne, delAll);
  } else {
    const del = el('button', 'toolbar-button home-danger', 'Eliminar');
    del.addEventListener('click', () => {
      if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
      closeTaskEditor();
      deleteTask(task.id);
    });
    actions.append(del);
  }
  const cancel = el('button', 'toolbar-button', 'Cancelar');
  cancel.addEventListener('click', closeTaskEditor);
  const ok = el('button', 'toolbar-button home-primary', 'Guardar');
  const commit = () => {
    const freq = repeatSelect.value;
    // Una serie necesita fecha de inicio: si no hay, arranca hoy.
    const date = dateInput.value || (freq ? (item.date || todayIso()) : null);
    const days = dayBoxes.map((cb, idx) => (cb.checked ? idx : -1)).filter((i) => i >= 0);
    closeTaskEditor();
    updateTask(task.id, {
      title: titleInput.value.trim() || task.title,
      date,
      time: timeInput.value || null,
      remind: timeInput.value && remindSelect.value !== '' ? Number(remindSelect.value) : null,
      advance: getAdvance(),
      repeat: freq ? { freq, until: untilInput.value || null, days: freq === 'weekly' ? days : undefined } : null,
      priority: prioSelect.value,
      category: catSelect.value || null,
      notes: notesInput.value,
      note: noteInput.value.trim() || null
    });
  };
  ok.addEventListener('click', commit);
  titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  // Reprogramar rápido: esta tarea (o esta repetición) pasa a mañana.
  const tomorrowBtn = el('button', 'toolbar-button', '→ Mañana');
  tomorrowBtn.title = 'Mover esta tarea a mañana (en una recurrente, solo este día)';
  tomorrowBtn.addEventListener('click', () => {
    closeTaskEditor();
    moveItem(item, iso(addDays(new Date(), 1)));
  });
  const pomo = el('button', 'toolbar-button', '⏱ Pomodoro');
  pomo.title = 'Arrancar un Pomodoro sobre esta tarea (al terminar el foco te pregunta si la terminaste)';
  pomo.addEventListener('click', () => {
    closeTaskEditor();
    startPomodoroFor(item);
  });
  actions.append(el('span', 'toolbar-spacer'), tomorrowBtn, pomo, cancel, ok);
  box.appendChild(actions);

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeTaskEditor(); });
  document.body.appendChild(modal);
  editorEl = modal;
  titleInput.focus();
  titleInput.select();
}

// ---- general ----

function render() {
  renderCategoryFilter();
  if (overlay.hidden) return;
  if (mode === 'week') renderWeek(); else renderMonth();
}

function setMode(next) {
  mode = next;
  modeWeekBtn.classList.toggle('home-mode-active', mode === 'week');
  modeMonthBtn.classList.toggle('home-mode-active', mode === 'month');
  render();
}

function shift(delta) {
  if (mode === 'week') cursor = addDays(cursor, delta * 7);
  else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
  render();
}

async function open() {
  overlay.hidden = false;
  await load();
  await Promise.all([loadDbItems(), loadNoteItems(), loadDbReminders()]);
  render();
}

function close() {
  closeTaskEditor();
  overlay.hidden = true;
}

modeWeekBtn.addEventListener('click', () => setMode('week'));
modeMonthBtn.addEventListener('click', () => setMode('month'));
document.getElementById('home-prev').addEventListener('click', () => shift(-1));
document.getElementById('home-next').addEventListener('click', () => shift(1));
document.getElementById('home-today').addEventListener('click', () => { cursor = new Date(); render(); });
document.getElementById('home-close').addEventListener('click', close);
document.getElementById('home-stats-btn').addEventListener('click', openStats);

// ---- filtro y administrador de categorías ----
const catFilterEl = document.getElementById('home-cat-filter');

function renderCategoryFilter() {
  if (!catFilterEl) return;
  const cats = data.categories || [];
  if (categoryFilter && categoryFilter !== 'none' && !categoryById(categoryFilter)) categoryFilter = '';
  catFilterEl.innerHTML = '';
  [{ value: '', label: '🏷 Todas' }, ...cats.map((c) => ({ value: c.id, label: c.name })), { value: 'none', label: 'Sin categoría' }].forEach((o) => {
    const opt = el('option', null, o.label);
    opt.value = o.value;
    catFilterEl.appendChild(opt);
  });
  catFilterEl.value = categoryFilter;
  const cat = categoryById(categoryFilter);
  catFilterEl.style.borderColor = cat ? cat.color : '';
}

if (catFilterEl) {
  catFilterEl.addEventListener('change', () => {
    categoryFilter = catFilterEl.value;
    render();
  });
}


let catsModal = null;

function closeCategories() {
  if (catsModal) { catsModal.remove(); catsModal = null; }
}

function openCategories() {
  closeCategories();
  const draft = (data.categories || []).map((c) => ({ ...c }));
  const modal = el('div', 'modal-overlay palette-overlay');
  const box = el('div', 'command-palette home-cats');
  modal.appendChild(box);
  box.appendChild(el('div', 'backlinks-title', '🏷 Categorías'));
  box.appendChild(el('div', 'home-editor-hint', 'Con @nombre en "+ Agregar tarea" se asigna sola (ej. "@uni repasar").'));
  const list = el('div', 'home-cats-list');
  box.appendChild(list);
  const drawRows = () => {
    list.innerHTML = '';
    draft.forEach((c, i) => {
      const row = el('div', 'home-cats-row');
      const color = el('input');
      color.type = 'color';
      color.value = c.color;
      color.setAttribute('aria-label', 'Color');
      color.addEventListener('input', () => { c.color = color.value; });
      const name = el('input', 'home-editor-input');
      name.value = c.name;
      name.setAttribute('aria-label', 'Nombre');
      name.addEventListener('input', () => { c.name = name.value; });
      const del = el('button', 'home-icon-button', '×');
      del.title = 'Quitar categoría (sus tareas quedan sin categoría)';
      del.addEventListener('click', () => { draft.splice(i, 1); drawRows(); });
      row.append(color, name, del);
      list.appendChild(row);
    });
  };
  drawRows();
  const add = el('button', 'toolbar-button', '+ Categoría');
  add.addEventListener('click', () => {
    draft.push({ id: newId(), name: 'Nueva', color: '#64748b' });
    drawRows();
    const inputs = list.querySelectorAll('.home-cats-row input.home-editor-input');
    if (inputs.length) inputs[inputs.length - 1].select();
  });
  const actions = el('div', 'home-editor-actions');
  const cancel = el('button', 'toolbar-button', 'Cancelar');
  cancel.addEventListener('click', closeCategories);
  const ok = el('button', 'toolbar-button', 'Guardar');
  ok.addEventListener('click', () => {
    const clean = draft.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim().slice(0, 30) }));
    const ids = new Set(clean.map((c) => c.id));
    data.tasks.forEach((t) => { if (t.category && !ids.has(t.category)) t.category = null; });
    data.categories = clean;
    save();
    closeCategories();
    render();
  });
  actions.append(add, el('span', 'toolbar-spacer'), cancel, ok);
  box.appendChild(actions);
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeCategories(); });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeCategories(); } });
  document.body.appendChild(modal);
  catsModal = modal;
}

document.getElementById('home-cats-btn').addEventListener('click', openCategories);
document.getElementById('btn-home').addEventListener('click', open);
showNotesToggle.addEventListener('change', async () => {
  data.showNotes = showNotesToggle.checked;
  save();
  await loadNoteItems();
  render();
});
weekBeforeToggle.addEventListener('change', () => {
  data.weekBefore = { ...data.weekBefore, on: weekBeforeToggle.checked };
  save();
});
weekBeforeTime.addEventListener('change', () => {
  if (!/^\d{2}:\d{2}$/.test(weekBeforeTime.value)) return;
  data.weekBefore = { ...data.weekBefore, time: weekBeforeTime.value };
  save();
});
showDbToggle.addEventListener('change', async () => {
  data.showDatabases = showDbToggle.checked;
  save();
  await loadDbItems();
  render();
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (statsEl) { closeStats(); return; }
    if (editorEl) { closeTaskEditor(); return; }
    if (!overlay.hidden && !e.defaultPrevented) close();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    if (overlay.hidden) open(); else close();
  }
});

// "Abrir Home al iniciar" (Ajustes): se guarda en la config general.
(async () => {
  const config = await window.mdEditor.getConfig();
  homeInFolder = !!config.homeInFolder;
  inFolderToggle.checked = homeInFolder;
  startupToggle.checked = !!config.homeOnStartup;
  if (config.homeOnStartup) open();
  // Recordatorios: cargar las tareas ya al arrancar (aunque el Home no se
  // abra) y revisar cada 30 s.
  await load();
  await loadDbReminders();
  checkReminders();
  setInterval(() => { rootChanged().then(checkReminders).then(updatePetMood); }, 30000);
  // Las bases de datos pueden cambiar desde su panel: releer cada 2 min.
  setInterval(loadDbReminders, 120000);
})();
const inFolderToggle = document.getElementById('home-in-folder-toggle');
inFolderToggle.addEventListener('change', async () => {
  const enable = inFolderToggle.checked;
  await load();
  if (enable && !window.mdState.rootFolder) {
    alert('Abrí una carpeta primero: el Home se guardaría en <carpeta>/.mk/home.json.');
    inFolderToggle.checked = false;
    return;
  }
  if (!enable && dataRoot) {
    // Vuelve a la configuración de la app con las tareas tal como están ahora.
    clearTimeout(saveTimer);
    await window.mdEditor.homeSave(data, null);
  }
  homeInFolder = enable;
  await window.mdEditor.setConfig({ homeInFolder: enable });
  await rootChanged();
});

startupToggle.addEventListener('change', () => {
  window.mdEditor.setConfig({ homeOnStartup: startupToggle.checked });
});

// ---- estadísticas (📈 en la cabecera del Home) ----

// Días seguidos, hacia atrás desde hoy, en los que la tarea recurrente se
// cumplió cada vez que tocaba. Si hoy le toca y todavía no está hecha, se
// empieza a contar desde ayer (el día no terminó).
function habitStreak(task) {
  let streak = 0;
  let d = new Date();
  const today = todayIso();
  if (occursOn(task, today) && !(task.doneDates || []).includes(today)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    const di = iso(d);
    if (task.date && di < task.date) break;
    if (!occursOn(task, di)) continue;
    if ((task.doneDates || []).includes(di)) streak++;
    else break;
  }
  return streak;
}

function computeStats() {
  const today = todayIso();
  const monday = mondayOf(new Date());
  const weekItems = itemsInRange(iso(monday), iso(addDays(monday, 6)));
  const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const monthItems = itemsInRange(iso(first), iso(last));

  // Últimas 8 semanas (lunes a domingo): tareas hechas vs. planificadas.
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const from = addDays(monday, -7 * w);
    const items = itemsInRange(iso(from), iso(addDays(from, 6)));
    weeks.push({ label: from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), done: items.filter((i) => i.done).length, total: items.length });
  }

  // Racha: días seguidos (hasta hoy, o ayer si hoy todavía no hiciste nada) con ≥1 tarea hecha.
  let streak = 0;
  let d = new Date();
  if (!occurrencesOn(today).some((i) => i.done)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (occurrencesOn(iso(d)).some((it) => it.done)) streak++;
    else break;
  }

  const pendingByPriority = PRIORITIES.map((p) => ({
    label: p.label,
    color: p.color, // mismo color que el borde de las tarjetas
    value: data.tasks.filter((t) => !(t.repeat && t.repeat.freq) && !t.done && (t.priority || 'media') === p.value).length
  }));

  const from30 = iso(addDays(new Date(), -29));
  const habits = data.tasks.filter((t) => t.repeat && t.repeat.freq).map((t) => {
    const occ = itemsInRange(from30, today).filter((it) => it.task.id === t.id);
    return {
      title: t.title,
      streak: habitStreak(t),
      done30: occ.filter((it) => it.done).length,
      total30: occ.length
    };
  });

  return {
    week: { done: weekItems.filter((i) => i.done).length, total: weekItems.length },
    month: { done: monthItems.filter((i) => i.done).length, total: monthItems.length },
    overdue: overdueTasks().length,
    streak,
    weeks,
    pendingByPriority,
    habits
  };
}

let statsEl = null;

function closeStats() {
  if (statsEl) { statsEl.remove(); statsEl = null; }
}

function openStats() {
  closeStats();
  const s = computeStats();
  const modal = el('div', 'modal-overlay palette-overlay');
  const box = el('div', 'command-palette home-stats');
  modal.appendChild(box);
  const head = el('div', 'home-stats-head');
  head.appendChild(el('div', 'home-stats-title', '📈 Estadísticas'));
  const x = el('button', 'toolbar-button', '×');
  x.addEventListener('click', closeStats);
  head.appendChild(x);
  box.appendChild(head);

  // Números grandes: lo que se lee de un vistazo.
  const tiles = el('div', 'home-stats-tiles');
  const pct = (o) => (o.total ? Math.round((o.done / o.total) * 100) : 0);
  [
    ['Esta semana', `${s.week.done}/${s.week.total}`, s.week.total ? `${pct(s.week)}% hechas` : 'sin tareas'],
    ['Este mes', `${s.month.done}/${s.month.total}`, s.month.total ? `${pct(s.month)}% hechas` : 'sin tareas'],
    ['Racha', `${s.streak}`, s.streak === 1 ? 'día seguido con algo hecho' : 'días seguidos con algo hecho'],
    ['Atrasadas', `${s.overdue}`, s.overdue ? 'para reprogramar' : '¡al día!']
  ].forEach(([label, value, sub]) => {
    const t = el('div', 'home-stat-tile');
    t.append(el('div', 'home-stat-label', label), el('div', 'home-stat-value', value), el('div', 'home-stat-sub', sub));
    tiles.appendChild(t);
  });
  box.appendChild(tiles);

  const charts = el('div', 'home-stats-charts');
  const weekBlock = el('div', 'home-stats-block');
  weekBlock.appendChild(el('div', 'home-stats-subtitle', 'Tareas hechas por semana (últimas 8)'));
  const weekHost = el('div');
  weekBlock.appendChild(weekHost);
  const prioBlock = el('div', 'home-stats-block');
  prioBlock.appendChild(el('div', 'home-stats-subtitle', 'Pendientes por prioridad'));
  const prioHost = el('div');
  prioBlock.appendChild(prioHost);
  charts.append(weekBlock, prioBlock);
  box.appendChild(charts);


  if (s.habits.length) {
    const habitsBlock = el('div', 'home-stats-block');
    habitsBlock.appendChild(el('div', 'home-stats-subtitle', 'Hábitos (tareas recurrentes)'));
    const table = el('table', 'home-stats-habits');
    const hr = el('tr');
    ['Hábito', 'Racha', 'Últimos 30 días'].forEach((h) => hr.appendChild(el('th', null, h)));
    table.appendChild(hr);
    s.habits.forEach((h) => {
      const tr = el('tr');
      const rate = h.total30 ? Math.round((h.done30 / h.total30) * 100) : 0;
      const bar = el('div', 'home-progress-bar');
      const fill = el('div', 'home-progress-fill');
      fill.style.width = rate + '%';
      bar.appendChild(fill);
      const rateCell = el('td');
      rateCell.append(bar, el('span', 'home-stat-sub', `${h.done30} de ${h.total30} (${rate}%)`));
      tr.append(el('td', null, h.title), el('td', null, h.streak ? `🔥 ${h.streak}` : '—'), rateCell);
      table.appendChild(tr);
    });
    habitsBlock.appendChild(table);
    box.appendChild(habitsBlock);
  }

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeStats(); });
  document.body.appendChild(modal);
  statsEl = modal;
  // Recién ahora (con el ancho real) se dibujan los gráficos.
  window.mdCharts.render(weekHost, { type: 'bar', time: true, data: s.weeks.map((w) => ({ label: w.label, value: w.done })), valueLabel: 'hechas', labelTitle: 'Semana del', emptyText: 'Todavía no hay tareas.' });
  window.mdCharts.render(prioHost, { type: 'pie', data: s.pendingByPriority.filter((p) => p.value > 0), valueLabel: 'pendientes', labelTitle: 'Prioridad', emptyText: 'No hay tareas pendientes.' });
}

// Búsqueda global (search.js): tareas del Home por título y notas.
async function searchTasks(query) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  await load();
  return data.tasks
    .filter((t) => (t.title || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))
    .slice(0, 50)
    .map((t) => ({ id: t.id, title: t.title, date: t.date, recurring: !!(t.repeat && t.repeat.freq), done: !!t.done, notes: t.notes || '' }));
}

// Abrir el Home en la semana de la tarea, con su editor abierto.
async function revealTask(id) {
  await open();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;
  if (task.date) cursor = parseIso(task.date);
  setMode('week');
  openTaskEditor(task.date ? findItem(task.id, task.date) : itemFor(task));
}

window.mdHome = { openCategories, setCategoryFilter: (v) => { categoryFilter = v || ''; render(); }, parseCategoryToken, overdueCount, updatePetMood, dailySummaryText, weekBeforeReminders, open, close, setMode, checkReminders, searchTasks, revealTask, computeStats, openStats, rootChanged, dataLocation: () => dataRoot, getSnoozes: () => data.snoozes, loadDbReminders, remindersFiringToday, sendPlanToDailyNote, parseNoteTasks };

})();
