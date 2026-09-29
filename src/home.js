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
const startupToggle = document.getElementById('home-startup-toggle');
const DRAG_MIME = 'application/x-mk-home-task';

const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: '#ef476f' },
  { value: 'media', label: 'Media', color: '#f2cc8f' },
  { value: 'baja', label: 'Baja', color: '#81b29a' }
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
const REMINDER_GRACE_MS = 10 * 60 * 1000; // avisos atrasados más que esto (app cerrada) se descartan

let data = { tasks: [], goals: {}, notes: {}, showDatabases: true, showNotes: true, notified: {} };
let noteItems = []; // tareas "- [ ] ... 📅 AAAA-MM-DD" encontradas en las notas de la carpeta
let saveTimer = null;
let mode = 'week'; // 'week' | 'month'
let cursor = new Date(); // cualquier día dentro de la semana/mes visible
let dbItems = []; // [{ date, title, done, databaseId, databaseName }]
let editorEl = null;

// ---- fechas (siempre en hora local, formato YYYY-MM-DD) ----

function pad(n) {
  return String(n).padStart(2, '0');
}

function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

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

async function readStored() {
  const stored = await window.mdEditor.homeLoad();
  if (stored && typeof stored === 'object') {
    data = {
      tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
      goals: stored.goals && typeof stored.goals === 'object' ? stored.goals : {},
      notes: stored.notes && typeof stored.notes === 'object' ? stored.notes : {},
      showDatabases: stored.showDatabases !== false,
      showNotes: stored.showNotes !== false,
      notified: stored.notified && typeof stored.notified === 'object' ? stored.notified : {}
    };
  }
  showDbToggle.checked = data.showDatabases;
  showNotesToggle.checked = data.showNotes;
}

// Una sola lectura compartida: el arranque (recordatorios) y open() pueden
// pedirla a la vez.
let loadPromise = null;
function load() {
  if (!loadPromise) loadPromise = readStored();
  return loadPromise;
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.mdEditor.homeSave(data), 300);
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- tareas ----

// Lunes = 0 ... domingo = 6 (igual que DAY_NAMES).
function weekdayIdx(d) {
  return (d.getDay() + 6) % 7;
}

function occursOn(task, dateIso) {
  const rep = task.repeat;
  if (!rep || !rep.freq || !task.date) return false;
  if (dateIso < task.date) return false;
  if (rep.until && dateIso > rep.until) return false;
  if ((task.skipDates || []).includes(dateIso)) return false;
  const d = parseIso(dateIso);
  const start = parseIso(task.date);
  switch (rep.freq) {
    case 'daily': return true;
    case 'weekdays': return weekdayIdx(d) < 5;
    case 'weekly': {
      const days = Array.isArray(rep.days) && rep.days.length ? rep.days : [weekdayIdx(start)];
      return days.includes(weekdayIdx(d));
    }
    case 'monthly': return d.getDate() === start.getDate();
    case 'yearly': return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
    default: return false;
  }
}

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

function addTask(title, date) {
  const text = title.trim();
  if (!text) return;
  data.tasks.push({ id: newId(), title: text, date: date || null, done: false, priority: 'media', notes: '' });
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
    notes: t.notes || '', time: t.time || null, remind: t.remind != null ? t.remind : null
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

function itemsInRange(fromIso, toIso) {
  const items = [];
  for (let d = parseIso(fromIso); iso(d) <= toIso; d = addDays(d, 1)) items.push(...occurrencesOn(iso(d)));
  return items;
}

// ---- recordatorios ----

function reminderKey(item) {
  return `${item.task.id}|${item.date}|${item.task.time}|${item.task.remind}`;
}

function checkReminders() {
  const now = Date.now();
  const today = todayIso();
  let changed = false;
  occurrencesOn(today).forEach((item) => {
    const t = item.task;
    if (item.done || !t.time || t.remind == null) return;
    const [h, m] = t.time.split(':').map(Number);
    const d = parseIso(today);
    d.setHours(h, m - Number(t.remind), 0, 0);
    const at = d.getTime();
    const key = reminderKey(item);
    if (now < at || data.notified[key]) return;
    data.notified[key] = true;
    changed = true;
    if (now - at > REMINDER_GRACE_MS) return;
    try {
      const body = (Number(t.remind) ? `En ${t.remind} min · ` : '') + `${t.time}` + (t.notes ? `\n${t.notes}` : '');
      const n = new Notification(`🗓 ${t.title}`, { body });
      n.onclick = () => open();
    } catch (e) {
      // Notification puede no estar disponible en algunos entornos
    }
  });
  // Solo se guardan los avisos de hoy: los viejos ya no pueden volver a sonar.
  Object.keys(data.notified).forEach((key) => {
    if (key.split('|')[1] !== today) { delete data.notified[key]; changed = true; }
  });
  if (changed) save();
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
            databaseName: (db.icon ? db.icon + ' ' : '') + db.name
          });
        });
      });
    }
  } catch (e) {
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

const NOTE_TASK_RE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*?)\s*📅\s*(\d{4}-\d{2}-\d{2})(.*)$/u;

function parseNoteTasks(filePath, content) {
  const items = [];
  content.split('\n').forEach((line, idx) => {
    const m = line.match(NOTE_TASK_RE);
    if (!m) return;
    const title = (m[4] + ' ' + m[6]).replace(/\s+/g, ' ').trim();
    items.push({ date: m[5], title: title || '(sin texto)', done: m[2].toLowerCase() === 'x', filePath, line: idx, raw: line });
  });
  return items;
}

async function loadNoteItems() {
  noteItems = [];
  const root = window.mdState.rootFolder;
  if (!root || !data.showNotes) return;
  try {
    const files = await window.mdEditor.kanbanReadFolderFiles(root);
    files.forEach((f) => { noteItems.push(...parseNoteTasks(f.path, f.content)); });
  } catch (e) {
    noteItems = [];
  }
}

function noteItemsOn(dateIso) {
  return noteItems.filter((it) => it.date === dateIso);
}

function toggleLine(text, item) {
  const lines = text.split('\n');
  // La línea pudo moverse si el archivo cambió: se busca por contenido.
  let idx = lines[item.line] === item.raw ? item.line : lines.indexOf(item.raw);
  if (idx === -1) return null;
  lines[idx] = lines[idx].replace(NOTE_TASK_RE, (all, pre, mark, post, rest1, date, rest2) =>
    `${pre}${mark.trim() ? ' ' : 'x'}${post}${rest1} 📅 ${date}${rest2}`);
  return lines.join('\n');
}

async function toggleNoteItem(item) {
  const active = window.mdTabs && window.mdTabs.getActiveTabInfo();
  if (active && active.filePath === item.filePath) {
    // Archivo abierto en el editor: se cambia el buffer (autoguardado lo escribe).
    const updated = toggleLine(window.mdCodeMirror.getValue(), item);
    if (updated !== null) window.mdCodeMirror.setValue(updated);
  } else {
    const result = await window.mdEditor.readFile(item.filePath);
    if (!result || result.binary) return;
    const updated = toggleLine(result.content, item);
    if (updated === null) {
      alert('Esa tarea cambió en el archivo desde que se cargó el Home. Volvé a abrirlo.');
    } else {
      await window.mdEditor.saveFile(updated, item.filePath, false);
    }
  }
  await loadNoteItems();
  render();
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
  } catch (e) {
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
    alert('Abrí una carpeta primero: la nota diaria se guarda dentro de ella (Diario/).');
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

function makeDropTarget(node, getDate) {
  node.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    node.classList.add('drag-over');
  });
  node.addEventListener('dragleave', (e) => {
    if (!node.contains(e.relatedTarget)) node.classList.remove('drag-over');
  });
  node.addEventListener('drop', (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    node.classList.remove('drag-over');
    const [taskId, fromDate] = e.dataTransfer.getData(DRAG_MIME).split('|');
    const item = findItem(taskId, fromDate || null);
    if (item) moveItem(item, getDate());
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
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => setItemDone(item, box.checked));
  card.appendChild(box);

  if (task.time) card.appendChild(el('span', 'home-task-time', task.time));
  card.appendChild(el('span', 'home-task-title', task.title));
  const badges = (item.recurring ? '🔁' : '') + (task.remind != null && task.time ? '🔔' : '') + (task.pomodoros ? `🍅${task.pomodoros}` : '');
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
  card.addEventListener('click', () => openTaskEditor(item));
  return card;
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
  chip.title = `${item.title}\nNota: ${fileName}\n(clic para abrirla)`;
  chip.addEventListener('click', async (e) => {
    e.stopPropagation();
    close();
    await window.openFileAtPath(item.filePath);
  });
  return chip;
}

function dbChip(item) {
  const chip = el('div', 'home-db-item' + (item.done ? ' home-task-done' : ''), item.title);
  chip.title = `${item.title}\nBase de datos: ${item.databaseName}\n(clic para abrirla)`;
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
  const overdue = overdueTasks();
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
    titleRow.appendChild(moveAll);
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
  data.tasks.filter((t) => !t.date).forEach((t) => backlog.appendChild(taskCard(itemFor(t))));
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

  renderSide(itemsInRange(iso(monday), iso(sunday)));

  mainEl.innerHTML = '';
  const grid = el('div', 'home-week');
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const dayIso = iso(day);
    const col = el('div', 'home-day' + (dayIso === today ? ' home-today' : '') + (i >= 5 ? ' home-weekend' : ''));
    const header = el('div', 'home-day-header');
    header.appendChild(el('span', 'home-day-name', DAY_NAMES[i]));
    header.appendChild(el('span', 'home-day-number', String(day.getDate())));
    const dayTasks = occurrencesOn(dayIso);
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

  renderSide(itemsInRange(iso(first), iso(last)));

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
      ...occurrencesOn(dayIso).map((it) => taskCard(it, true)),
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
  const remindSelect = field('Aviso', selectOf(REMIND_OPTIONS, task.remind != null ? String(task.remind) : ''), row1);

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

  const prioSelect = field('Prioridad', selectOf(PRIORITIES, task.priority || 'media'));

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
      repeat: freq ? { freq, until: untilInput.value || null, days: freq === 'weekly' ? days : undefined } : null,
      priority: prioSelect.value,
      notes: notesInput.value,
      note: noteInput.value.trim() || null
    });
  };
  ok.addEventListener('click', commit);
  titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  const pomo = el('button', 'toolbar-button', '⏱ Pomodoro');
  pomo.title = 'Arrancar un Pomodoro sobre esta tarea (al terminar el foco te pregunta si la terminaste)';
  pomo.addEventListener('click', () => {
    closeTaskEditor();
    startPomodoroFor(item);
  });
  actions.append(el('span', 'toolbar-spacer'), pomo, cancel, ok);
  box.appendChild(actions);

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeTaskEditor(); });
  document.body.appendChild(modal);
  editorEl = modal;
  titleInput.focus();
  titleInput.select();
}

// ---- general ----

function render() {
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
  await Promise.all([loadDbItems(), loadNoteItems()]);
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
document.getElementById('btn-home').addEventListener('click', open);
showNotesToggle.addEventListener('change', async () => {
  data.showNotes = showNotesToggle.checked;
  save();
  await loadNoteItems();
  render();
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
  startupToggle.checked = !!config.homeOnStartup;
  if (config.homeOnStartup) open();
  // Recordatorios: cargar las tareas ya al arrancar (aunque el Home no se
  // abra) y revisar cada 30 s.
  await load();
  checkReminders();
  setInterval(checkReminders, 30000);
})();
startupToggle.addEventListener('change', () => {
  window.mdEditor.setConfig({ homeOnStartup: startupToggle.checked });
});

window.mdHome = { open, close, setMode, checkReminders, sendPlanToDailyNote, parseNoteTasks };

})();
