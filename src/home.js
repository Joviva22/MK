import { PRIORITIES, addDays, archiveOld, categoryById, checkReminders, cursor, dailySummaryText, data, dataRoot, findItem, iso, itemFor, itemsInRange, load, loadArchive, loadDbItems, loadDbReminders, loadNoteItems, mode, mondayOf, newId, occurrencesOn, occursOn, overdueCount, overdueTasks, parseCategoryToken, parseIso, parseNoteTasks, remindersFiringToday, rootChanged, save, saveTimer, sendPlanToDailyNote, setArchiveDays, setCursor, setItemDone, setMode, showDbToggle, showNotesToggle, todayIso, unarchive, updatePetMood, weekBeforeReminders, weekBeforeTime, weekBeforeToggle } from './home-data.js';
import { el } from './home-ui.js';
import { layoutDay, promptNewAt, renderDay, renderHours, renderMonth, renderWeek, retime, toHHMM, toMin } from './home-views.js';
import { hideWorkspace, showWorkspace } from './home-workspace.js';
import { closeTaskEditor, editorEl, openTaskEditor } from './home-taskeditor.js';
import { openStudy } from './home-study.js';

'use strict';

// Pestaña "Home": planificador semanal y mensual con calendario. Las tareas
// y objetivos son personales (no de una carpeta), así que viven en
// <userData>/home.json vía IPC (home:load / home:save, ver main.js) y el
// Home funciona aunque no haya carpeta abierta. Si SÍ hay carpeta, además
// muestra (solo lectura) las filas de las bases de datos que tengan una
// columna de tipo Fecha — clic en una lleva a esa base (ver database.js).
//
// Núcleo: elementos del panel, abrir/cerrar, cambiar de vista/período,
// filtro y administrador de categorías, estadísticas, cableado de
// Ajustes y búsqueda global. El resto vive en sus home-*.js hermanos (ver
// OBJETIVOS.md, partir archivos grandes): home-data.js (modelo y
// persistencia), home-ui.js (tarjetas y helpers de DOM), home-views.js
// (semana/horario/mes), home-taskeditor.js (editor de tarea). Un solo
// <script type="module"> alcanza, el resto lo resuelven los imports.

export const overlay = document.getElementById('home-panel');

export const sideEl = document.getElementById('home-side');

export const mainEl = document.getElementById('home-main');

export const rangeLabel = document.getElementById('home-range-label');

export const modeWeekBtn = document.getElementById('home-mode-week');
export const modeDayBtn = document.getElementById('home-mode-day');

export const modeMonthBtn = document.getElementById('home-mode-month');

export const modeHoursBtn = document.getElementById('home-mode-hours');

export const startupToggle = document.getElementById('home-startup-toggle');

export const archiveSelect = document.getElementById('home-archive-select');

export let categoryFilter = ''; // '' = todas; 'none' = sin categoría; o el id

// Dónde viven las tareas: null = configuración de la app (por defecto), o
// la carpeta abierta (<carpeta>/.mk/home.json) si está activada la opción
// "Guardar el Home en la carpeta abierta" en Ajustes.
export let homeInFolder = false;

export function render() {
  renderCategoryFilter();
  if (overlay.hidden) return;
  const scrollTop = mainEl.scrollTop;
  if (mode === 'day') renderDay();
  else if (mode === 'week') renderWeek();
  else if (mode === 'hours') renderHours();
  else renderMonth();
  mainEl.scrollTop = scrollTop;
}

export function shift(delta) {
  if (mode === 'day') setCursor(addDays(cursor, delta));
  else if (mode === 'week' || mode === 'hours') setCursor(addDays(cursor, delta * 7));
  else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  render();
}

export async function open() {
  showWorkspace();
  await load();
  await Promise.all([loadDbItems(), loadNoteItems(), loadDbReminders()]);
  render();
  if (!overlay.contains(document.activeElement)) modeDayBtn.focus();
}

export function close() {
  closeTaskEditor();
  document.getElementById('home-options').open = false;
  hideWorkspace();
}

modeDayBtn.addEventListener('click', () => setMode('day'));
document.getElementById('home-add-task').addEventListener('click', () => {
  const date = iso(cursor);
  openTaskEditor({ task: { title: '', date, priority: 'media', category: categoryFilter && categoryFilter !== 'none' ? categoryFilter : null }, date, done: false, recurring: false }, { creating: true });
});
modeWeekBtn.addEventListener('click', () => setMode('week'));
modeMonthBtn.addEventListener('click', () => setMode('month'));
if (modeHoursBtn) modeHoursBtn.addEventListener('click', () => setMode('hours'));
document.getElementById('home-prev').addEventListener('click', () => shift(-1));
document.getElementById('home-next').addEventListener('click', () => shift(1));
document.getElementById('home-today').addEventListener('click', () => { setCursor(new Date()); render(); });
document.getElementById('home-close').addEventListener('click', close);
document.getElementById('home-stats-btn').addEventListener('click', openStats);
document.addEventListener('mousedown', (event) => {
  const options = document.getElementById('home-options');
  if (options.open && !options.contains(event.target)) options.open = false;
});

// ---- filtro y administrador de categorías ----
const catFilterEl = document.getElementById('home-cat-filter');

export function renderCategoryFilter() {
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
  const selected = catFilterEl.selectedOptions[0]?.textContent || '';
  document.querySelector('#home-options > summary').textContent = categoryFilter ? `Opciones · ${selected}` : 'Opciones';
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

export function closeCategories() {
  if (catsModal) { catsModal.remove(); catsModal = null; }
}

export function openCategories() {
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
    window.mdStudy?.refresh();
  });
  actions.append(add, el('span', 'toolbar-spacer'), cancel, ok);
  box.appendChild(actions);
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeCategories(); });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeCategories(); } });
  document.body.appendChild(modal);
  catsModal = modal;
}

document.getElementById('home-cats-btn').addEventListener('click', openCategories);
document.getElementById('home-study-btn').addEventListener('click', () => openStudy(categoryFilter).catch((error) => alert(error.message)));
document.getElementById('btn-home').addEventListener('click', () => overlay.hidden ? open() : close());
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
    const options = document.getElementById('home-options');
    if (options.open) { options.open = false; options.querySelector('summary').focus(); return; }
    if (!overlay.hidden && !e.defaultPrevented) close();
    return;
  }
  if (!window.mdShortcuts && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
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
  if (archiveSelect) archiveSelect.value = String(Number.isInteger(config.homeArchiveDays) ? config.homeArchiveDays : 90);
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

if (archiveSelect) {
  archiveSelect.addEventListener('change', async () => {
    const days = Number(archiveSelect.value);
    setArchiveDays(days);
    await window.mdEditor.setConfig({ homeArchiveDays: days });
    await load();
    if (await archiveOld()) render();
  });
}

startupToggle.addEventListener('change', () => {
  window.mdEditor.setConfig({ homeOnStartup: startupToggle.checked });
});

// Días seguidos, hacia atrás desde hoy, en los que la tarea recurrente se
// cumplió cada vez que tocaba. Si hoy le toca y todavía no está hecha, se
// empieza a contar desde ayer (el día no terminó).
export function habitStreak(task) {
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

export function computeStats() {
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
  // Cuenta también lo archivado (archivedDays: tareas hechas por día).
  const doneOn = (day) => !!data.archivedDays[day] || occurrencesOn(day).some((it) => it.done);
  let d = new Date();
  if (!doneOn(today)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (doneOn(iso(d))) streak++;
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

export function closeStats() {
  if (statsEl) { statsEl.remove(); statsEl = null; }
}

export function openStats() {
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
export async function searchTasks(query) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  await load();
  const match = (t) => (t.title || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q);
  const toResult = (archived) => (t) => ({ id: t.id, title: t.title, date: t.date, recurring: !!(t.repeat && t.repeat.freq), done: !!t.done, notes: t.notes || '', archived });
  const active = data.tasks.filter(match).slice(0, 50).map(toResult(false));
  const archived = active.length < 50 ? (await loadArchive()).filter(match).slice(0, 50 - active.length).map(toResult(true)) : [];
  return active.concat(archived);
}

// Abrir el Home en la semana de la tarea, con su editor abierto. Si está
// archivada, primero vuelve al Home.
export async function revealTask(id, occurrenceDate) {
  await open();
  let task = data.tasks.find((t) => t.id === id);
  if (!task) {
    task = await unarchive(id);
    render();
  }
  if (!task) return;
  const date = occurrenceDate || task.date;
  if (date) setCursor(parseIso(date));
  setMode('week');
  openTaskEditor(date ? findItem(task.id, date) : itemFor(task));
}

// ---- para los widgets de notas (widgets.js) ----
export async function widgetItems(kind) {
  await load();
  const today = todayIso();
  let items;
  if (kind === 'hoy') items = occurrencesOn(today);
  else if (kind === 'atrasadas') items = overdueTasks().map(itemFor);
  else {
    const monday = mondayOf(new Date());
    items = itemsInRange(iso(monday), iso(addDays(monday, 6)));
  }
  return items.map((it) => {
    const cat = categoryById(it.task.category);
    return { id: it.task.id, date: it.date, title: it.task.title, time: it.task.time || null, done: it.done, category: cat ? cat.name : null, color: cat ? cat.color : null };
  });
}

export function widgetSetDone(taskId, dateIso, done) {
  const it = findItem(taskId, dateIso);
  if (it) setItemDone(it, done);
}

window.mdHome = { hoursApi: { layoutDay, retime, promptNewAt, toMin, toHHMM }, archiveOld, unarchive, loadArchive: async () => { await load(); return loadArchive(); }, setArchiveDays, getData: () => data, widgetItems, widgetSetDone, openCategories, setCategoryFilter: (v) => { categoryFilter = v || ''; render(); }, parseCategoryToken, overdueCount, updatePetMood, dailySummaryText, weekBeforeReminders, open, close, setMode, checkReminders, searchTasks, revealTask, computeStats, openStats, rootChanged, dataLocation: () => dataRoot, getSnoozes: () => data.snoozes, loadDbReminders, remindersFiringToday, sendPlanToDailyNote, parseNoteTasks };

document.getElementById('home-options').addEventListener('toggle', (event) => {
  if (event.target.open) window.mdFitPopover(event.target.querySelector('.home-options-body'));
});
