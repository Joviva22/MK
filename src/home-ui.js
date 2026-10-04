import { REMIND_OPTIONS, REPEAT_OPTIONS, addDays, addTask, categoryById, data, findItem, iso, itemFor, loadDbItems, loadDbReminders, matchesFilter, mode, moveItem, moveNoteItem, newId, noteItems, openLinkedNote, overdueTasks, parseIso, periodKey, priorityColor, save, sendPlanToDailyNote, setItemDone, todayIso, toggleNoteItem, updateTask } from './home-data.js';
import { openTaskEditor } from './home-taskeditor.js';

'use strict';

// Helpers de DOM y tarjetas: una tarea, una tarea de nota, una fila de base
// de datos, la barra de progreso y el panel lateral (objetivos, notas,
// atrasadas, sin fecha) — usados por las tres vistas de home-views.js.
// `close`, `mainEl`, `render`, `sideEl` (de home.js) se piden dentro de
// cada función, así que se importan ahí mismo para no crear un ciclo al
// cargar (home.js importa de acá para armar el panel).
import { close, mainEl, render, sideEl } from './home.js';

export const CLICK_DELAY_MS = 250; // para distinguir clic (abrir editor) de doble clic (renombrar)

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Días (semana), celdas (mes) y "Sin fecha" aceptan tres cosas arrastradas:
// tareas del Home, tareas "📅" de notas (se reescribe la fecha en el
// archivo) y filas de bases de datos (se cambia su columna Fecha).
// (Viven acá, no en home-data.js: son top-level y DROP_MIMES las lee de
// inmediato al cargar el módulo — si vinieran importadas de otro módulo con
// import circular, todavía podrían no estar inicializadas en ese instante.)
export const DRAG_MIME = 'application/x-mk-home-task';
export const NOTE_DRAG_MIME = 'application/x-mk-home-note'; // tarea "📅" de una nota
export const DB_DRAG_MIME = 'application/x-mk-home-dbrow'; // fila de base de datos con fecha
export const DROP_MIMES = [DRAG_MIME, NOTE_DRAG_MIME, DB_DRAG_MIME];

export function makeDropTarget(node, getDate) {
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
export function quickAddInput(date, placeholder) {
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

export function taskCard(item, compact) {
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
  const badges = (item.recurring ? '🔁' : '') + ((task.remind != null && task.time) || (task.advance && task.advance.length) ? '🔔' : '');
  if (badges || task.pomodoros) {
    const badgeEl = el('span', 'home-task-badges', badges);
    if (task.pomodoros) {
      const count = el('span', 'home-task-pomodoros');
      count.title = `${task.pomodoros} Pomodoros completados`;
      count.setAttribute('aria-label', count.title);
      count.append(window.mdLuckyEmblem.mini(), String(task.pomodoros));
      badgeEl.appendChild(count);
    }
    card.appendChild(badgeEl);
  }
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
export function startInlineRename(card, titleEl, task) {
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

export function noteChip(item) {
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

export function dbChip(item) {
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

export function progressBar(tasks) {
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

export function renderSide(periodTasks) {
  sideEl.innerHTML = '';
  const key = periodKey();
  const ofPeriod = mode === 'month' ? 'del mes' : 'de la semana';

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
