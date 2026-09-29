(function () {
'use strict';

// Pestaña "Home": planificador semanal y mensual con calendario. Las tareas
// y objetivos son personales (no de una carpeta), así que viven en
// <userData>/home.json vía IPC (home:load / home:save, ver main.js) y el
// Home funciona aunque no haya carpeta abierta. Si SÍ hay carpeta, además
// muestra (solo lectura) las filas de las bases de datos que tengan una
// columna de tipo Fecha — clic en una lleva a esa base (ver database.js).

const overlay = document.getElementById('home-panel');
const sideEl = document.getElementById('home-side');
const mainEl = document.getElementById('home-main');
const rangeLabel = document.getElementById('home-range-label');
const modeWeekBtn = document.getElementById('home-mode-week');
const modeMonthBtn = document.getElementById('home-mode-month');
const showDbToggle = document.getElementById('home-show-db');
const startupToggle = document.getElementById('home-startup-toggle');
const DRAG_MIME = 'application/x-mk-home-task';

const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: '#ef476f' },
  { value: 'media', label: 'Media', color: '#f2cc8f' },
  { value: 'baja', label: 'Baja', color: '#81b29a' }
];
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

let data = { tasks: [], goals: {}, notes: {}, showDatabases: true };
let loaded = false;
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

async function load() {
  if (loaded) return;
  const stored = await window.mdEditor.homeLoad();
  if (stored && typeof stored === 'object') {
    data = {
      tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
      goals: stored.goals && typeof stored.goals === 'object' ? stored.goals : {},
      notes: stored.notes && typeof stored.notes === 'object' ? stored.notes : {},
      showDatabases: stored.showDatabases !== false
    };
  }
  showDbToggle.checked = data.showDatabases;
  loaded = true;
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.mdEditor.homeSave(data), 300);
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- tareas ----

function tasksOn(dateIso) {
  return data.tasks
    .filter((t) => t.date === dateIso)
    .sort((a, b) => Number(a.done) - Number(b.done) || priorityRank(a) - priorityRank(b));
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

// Tareas sin terminar con fecha anterior a hoy.
function overdueTasks() {
  const today = todayIso();
  return data.tasks.filter((t) => t.date && t.date < today && !t.done);
}

function tasksInRange(fromIso, toIso) {
  return data.tasks.filter((t) => t.date && t.date >= fromIso && t.date <= toIso);
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
    updateTask(e.dataTransfer.getData(DRAG_MIME), { date: getDate() });
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

function taskCard(task, compact) {
  const card = el('div', 'home-task' + (task.done ? ' home-task-done' : '') + (compact ? ' home-task-compact' : ''));
  card.style.borderLeftColor = priorityColor(task);
  card.draggable = true;
  card.title = task.notes ? `${task.title}\n\n${task.notes}` : task.title;
  card.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, task.id);
  });

  const box = el('input');
  box.type = 'checkbox';
  box.checked = !!task.done;
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => updateTask(task.id, { done: box.checked }));
  card.appendChild(box);

  card.appendChild(el('span', 'home-task-title', task.title));
  card.addEventListener('click', () => openTaskEditor(task));
  return card;
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
      const card = taskCard(t);
      card.appendChild(el('span', 'home-task-date', parseIso(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })));
      list.appendChild(card);
    });
    sideEl.appendChild(list);
  }

  // Sin fecha (backlog): se puede arrastrar desde/hacia los días
  sideEl.appendChild(el('div', 'home-side-title', 'Sin fecha'));
  const backlog = el('div', 'home-task-list home-backlog');
  data.tasks.filter((t) => !t.date).forEach((t) => backlog.appendChild(taskCard(t)));
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

  renderSide(tasksInRange(iso(monday), iso(sunday)));

  mainEl.innerHTML = '';
  const grid = el('div', 'home-week');
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const dayIso = iso(day);
    const col = el('div', 'home-day' + (dayIso === today ? ' home-today' : '') + (i >= 5 ? ' home-weekend' : ''));
    const header = el('div', 'home-day-header');
    header.appendChild(el('span', 'home-day-name', DAY_NAMES[i]));
    header.appendChild(el('span', 'home-day-number', String(day.getDate())));
    const dayTasks = tasksOn(dayIso);
    if (dayTasks.length) {
      header.appendChild(el('span', 'home-day-count', `${dayTasks.filter((t) => t.done).length}/${dayTasks.length}`));
    }
    header.title = formatLong(day);
    col.appendChild(header);

    const list = el('div', 'home-task-list');
    dayTasks.forEach((t) => list.appendChild(taskCard(t)));
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

  renderSide(tasksInRange(iso(first), iso(last)));

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
      ...tasksOn(dayIso).map((t) => taskCard(t, true)),
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

function openTaskEditor(task) {
  closeTaskEditor();
  const modal = el('div', 'modal-overlay palette-overlay');
  const box = el('div', 'command-palette home-editor');
  modal.appendChild(box);

  box.appendChild(el('div', 'backlinks-title', 'Editar tarea'));

  const field = (labelText, input) => {
    const wrap = el('label', 'home-editor-field');
    wrap.appendChild(el('span', null, labelText));
    wrap.appendChild(input);
    box.appendChild(wrap);
    return input;
  };

  const titleInput = field('Título', el('input', 'home-editor-input'));
  titleInput.value = task.title;

  const dateInput = field('Fecha', el('input', 'home-editor-input'));
  dateInput.type = 'date';
  dateInput.value = task.date || '';

  const prioSelect = field('Prioridad', el('select', 'home-editor-input'));
  PRIORITIES.forEach((p) => {
    const opt = el('option', null, p.label);
    opt.value = p.value;
    prioSelect.appendChild(opt);
  });
  prioSelect.value = task.priority || 'media';

  const notesInput = field('Notas', el('textarea', 'home-editor-input home-editor-notes'));
  notesInput.value = task.notes || '';

  const actions = el('div', 'home-editor-actions');
  const del = el('button', 'toolbar-button home-danger', 'Eliminar');
  del.addEventListener('click', () => {
    if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    closeTaskEditor();
    deleteTask(task.id);
  });
  const cancel = el('button', 'toolbar-button', 'Cancelar');
  cancel.addEventListener('click', closeTaskEditor);
  const ok = el('button', 'toolbar-button home-primary', 'Guardar');
  const commit = () => {
    closeTaskEditor();
    updateTask(task.id, {
      title: titleInput.value.trim() || task.title,
      date: dateInput.value || null,
      priority: prioSelect.value,
      notes: notesInput.value
    });
  };
  ok.addEventListener('click', commit);
  titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  actions.append(del, el('span', 'toolbar-spacer'), cancel, ok);
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
  await loadDbItems();
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
})();
startupToggle.addEventListener('change', () => {
  window.mdEditor.setConfig({ homeOnStartup: startupToggle.checked });
});

window.mdHome = { open, close, setMode };

})();
