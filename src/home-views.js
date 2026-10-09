import { addDays, categoryById, cursor, dbItemsOn, formatLong, iso, isoWeekNumber, itemsInRange, matchesFilter, mode, mondayOf, moveItem, noteItemsOn, priorityColor, setCursor, setItemDone, setMode, shownOn, todayIso, updateTaskWithUndo } from './home-data.js';
import { appendTaskGroups, dbChip, el, makeDropTarget, noteChip, progressBar, quickAddInput, renderSide, taskCard } from './home-ui.js';
import { openTaskEditor } from './home-taskeditor.js';
import { mainEl, overlay, rangeLabel } from './home.js';

'use strict';

// Las tres vistas del Home: semana, horario (por horas, estilo Google
// Calendar, con arrastrar/estirar bloques) y mes (calendario).

export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function renderDay() {
  const date = iso(cursor);
  const today = date === todayIso();
  const tasks = shownOn(date);
  const notes = noteItemsOn(date);
  const databaseItems = dbItemsOn(date);
  const all = [...tasks, ...notes, ...databaseItems];
  rangeLabel.textContent = formatLong(cursor);
  renderSide(itemsInRange(iso(mondayOf(cursor)), iso(addDays(mondayOf(cursor), 6))).filter((item) => matchesFilter(item.task)));
  mainEl.replaceChildren();
  const agenda = el('div', 'home-agenda');
  const welcome = el('div', 'home-agenda-welcome');
  welcome.appendChild(el('p', 'home-eyebrow', today ? 'HOY' : 'AGENDA DEL DÍA'));
  welcome.appendChild(el('h1', null, today ? 'Tu día, con espacio para lo importante.' : formatLong(cursor)));
  const pending = all.filter((item) => item.task?.kind !== 'reminder' && !item.done).length;
  welcome.appendChild(el('p', 'home-agenda-description', pending ? `${pending} ${pending === 1 ? 'tarea pendiente' : 'tareas pendientes'} para este día.` : 'Un día despejado. Añade lo que quieras organizar.'));
  agenda.appendChild(welcome);
  const overview = el('div', 'home-agenda-overview');
  const progress = el('section', 'home-agenda-stat');
  progress.appendChild(el('h2', null, 'Progreso del día'));
  progress.appendChild(progressBar(all));
  overview.appendChild(progress);
  const next = tasks.filter((item) => !item.done && item.task.time && (!today || item.task.time >= new Date().toTimeString().slice(0, 5)))
    .sort((a, b) => a.task.time.localeCompare(b.task.time))[0];
  const nextHost = el('section', 'home-agenda-stat');
  nextHost.appendChild(el('h2', null, 'Próximo evento con hora'));
  if (next) {
    const action = el('button', 'home-next-task', `${next.task.time} · ${next.task.title}`);
    action.addEventListener('click', () => openTaskEditor(next));
    nextHost.appendChild(action);
  } else nextHost.appendChild(el('p', 'home-agenda-description', 'Sin más tareas con hora para este día.'));
  overview.appendChild(nextHost);
  agenda.appendChild(overview);
  const list = el('section', 'home-task-list home-agenda-list');
  list.appendChild(el('h2', null, 'Tu agenda'));
  appendTaskGroups(list, [...tasks].sort((a, b) => (a.task.time || '99:99').localeCompare(b.task.time || '99:99')), notes, databaseItems, date);
  agenda.appendChild(list);
  const add = quickAddInput(date, '+ Escribe una tarea y pulsa Enter');
  agenda.appendChild(add);
  makeDropTarget(agenda, () => date);
  mainEl.appendChild(agenda);
}

export function renderWeek() {
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
    if (dayIso === today) col.setAttribute('aria-current', 'date');
    const header = el('div', 'home-day-header');
    header.appendChild(el('span', 'home-day-name', DAY_NAMES[i]));
    header.appendChild(el('span', 'home-day-number', String(day.getDate())));
    const dayTasks = shownOn(dayIso).filter((item) => item.task.kind !== 'reminder');
    if (dayTasks.length) {
      header.appendChild(el('span', 'home-day-count', `${dayTasks.filter((t) => t.done).length}/${dayTasks.length}`));
    }
    header.title = formatLong(day);
    col.appendChild(header);

    const list = el('div', 'home-task-list');
    appendTaskGroups(list, shownOn(dayIso), noteItemsOn(dayIso), dbItemsOn(dayIso), dayIso);
    col.appendChild(list);
    col.appendChild(quickAddInput(dayIso));
    makeDropTarget(col, () => dayIso);
    grid.appendChild(col);
  }
  mainEl.appendChild(grid);
}

// ---- vista horario (por horas, estilo Google Calendar) ----
// Días en columnas y horas en vertical: cada tarea con hora en su franja,
// con alto según su duración (task.duration, minutos; 60 si no tiene).
// Clic en un hueco: nueva tarea de 1 h ahí (arrastrar: elegir el rango).
// Arrastrar un bloque: otra hora / otro día (de a 15 min). Tirar del borde
// de abajo: duración. Arriba, "todo el día": sin hora, notas y bases.
export const HOUR_PX = 48;
export const SNAP_MIN = 15;
export const DEFAULT_DURATION = 60;
export let hoursScrollTop = null; // se conserva al redibujar

export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const snap = (min) => Math.max(0, Math.min(24 * 60 - SNAP_MIN, Math.round(min / SNAP_MIN) * SNAP_MIN));
export const durationOf = (task) => Math.max(SNAP_MIN, Number(task.duration) || DEFAULT_DURATION);

// Tareas que se pisan: lado a lado (columnas por grupo que se solapa).
export function layoutDay(items) {
  const ev = items.map((it) => ({ it, start: toMin(it.task.time), end: Math.min(24 * 60, toMin(it.task.time) + durationOf(it.task)) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group = [];
  let groupEnd = -1;
  const flush = () => { const n = Math.max(...group.map((g) => g.col)) + 1; group.forEach((g) => { g.cols = n; }); group = []; };
  ev.forEach((e) => {
    if (e.start >= groupEnd && group.length) flush();
    const used = new Set(group.filter((g) => g.end > e.start).map((g) => g.col));
    let c = 0;
    while (used.has(c)) c++;
    e.col = c;
    group.push(e);
    groupEnd = Math.max(groupEnd, e.end);
  });
  if (group.length) flush();
  return ev;
}

// Cambiar hora (y quizá día) de una tarea desde el horario.
export function retime(item, dateIso, startMin, duration) {
  const patch = { time: toHHMM(startMin) };
  if (duration) patch.duration = duration;
  if (item.recurring && dateIso !== item.date) {
    // Otra fecha de una repetición: se desprende de la serie (como en Semana).
    moveItem(item, dateIso, patch);
    return;
  }
  if (!item.recurring && dateIso !== item.date) patch.date = dateIso;
  updateTaskWithUndo(item.task.id, patch, 'Horario actualizado');
}

export function scheduleEvent(e, dayIso, colsEl) {
  const { it } = e;
  const task = it.task;
  const cat = categoryById(task.category);
  const node = el('div', 'home-hour-event' + (it.done ? ' home-task-done' : ''));
  node.style.top = `${(e.start / 60) * HOUR_PX}px`;
  node.style.height = `${Math.max(18, ((e.end - e.start) / 60) * HOUR_PX - 2)}px`;
  node.style.left = `calc(${(e.col / e.cols) * 100}% + 2px)`;
  node.style.width = `calc(${100 / e.cols}% - 4px)`;
  node.style.setProperty('--ev', cat ? cat.color : priorityColor(task));
  node.dataset.taskId = task.id;
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  const range = `${toHHMM(e.start)}–${toHHMM(e.end % (24 * 60) || 0)}`;
  node.setAttribute('aria-label', `${task.title}, ${range}${it.done ? ', hecha' : ''}`);
  node.title = `${task.title}\n${range}${task.notes ? `\n\n${task.notes}` : ''}\n\nArrastrá para mover · borde de abajo: duración`;
  const box = el('input');
  box.type = 'checkbox';
  box.checked = it.done;
  box.setAttribute('aria-label', `Hecha: ${task.title}`);
  box.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  box.addEventListener('change', () => setItemDone(it, box.checked));
  const title = el('span', 'home-hour-title', task.title);
  const time = el('span', 'home-hour-time', range + (it.recurring ? ' · 🔁' : ''));
  const handle = el('div', 'home-hour-resize');
  handle.setAttribute('aria-hidden', 'true');
  if (task.kind === 'reminder') node.appendChild(el('span', null, '🔔'));
  else node.appendChild(box);
  node.append(title, time, handle);
  node.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') openTaskEditor(it); });

  // Arrastrar: mover (cuerpo) o cambiar duración (borde de abajo).
  node.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const resizing = ev.target === handle;
    const startY = ev.clientY;
    const startX = ev.clientX;
    const cols = Array.from(colsEl.querySelectorAll('.home-hour-col'));
    let moved = false;
    let newStart = e.start;
    let newDur = e.end - e.start;
    let newDay = dayIso;
    node.setPointerCapture(ev.pointerId);
    const onMove = (mv) => {
      const dy = mv.clientY - startY;
      if (!moved && Math.abs(dy) < 4 && Math.abs(mv.clientX - startX) < 4) return;
      moved = true;
      node.classList.add('home-hour-dragging');
      const dMin = (dy / HOUR_PX) * 60;
      if (resizing) {
        newDur = Math.max(SNAP_MIN, snap(e.start + (e.end - e.start) + dMin) - e.start);
        node.style.height = `${(newDur / 60) * HOUR_PX - 2}px`;
      } else {
        newStart = snap(e.start + dMin);
        node.style.top = `${(newStart / 60) * HOUR_PX}px`;
        const over = cols.find((c) => { const r = c.getBoundingClientRect(); return mv.clientX >= r.left && mv.clientX < r.right; });
        if (over && over.dataset.date !== newDay) {
          newDay = over.dataset.date;
          over.appendChild(node);
          node.style.left = '2px';
          node.style.width = 'calc(100% - 4px)';
        }
      }
      time.textContent = `${toHHMM(newStart)}–${toHHMM((newStart + newDur) % (24 * 60))}`;
    };
    const onUp = () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      if (!moved) { openTaskEditor(it); return; }
      retime(it, newDay, newStart, newDur !== e.end - e.start || resizing ? newDur : null);
    };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
  });
  return node;
}

// Nueva tarea en un rango elegido del horario.
export function promptNewAt(col, dayIso, startMin, endMin) {
  openTaskEditor({ task: { title: '', date: dayIso, time: toHHMM(startMin), duration: endMin - startMin }, date: dayIso, done: false, recurring: false }, { creating: true });
  return document.querySelector('.home-editor input');
}

export function renderHours() {
  const monday = mondayOf(cursor);
  const sunday = addDays(monday, 6);
  const today = todayIso();
  rangeLabel.textContent = `Semana ${isoWeekNumber(monday)} · ` +
    `${monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ` +
    `${sunday.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  renderSide(itemsInRange(iso(monday), iso(sunday)).filter((it) => matchesFilter(it.task)));

  const prevScroller = mainEl.querySelector('.home-hours-scroll');
  if (prevScroller) hoursScrollTop = prevScroller.scrollTop;
  mainEl.innerHTML = '';
  const wrap = el('div', 'home-hours');

  // Cabecera: días + "todo el día".
  const head = el('div', 'home-hours-head');
  head.appendChild(el('div', 'home-hours-corner'));
  const allDay = el('div', 'home-hours-allday');
  allDay.appendChild(el('div', 'home-hours-corner home-hours-allday-label', 'Todo el día'));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const dayIso = iso(day);
    days.push(dayIso);
    const h = el('div', 'home-hours-dayhead' + (dayIso === today ? ' home-today' : '') + (i >= 5 ? ' home-weekend' : ''));
    h.appendChild(el('span', 'home-day-name', DAY_NAMES[i]));
    h.appendChild(el('span', 'home-day-number', String(day.getDate())));
    h.title = formatLong(day);
    head.appendChild(h);
    const cell = el('div', 'home-hours-allday-cell' + (dayIso === today ? ' home-today' : ''));
    shownOn(dayIso).filter((it) => !it.task.time).forEach((it) => cell.appendChild(taskCard(it, true)));
    noteItemsOn(dayIso).forEach((it) => cell.appendChild(noteChip(it)));
    dbItemsOn(dayIso).forEach((it) => cell.appendChild(dbChip(it)));
    cell.appendChild(quickAddInput(dayIso, '+ sin hora'));
    makeDropTarget(cell, () => dayIso);
    allDay.appendChild(cell);
  }
  wrap.append(head, allDay);

  // Cuerpo con scroll: horas a la izquierda y una columna por día.
  const scroller = el('div', 'home-hours-scroll');
  const body = el('div', 'home-hours-body');
  body.style.height = `${24 * HOUR_PX}px`;
  const gutter = el('div', 'home-hours-gutter');
  for (let h = 1; h < 24; h++) {
    const label = el('span', 'home-hours-label', `${String(h).padStart(2, '0')}:00`);
    label.style.top = `${h * HOUR_PX}px`;
    gutter.appendChild(label);
  }
  body.appendChild(gutter);
  const cols = el('div', 'home-hours-cols');
  days.forEach((dayIso, i) => {
    const col = el('div', 'home-hour-col' + (dayIso === today ? ' home-today' : '') + (i >= 5 ? ' home-weekend' : ''));
    col.dataset.date = dayIso;
    layoutDay(shownOn(dayIso).filter((it) => it.task.time)).forEach((e) => col.appendChild(scheduleEvent(e, dayIso, cols)));
    if (dayIso === today) {
      const now = new Date();
      const line = el('div', 'home-hours-now');
      line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX}px`;
      line.title = `Ahora: ${toHHMM(now.getHours() * 60 + now.getMinutes())}`;
      col.appendChild(line);
    }
    // Clic o arrastre en un hueco: tarea nueva en ese rango.
    col.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.target !== col) return;
      ev.preventDefault();
      const top = col.getBoundingClientRect().top;
      const at = (y) => snap(((y - top) / HOUR_PX) * 60);
      const a = Math.floor(((ev.clientY - top) / HOUR_PX) * 60 / 30) * 30; // clic: en la media hora
      let b = a + DEFAULT_DURATION;
      const ghost = el('div', 'home-hour-new home-hour-ghost');
      const paint = () => { ghost.style.top = `${(Math.min(a, b) / 60) * HOUR_PX}px`; ghost.style.height = `${(Math.abs(b - a) / 60) * HOUR_PX}px`; };
      col.appendChild(ghost);
      paint();
      let dragged = false;
      col.setPointerCapture(ev.pointerId);
      const onMove = (mv) => {
        const m = at(mv.clientY);
        if (Math.abs(m - a) < SNAP_MIN) return;
        dragged = true;
        b = m > a ? m + SNAP_MIN : m;
        paint();
      };
      const onUp = () => {
        col.removeEventListener('pointermove', onMove);
        col.removeEventListener('pointerup', onUp);
        ghost.remove();
        const s = Math.min(a, b);
        const f = Math.max(a, b);
        promptNewAt(col, dayIso, s, dragged ? Math.max(f, s + SNAP_MIN) : Math.min(24 * 60, s + DEFAULT_DURATION));
      };
      col.addEventListener('pointermove', onMove);
      col.addEventListener('pointerup', onUp);
    });
    cols.appendChild(col);
  });
  body.appendChild(cols);
  scroller.appendChild(body);
  wrap.appendChild(scroller);
  mainEl.appendChild(wrap);
  // Primera vez: a las 7 (o un rato antes de ahora si es más tarde).
  if (hoursScrollTop === null) {
    const h = new Date().getHours();
    hoursScrollTop = (h >= 8 ? Math.min(h - 1, 16) : 7) * HOUR_PX;
  }
  scroller.scrollTop = hoursScrollTop;
}

// Línea de "ahora" al día: se mueve sola cada minuto con el Home abierto.
setInterval(() => {
  if (mode !== 'hours' || overlay.hidden) return;
  const line = mainEl.querySelector('.home-hours-now');
  if (!line) return;
  const now = new Date();
  line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX}px`;
}, 60000);

export function renderMonth() {
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
    num.dataset.label = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short' });
    num.title = `Ver la semana del ${formatLong(day)}`;
    num.addEventListener('click', (e) => {
      e.stopPropagation();
      setCursor(day);
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
        setCursor(day);
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
