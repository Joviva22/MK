import { PRIORITIES, REMIND_OPTIONS, REPEAT_OPTIONS, addDays, addTask, data, deleteTask, iso, moveItem, newId, noteNames, parseIso, skipOccurrence, startPomodoroFor, todayIso, updateTask } from './home-data.js';
import { el } from './home-ui.js';
import { DAY_NAMES } from './home-views.js';

'use strict';

// Editor completo de una tarea (modal): título, fecha, hora, prioridad,
// repetición, aviso, categoría, nota enlazada, Pomodoro y notas libres.

export let editorEl = null;

export function closeTaskEditor() {
  if (editorEl) {
    editorEl.remove();
    editorEl = null;
  }
}

export function openTaskEditor(item, { creating = false } = {}) {
  const task = item.task;
  closeTaskEditor();
  const modal = el('div', 'modal-overlay palette-overlay');
  const box = el('div', 'command-palette home-editor');
  modal.appendChild(box);

  const heading = el('div', 'backlinks-title', creating ? 'Añadir tarea' : item.recurring ? 'Editar tarea recurrente' : 'Editar tarea');
  box.appendChild(heading);
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

  const kindSelect = field('Tipo', selectOf([{ value: 'task', label: 'Tarea' }, { value: 'reminder', label: 'Recordatorio' }], task.kind || 'task'));
  const titleInput = field('Título', el('input', 'home-editor-input'));
  titleInput.value = task.title;
  titleInput.placeholder = '¿Qué tienes que hacer?';
  titleInput.required = true;
  titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));

  const subtasks = (task.subtasks || []).map((subtask) => ({ ...subtask, doneDates: [...(subtask.doneDates || [])] }));
  const subtaskSection = el('section', 'home-subtask-editor');
  subtaskSection.appendChild(el('div', 'home-stats-subtitle', 'Subtareas'));
  subtaskSection.appendChild(el('p', 'home-editor-hint', 'Divide la tarea en pasos. Al completar la principal se completan todas sus subtareas.'));
  const subtaskList = el('div', 'home-subtask-list');
  const drawSubtasks = () => {
    subtaskList.replaceChildren();
    subtasks.forEach((subtask) => {
      const row = el('div', 'home-subtask-row');
      const check = el('input');
      check.type = 'checkbox';
      check.checked = window.mdHomeLogic.subtaskDone(subtask, item);
      check.setAttribute('aria-label', `Completar subtarea: ${subtask.title}`);
      check.addEventListener('change', () => Object.assign(subtask, window.mdHomeLogic.setSubtaskDone(subtask, item, check.checked)));
      const input = el('input', 'home-editor-input');
      input.value = subtask.title;
      input.placeholder = 'Por ejemplo: Recoger cocina';
      input.setAttribute('aria-label', 'Título de la subtarea');
      input.addEventListener('input', () => { subtask.title = input.value; check.setAttribute('aria-label', `Completar subtarea: ${input.value}`); });
      const remove = el('button', 'home-icon-button', '×');
      remove.setAttribute('aria-label', `Eliminar subtarea: ${subtask.title}`);
      remove.addEventListener('click', () => { subtasks.splice(subtasks.indexOf(subtask), 1); drawSubtasks(); });
      row.append(check, input, remove);
      subtaskList.appendChild(row);
    });
  };
  const addSubtask = el('button', 'toolbar-button', '+ Añadir subtarea');
  addSubtask.addEventListener('click', () => {
    subtasks.push({ id: newId(), title: '', done: false, doneDates: [] });
    drawSubtasks();
    subtaskList.lastElementChild.querySelector('.home-editor-input').focus();
  });
  drawSubtasks();
  subtaskSection.append(subtaskList, addSubtask);
  box.appendChild(subtaskSection);

  const row1 = el('div', 'home-editor-row');
  box.appendChild(row1);
  const dateInput = field(item.recurring ? 'Empieza' : 'Fecha', el('input', 'home-editor-input'), row1);
  dateInput.type = 'date';
  dateInput.value = task.date || '';
  const timeInput = field('Hora', el('input', 'home-editor-input'), row1);
  timeInput.type = 'time';
  timeInput.value = task.time || '';
  const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480].map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${m / 60} h`.replace('.5 h', ' h 30') }));
  const durationSelect = field('Duración', selectOf(DURATIONS, String(Number(task.duration) || 60)), row1);
  durationSelect.dataset.field = 'duration';
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
    durationSelect.disabled = !timeInput.value;
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

  if (creating) {
    const advanced = el('details', 'home-create-advanced');
    advanced.open = !!task.time || task.kind === 'reminder';
    advanced.appendChild(el('summary', null, 'Más opciones: hora, categoría y recordatorios'));
    // Keep title/date up front. Advanced controls retain the same data model.
    Array.from(row1.children).slice(1).forEach((child) => advanced.appendChild(child));
    [row2, daysWrap, advWrap, prioSelect.closest('label'), catSelect.closest('label'), noteInput.closest('label'), noteList, notesInput.closest('label')].forEach((node) => advanced.appendChild(node));
    box.appendChild(advanced);
  }

  const actions = el('div', 'home-editor-actions');
  if (!creating && item.recurring) {
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
  } else if (!creating) {
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
  const ok = el('button', 'toolbar-button home-primary', creating ? 'Crear tarea' : 'Guardar');
  const commit = () => {
    if (!titleInput.value.trim()) { titleInput.setCustomValidity('Escribe un título para la tarea.'); titleInput.reportValidity(); titleInput.focus(); return; }
    if (kindSelect.value === 'reminder' && (!dateInput.value || !timeInput.value)) {
      const missing = !dateInput.value ? dateInput : timeInput;
      missing.setCustomValidity('Indica fecha y hora para el recordatorio.');
      missing.reportValidity(); missing.focus(); return;
    }
    const freq = repeatSelect.value;
    // Una serie necesita fecha de inicio: si no hay, arranca hoy.
    const date = dateInput.value || (freq ? (item.date || todayIso()) : null);
    const days = dayBoxes.map((cb, idx) => (cb.checked ? idx : -1)).filter((i) => i >= 0);
    closeTaskEditor();
    const patch = {
      kind: kindSelect.value,
      ...(kindSelect.value === 'reminder' ? { done: false, doneAt: null, doneDates: [] } : {}),
      title: titleInput.value.trim() || task.title,
      date,
      time: timeInput.value || null,
      duration: Number(durationSelect.value) || 60,
      remind: timeInput.value ? (remindSelect.value !== '' ? Number(remindSelect.value) : kindSelect.value === 'reminder' ? 0 : null) : null,
      advance: getAdvance(),
      repeat: freq ? { freq, until: untilInput.value || null, days: freq === 'weekly' ? days : undefined } : null,
      priority: prioSelect.value,
      category: catSelect.value || null,
      subtasks: (kindSelect.value === 'reminder' ? [] : subtasks).filter((subtask) => subtask.title.trim()).map((subtask) => ({ ...subtask, title: subtask.title.trim() })),
      notes: notesInput.value,
      note: noteInput.value.trim() || null
    };
    if (patch.subtasks.some((subtask) => !window.mdHomeLogic.subtaskDone(subtask, item))) {
      if (item.recurring) patch.doneDates = (task.doneDates || []).filter((date) => date !== item.date);
      else Object.assign(patch, { done: false, doneAt: null });
    }
    if (creating) { delete patch.title; addTask(titleInput.value.trim(), date, patch); }
    else updateTask(task.id, patch);
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
  if (creating) actions.append(el('span', 'toolbar-spacer'), cancel, ok);
  else actions.append(el('span', 'toolbar-spacer'), tomorrowBtn, pomo, cancel, ok);
  box.appendChild(actions);
  const syncKind = () => {
    const reminder = kindSelect.value === 'reminder';
    heading.textContent = creating ? (reminder ? 'Añadir recordatorio' : 'Añadir tarea') : (reminder ? 'Editar recordatorio' : 'Editar tarea');
    ok.textContent = creating ? (reminder ? 'Crear recordatorio' : 'Crear tarea') : 'Guardar';
    titleInput.placeholder = reminder ? '¿Qué quieres recordar?' : '¿Qué tienes que hacer?';
    subtaskSection.hidden = reminder;
    prioSelect.closest('label').hidden = reminder;
    pomo.hidden = reminder;
    if (reminder && remindSelect.value === '') remindSelect.value = '0';
    if (reminder) { const advanced = box.querySelector('.home-create-advanced'); if (advanced) advanced.open = true; }
  };
  kindSelect.addEventListener('change', syncKind);
  [dateInput, timeInput].forEach((input) => input.addEventListener('input', () => input.setCustomValidity('')));
  syncKind();

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeTaskEditor(); });
  document.body.appendChild(modal);
  editorEl = modal;
  titleInput.focus();
  titleInput.select();
}
