(function () {
'use strict';
const H = window.mdPomodoroHistory;
let overlay = null;
let period = 'all';
let filterCategory = '*';
let filterNote = '*';
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function minutes(seconds) { return `${Math.round(seconds / 60 * 10) / 10} min`; }
function localDate(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function range() {
  if (period === 'all') return { from: -Infinity, to: Infinity };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (period === 'today') end.setDate(end.getDate() + 1);
  if (period === 'week') { start.setDate(start.getDate() - (start.getDay() + 6) % 7); end.setTime(start.getTime()); end.setDate(end.getDate() + 7); }
  if (period === 'month') { start.setDate(1); end.setTime(start.getTime()); end.setMonth(end.getMonth() + 1); }
  return { from: start.getTime(), to: end.getTime() };
}
async function open() {
  await H.ready;
  const config = await window.mdEditor.getConfig();
  if (overlay) return;
  const previous = document.activeElement;
  overlay = el('div', null, 'modal-overlay');
  overlay.id = 'pomodoro-history-panel';
  const box = el('div', null, 'modal pomodoro-panel');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'pomodoro-panel-title');
  const error = el('p', '', 'pomodoro-error');
  error.setAttribute('role', 'alert');
  const persistence = el('p', '', 'pomodoro-save-status');
  persistence.setAttribute('role', 'status');
  function syncSaved() { persistence.textContent = H.isDirty() ? 'Cambios pendientes de guardar en disco. Reintenta antes de cerrar MK.' : 'Historial guardado en este equipo.'; }
  document.addEventListener('mk:pomodoro-history', syncSaved);
  const statusTimer = setInterval(() => {
    const node = box.querySelector('#pomodoro-current-status');
    if (node) {
      const state = window.mdPomodoro.getState();
      node.textContent = state.phase === 'idle' ? 'Prepara el próximo foco.' : `${state.phase === 'focus' ? 'Foco' : 'Descanso'} ${state.running ? 'en marcha' : 'pausado'} · ${minutes(state.remainingSeconds)} restantes`;
    }
  }, 1000);
  function close() {
    clearInterval(statusTimer);
    document.removeEventListener('mk:pomodoro-history', syncSaved);
    overlay.remove(); overlay = null;
    previous?.focus();
  }
  function button(text, action, id) {
    const node = el('button', text, 'toolbar-button');
    node.type = 'button';
    if (id) node.id = id;
    node.addEventListener('click', async () => {
      node.disabled = true;
      error.textContent = '';
      try { await action(); }
      catch (e) { error.textContent = e.message || 'No se pudo guardar el cambio.'; syncSaved(); }
      finally { node.disabled = false; }
    });
    return node;
  }
  function input(label, value, type, id) {
    const wrap = el('label', null, 'pomodoro-field');
    const field = el('input');
    wrap.append(el('span', label), field);
    field.type = type || 'text'; field.value = value;
    if (id) field.id = id;
    if (type === 'number') { field.min = '0.01'; field.max = '1440'; field.step = 'any'; }
    if (!type) field.maxLength = 80;
    return { wrap, field };
  }
  function notePicker(initial) {
    let path = initial || '';
    const wrap = el('div', null, 'pomodoro-note-context');
    const label = el('p');
    const refresh = () => { label.textContent = path ? `Nota vinculada: ${path.split('/').pop()}` : 'Sin nota vinculada'; label.title = path; };
    const bind = button('Vincular nota abierta', () => {
      const active = window.mdPomodoro.activeNotePath();
      if (!active) throw new Error('Abre y guarda una nota Markdown primero.');
      path = active; refresh();
    });
    bind.disabled = !window.mdPomodoro.activeNotePath();
    wrap.append(label, bind, button('Quitar vínculo', () => { path = ''; refresh(); }));
    refresh();
    return { wrap, value: () => path };
  }
  function recordForm(entry, container) {
    const form = el('div', null, 'pomodoro-record-form');
    const date = input('Fecha y hora', localDate(entry?.date || new Date()), 'datetime-local');
    const category = input('Categoría', entry?.category || '', null);
    category.field.setAttribute('list', 'pomodoro-category-options');
    const duration = input('Minutos de foco', entry ? entry.seconds / 60 : 25, 'number');
    const detail = input('Trabajo realizado (opcional)', entry?.detail || '', null);
    detail.field.maxLength = 500;
    detail.field.className = 'pomodoro-record-detail';
    const note = notePicker(entry?.notePath);
    const completedWrap = el('label', null, 'pomodoro-field');
    const completed = el('input'); completed.type = 'checkbox'; completed.checked = entry ? entry.completed : true;
    completedWrap.append(completed, el('span', 'Foco completado (sin conceder XP)'));
    form.append(date.wrap, category.wrap, duration.wrap, detail.wrap, note.wrap, completedWrap);
    form.append(button('Guardar registro', async () => {
      const values = { category: category.field.value, seconds: Number(duration.field.value) * 60, date: date.field.value, completed: completed.checked, notePath: note.value(), detail: detail.field.value };
      if (entry) await H.edit(entry.id, values); else await H.record(values);
      render();
    }), button('Cancelar', () => form.remove()));
    container.append(form);
    date.field.focus();
  }
  function render() {
    const data = H.getState();
    const state = window.mdPomodoro.getState();
    const title = el('h2', 'Pomodoros · tiempo de estudio'); title.id = 'pomodoro-panel-title';
    box.replaceChildren(title, error, persistence);
    syncSaved();
    const active = el('section', null, 'pomodoro-section');
    active.append(el('h3', 'Temporizador'));
    const currentStatus = el('p', state.phase === 'idle' ? 'Prepara el próximo foco.' : `${state.phase === 'focus' ? 'Foco' : 'Descanso'} ${state.running ? 'en marcha' : 'pausado'} · ${minutes(state.remainingSeconds)} restantes`);
    currentStatus.id = 'pomodoro-current-status';
    active.append(currentStatus);
    const category = input('Categoría (por ejemplo PCP)', state.category, null, 'pomodoro-active-category');
    category.field.setAttribute('list', 'pomodoro-category-options');
    const options = el('datalist'); options.id = 'pomodoro-category-options';
    data.categories.forEach((name) => { const option = el('option'); option.value = name; options.append(option); });
    const duration = input(state.phase === 'idle' ? 'Minutos de foco (esta sesión de MK)' : 'Minutos restantes de esta fase', state.phase === 'idle' ? state.durationOverride || Number(config.pomodoroFocusMinutes) || 25 : Math.round(state.remainingSeconds / 60 * 100) / 100, 'number', 'pomodoro-active-minutes');
    const initialMinutes = duration.field.value;
    const detail = input('Trabajo de este foco (opcional)', state.detail, null, 'pomodoro-active-detail');
    detail.field.maxLength = 500;
    const note = notePicker(state.notePath);
    active.append(category.wrap, duration.wrap, options, detail.wrap, note.wrap);
    if (state.task) active.append(el('p', `Tarea de Home: ${state.task}`));
    active.append(button('Aplicar', async () => {
      if (duration.field.value !== initialMinutes) window.mdPomodoro.configure(category.field.value, Number(duration.field.value));
      else window.mdPomodoro.setCategory(category.field.value);
      window.mdPomodoro.setContext(note.value(), detail.field.value);
      await H.selectCategory(category.field.value);
      render();
    }, 'pomodoro-apply'), button(state.phase === 'idle' ? 'Iniciar foco' : state.running ? 'Pausar' : 'Reanudar', async () => { await window.mdPomodoro.toggle(); render(); }, 'pomodoro-toggle'));
    if (state.phase === 'idle') active.append(button('Iniciar foco con la nota abierta', async () => {
      if (!window.mdPomodoro.activeNotePath()) throw new Error('Abre y guarda una nota Markdown primero.');
      window.mdPomodoro.configure(category.field.value, Number(duration.field.value));
      await H.selectCategory(category.field.value);
      await window.mdPomodoro.startForNote();
      window.mdPomodoro.setContext(window.mdPomodoro.getState().notePath, detail.field.value);
      render();
    }, 'pomodoro-start-note'));
    if (state.phase !== 'idle') active.append(button('Finalizar y guardar tiempo trabajado', async () => { await window.mdPomodoro.reset(); await H.settled(); render(); }, 'pomodoro-finish'));
    active.append(el('p', 'Pulsa Aplicar para guardar categoría, nota y detalle: reclasifica el foco actual completo. Cambiar de pestaña no cambia su vínculo. Editar minutos restantes no añade tiempo trabajado. Pausas y descansos no cuentan.', 'pomodoro-hint'));
    active.append(button('Usar duración de Ajustes en los próximos focos', () => { window.mdPomodoro.useConfiguredDuration(); render(); }));
    box.append(active);
    const categories = el('section', null, 'pomodoro-section');
    categories.append(el('h3', 'Categorías'));
    const name = input('Nueva categoría', '', null, 'pomodoro-new-category');
    categories.append(name.wrap, button('Crear categoría', async () => { await H.addCategory(name.field.value); render(); }, 'pomodoro-add-category'));
    data.categories.forEach((categoryName) => {
      const row = el('div', null, 'pomodoro-category-row');
      row.append(el('span', categoryName), button('Renombrar', async () => {
        const name = await window.mdAsk('Nuevo nombre de categoría (fusiona si ya existe)', categoryName);
        if (name == null) return;
        await H.renameCategory(categoryName, name);
        if (window.mdPomodoro.getState().category === categoryName) window.mdPomodoro.setCategory(name);
        if (filterCategory === categoryName) filterCategory = window.mdPomodoroLogic.category(name);
        render();
      }));
      categories.append(row);
    });
    box.append(categories);
    const stats = el('section', null, 'pomodoro-section');
    stats.append(el('h3', 'Estadísticas de tiempo de foco'));
    const periodLabel = el('label', 'Periodo ');
    const periods = el('select'); periods.id = 'pomodoro-period';
    for (const [value, label] of [['all', 'Todo el historial'], ['today', 'Hoy'], ['week', 'Esta semana'], ['month', 'Este mes']]) { const option = el('option', label); option.value = value; periods.append(option); }
    periods.value = period; periods.onchange = () => { period = periods.value; render(); };
    periodLabel.append(periods);
    const categoryLabel = el('label', ' Categoría ');
    const categoryFilter = el('select'); categoryFilter.id = 'pomodoro-filter-category';
    for (const [value, label] of [['*', 'Todas'], ['', 'Sin categoría'], ...data.categories.map((name) => [name, name])]) { const option = el('option', label); option.value = value; categoryFilter.append(option); }
    if (filterCategory !== '*' && filterCategory && !data.categories.includes(filterCategory)) filterCategory = '*';
    categoryFilter.value = filterCategory;
    categoryFilter.onchange = () => { filterCategory = categoryFilter.value; render(); };
    categoryLabel.append(categoryFilter);
    const noteLabel = el('label', ' Nota ');
    const noteFilter = el('select'); noteFilter.id = 'pomodoro-filter-note';
    const paths = [...new Set([window.mdPomodoro.activeNotePath(), state.notePath, ...data.records.map((r) => r.notePath)].filter(Boolean))].sort();
    if (filterNote !== '*' && filterNote && !paths.includes(filterNote)) filterNote = '*';
    for (const [value, label] of [['*', 'Todas las notas'], ['', 'Sin nota'], ...paths.map((path) => [path, path])]) { const option = el('option', label); option.value = value; noteFilter.append(option); }
    noteFilter.value = filterNote;
    noteFilter.onchange = () => { filterNote = noteFilter.value; render(); };
    noteLabel.append(noteFilter);
    stats.append(periodLabel, categoryLabel, noteLabel, button('Actualizar', render));
    const bounds = range();
    const summary = window.mdPomodoroLogic.summarize(data, { ...bounds, category: filterCategory === '*' ? null : filterCategory, notePath: filterNote === '*' ? null : filterNote });
    const totals = el('div'); totals.id = 'pomodoro-totals';
    if (!summary.length) totals.append(el('p', 'No hay tiempo registrado en este periodo.'));
    summary.forEach((item) => totals.append(el('p', `${item.category || 'Sin categoría'}: ${minutes(item.seconds)} · ${item.completed} completados · ${item.partial} parciales`)));
    stats.append(totals); box.append(stats);
    const history = el('section', null, 'pomodoro-section');
    history.append(el('h3', 'Historial editable'), button('Añadir registro manual', () => { if (!history.querySelector('.pomodoro-record-form')) recordForm(null, history); }, 'pomodoro-add-record'));
    const records = data.records.filter((r) => Date.parse(r.date) >= bounds.from && Date.parse(r.date) < bounds.to && (filterCategory === '*' || r.category === filterCategory) && (filterNote === '*' || (r.notePath || '') === filterNote)).slice().sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    if (!records.length) history.append(el('p', 'Los registros aparecerán aquí al trabajar, pausar o finalizar un foco.'));
    records.slice(0, 200).forEach((entry) => {
      const row = el('div', null, 'pomodoro-record'); row.dataset.id = entry.id;
      row.append(el('p', `${new Date(entry.date).toLocaleString()} · ${entry.category || 'Sin categoría'} · ${minutes(entry.seconds)} · ${entry.completed ? 'Completado' : 'Parcial'}${entry.task ? ` · ${entry.task}` : ''}`));
      if (entry.detail) row.append(el('p', entry.detail));
      if (entry.notePath) { const label = el('p', `Nota: ${entry.notePath.split('/').pop()}`); label.title = entry.notePath; row.append(label); }
      const activeRecord = state.phase === 'focus' && state.sessionId === entry.id;
      if (activeRecord) row.append(el('p', 'Foco en curso: edítalo desde Temporizador o finalízalo antes de modificar su registro.', 'pomodoro-hint'));
      else row.append(button('Editar', () => { if (!row.querySelector('.pomodoro-record-form')) recordForm(entry, row); }), button('Eliminar', async () => { if (confirm('¿Eliminar este registro y quitar su tiempo de las estadísticas?')) { await H.remove(entry.id); render(); } }));
      if (entry.notePath) row.append(button('Abrir nota', async () => {
        const result = await window.mdEditor.readFile(entry.notePath);
        if (!result || typeof result.content !== 'string') throw new Error('No se pudo abrir la nota. Comprueba que existe y que su carpeta está abierta.');
        await window.openFileAtPath(entry.notePath);
        close();
      }));
      history.append(row);
    });
    if (records.length > 200) history.append(el('p', `Mostrando los 200 registros más recientes de ${records.length}. Las estadísticas incluyen todos; filtra por periodo o categoría.`));
    box.append(history, button('Reintentar guardado', async () => { await H.retry(); syncSaved(); }), button('Cerrar', close, 'pomodoro-close'));
  }
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
  overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close(); });
  overlay.append(box); document.body.append(overlay); render();
  box.querySelector('input').focus();
}
document.getElementById('btn-pomodoro-history').addEventListener('click', open);
window.mdPomodoroPanel = { open };
})();
