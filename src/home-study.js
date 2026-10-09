import { data, dataRoot, load, loadArchive, saveTimer, startPomodoroFor, todayIso } from './home-data.js';
import './home-learning.js';

const L = window.mdStudyLogic;
let panel = null;
let selectedId = '';
let profile = null;
let busy = false;
let errorText = '';
let statusText = '';
let previousFocus = null;
let archivedTasks = [];
let weekOffset = 0;
const topicNames = new Map();
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function category() { return data.categories.find((c) => c.id === selectedId); }
function subject(cat) { return data.study?.subjects?.[cat.id] || { materials: [], pomodoroCategory: '' }; }
function focusCategory(cat) { return subject(cat).pomodoroCategory || cat.name; }
function draft(cat) {
  data.study = L.normalize(data.study);
  return data.study.subjects[cat.id] ||= { materials: [], topics: [], pomodoroCategory: cat.name };
}
function renderTopics(cat) {
  const section = el('section', null, 'study-section'); section.id = 'study-topics';
  section.append(el('h3', 'Comprensión por temas'), el('p', 'El estado es tu autoevaluación. Los repasos y errores son señales para reforzar, no cambian automáticamente ese estado.', 'study-hint'));
  const name = el('input'); name.id = 'study-topic-name'; name.placeholder = 'Nuevo tema (p. ej. semáforos)'; name.maxLength = 160;
  name.setAttribute('aria-label', 'Nombre del nuevo tema'); name.value = topicNames.get(cat.id) || '';
  name.addEventListener('input', () => topicNames.set(cat.id, name.value));
  section.append(name, button('Crear tema', async () => {
    assertCategory(cat); const title = name.value.trim(); if (!title) throw new Error('Escribe el nombre del tema.');
    draft(cat).topics.push({ id: crypto.randomUUID(), title, status: 'pending', materials: [], cardIds: [] });
    topicNames.delete(cat.id); await persist();
  }, 'study-topic-create'));
  const learning = L.normalize(data.study).learning;
  for (const topic of subject(cat).topics || []) {
    const row = el('section', null, 'study-section'); row.dataset.topicId = topic.id;
    row.append(el('h4', topic.title));
    const state = el('select'); state.setAttribute('aria-label', `Estado de ${topic.title}`);
    for (const [value, label] of [['pending', 'Pendiente'], ['practicing', 'Practicando'], ['mastered', 'Dominado']]) {
      const option = el('option', label); option.value = value; state.append(option);
    }
    state.value = topic.status;
    const current = () => { assertCategory(cat); const found = draft(cat).topics.find((t) => t.id === topic.id); if (!found) throw new Error('Este tema ya no existe.'); return found; };
    state.addEventListener('change', () => { const value = state.value; run(async () => { current().status = value; await persist(); }); });
    row.append(state);
    row.append(button('Estudiar este tema en vista dividida', async () => {
      assertCategory(cat);
      await openWorkspace(topic.materials.map((path) => ({ path })));
    }));
    const evidence = L.topicEvidence(topic, learning, cat.id);
    const evidenceNode = el('p', evidenceText(evidence), 'study-hint'); evidenceNode.dataset.topicEvidence = topic.id; row.append(evidenceNode);
    const material = el('select'); material.setAttribute('aria-label', `Material para ${topic.title}`);
    const emptyMaterial = el('option', 'Elegir material de la asignatura'); emptyMaterial.value = ''; material.append(emptyMaterial);
    for (const item of subject(cat).materials.filter((m) => !topic.materials.includes(m.path))) { const option = el('option', item.label); option.value = item.path; material.append(option); }
    row.append(material, button('Vincular material', async () => {
      if (!L.materialPath(material.value)) throw new Error('Elige un material. Puedes añadirlo en Apuntes y PDFs.');
      const target = current(); if (!target.materials.includes(material.value)) target.materials.push(material.value); await persist();
    }));
    for (const path of topic.materials) {
      const item = subject(cat).materials.find((m) => m.path === path) || { path, label: path.split('/').pop() };
      const link = el('div', null, 'study-row'); link.append(el('span', item.label), button('Abrir', () => openMaterial(item)), button('Desvincular material', async () => { current().materials = topic.materials.filter((p) => p !== path); await persist(); })); row.append(link);
    }
    const card = el('select'); card.setAttribute('aria-label', `Tarjeta para ${topic.title}`);
    const emptyCard = el('option', 'Elegir tarjeta de la asignatura'); emptyCard.value = ''; card.append(emptyCard);
    for (const item of learning.cards.filter((c) => c.category === cat.id && !topic.cardIds.includes(c.id))) { const option = el('option', item.question.slice(0, 100)); option.value = item.id; card.append(option); }
    row.append(card, button('Vincular tarjeta', async () => {
      if (!L.normalize(data.study).learning.cards.some((c) => c.id === card.value && c.category === cat.id)) throw new Error('Elige una tarjeta de esta asignatura.');
      const target = current(); if (!target.cardIds.includes(card.value)) target.cardIds.push(card.value); await persist();
    }));
    for (const id of topic.cardIds) {
      const item = learning.cards.find((c) => c.id === id && c.category === cat.id);
      const link = el('div', null, 'study-row'); link.append(el('span', item ? item.question.slice(0, 120) : 'Tarjeta no disponible'), button('Desvincular tarjeta', async () => { current().cardIds = topic.cardIds.filter((key) => key !== id); await persist(); })); row.append(link);
    }
    row.append(button('Eliminar tema', async () => { if (!confirm(`¿Eliminar el tema «${topic.title}»? No se borrarán archivos ni tarjetas.`)) return; assertCategory(cat); draft(cat).topics = subject(cat).topics.filter((t) => t.id !== topic.id); await persist(); }));
    section.append(row);
  }
  return section;
}
function evidenceText(evidence) {
  return `${evidence.cards} tarjetas · ${evidence.due} repasos pendientes · ${evidence.mistakes} errores de último examen${evidence.missing ? ` · ${evidence.missing} vínculos a tarjetas no disponibles` : ''}`;
}
async function openWorkspace(materials) {
  const opened = await window.mdStudyWorkspace.open({ notePath: materials.find((m) => /\.(md|markdown)$/i.test(m.path))?.path,
    pdfPath: materials.find((m) => /\.pdf$/i.test(m.path))?.path, drawingPath: materials.find((m) => /\.excalidraw$/i.test(m.path))?.path });
  if (!opened) return;
  window.mdHome.close(); panel?.remove(); panel = null; document.removeEventListener('mk:pomodoro-history', updateStats);
}
function renderWeekly() {
  const section = el('section', null, 'study-section'); section.id = 'study-weekly';
  const report = L.weeklySummary(data.study, data.categories, [...archivedTasks, ...data.tasks].filter((task) => task.kind !== 'reminder'), window.mdPomodoroHistory.getState().records, new Date(), weekOffset);
  section.append(el('h3', `Resumen semanal · desde ${report.from} hasta antes de ${report.until}`));
  section.append(button('Semana anterior', () => { weekOffset--; }), button('Esta semana', () => { weekOffset = 0; }));
  for (const row of report.rows) {
    const item = el('div', null, 'study-section'); item.dataset.categoryId = row.id;
    item.append(el('h4', row.name), el('p', `${minutes(row.seconds)} · ${row.completed} tareas completadas · ${row.repetitions} repeticiones marcadas${row.undated ? ` · ${row.undated} tareas hechas sin fecha (no contabilizadas)` : ''}`));
    item.append(el('p', row.attention.length ? `Para reforzar ahora: ${row.attention.map((t) => `${t.title} (${t.due} repasos, ${t.mistakes} errores)`).join(' · ')}` : 'Sin temas marcados para reforzar ahora.', 'study-hint'));
    section.append(item);
  }
  section.append(el('p', 'Lunes a domingo, horario local. Incluye tareas archivadas. Las tareas usan su fecha de finalización; las repeticiones, la fecha de la ocurrencia marcada. El tiempo proviene de la categoría Pomodoro vinculada: categorías compartidas muestran el mismo tiempo, no se suman. Los temas y repasos reflejan el estado actual, también al consultar semanas anteriores.', 'study-hint'));
  return section;
}
async function persist() {
  const target = data;
  const root = dataRoot;
  clearTimeout(saveTimer);
  const expected = JSON.stringify(L.normalize(target.study));
  if (!await window.mdEditor.homeSave(target, root)) throw new Error('No se pudo guardar. El cambio sigue en memoria; reintenta antes de cerrar MK.');
  const stored = await window.mdEditor.homeLoad(root);
  if (JSON.stringify(L.normalize(stored?.study)) !== expected) throw new Error('El cambio aún no está en disco. Reintenta después de terminar la importación o resolver el error.');
  statusText = 'Cambios guardados en este Home.';
}
function closeStudy() {
  if (busy) return;
  panel?.remove(); panel = null;
  document.removeEventListener('mk:pomodoro-history', updateStats);
  previousFocus?.focus();
}
async function run(action) {
  if (busy) return;
  if (profile !== dataRoot) { refresh(); return; }
  busy = true; errorText = ''; statusText = '';
  panel?.querySelectorAll('button, input, select').forEach((node) => { node.disabled = true; });
  try { await action(); }
  catch (error) { errorText = error.message || 'No se pudo completar la acción.'; }
  finally { busy = false; if (panel) render(); }
}
function button(text, action, id) {
  const node = el('button', text, 'toolbar-button'); node.type = 'button';
  if (id) node.id = id;
  node.addEventListener('click', () => run(action));
  return node;
}
function assertCategory(cat) {
  if (!cat || !data.categories.some((c) => c.id === cat.id) || profile !== dataRoot) throw new Error('Cambió el Home o la categoría. Actualiza la vista antes de continuar.');
}
async function linkMaterial(path) {
  const cat = category(); assertCategory(cat);
  path = L.materialPath(path);
  if (!path) throw new Error('Elige un apunte Markdown guardado, PDF o pizarra Excalidraw.');
  const saved = draft(cat);
  if (!saved.materials.some((m) => m.path === path)) saved.materials.push({ path, label: path.split('/').pop() });
  await persist();
}
function canFocus() { return !window.mdModules || window.mdModules.isOn('pomodoro'); }
function confirmFocus() {
  if (!canFocus()) throw new Error('Activa el módulo Pomodoro en Ajustes primero.');
  return window.mdPomodoro.getState().phase === 'idle' || confirm('Hay un Pomodoro en curso. ¿Guardar su tiempo parcial y empezar un foco nuevo para esta asignatura?');
}
async function openMaterial(material, focus = false) {
  const cat = category(); assertCategory(cat);
  if (focus && !confirmFocus()) return;
  if (/\.excalidraw$/i.test(material.path)) {
    if (!await window.mdDrawing.open(material.path)) return;
  } else if (/\.pdf$/i.test(material.path)) {
    if (window.mdModules && !window.mdModules.isOn('pdf')) throw new Error('Activa el módulo PDF en Ajustes primero.');
    if (window.mdPdfHighlight.getState()?.sourcePath !== material.path && !await window.mdPdfHighlight.loadFromPath(material.path)) return;
    window.mdPdfHighlight.open();
    window.mdPdfHighlight.setMode('select');
  } else {
    const file = await window.mdEditor.readFile(material.path);
    if (!file || file.binary || typeof file.content !== 'string') throw new Error('No se pudo abrir el apunte. Comprueba su ruta y abre su carpeta o elige el archivo de nuevo para autorizarlo.');
    await window.openFileAtPath(material.path);
  }
  if (focus) {
    const mapping = focusCategory(cat);
    draft(cat).pomodoroCategory = mapping;
    await persist();
    await window.mdPomodoro.startForContext(mapping, /\.(md|markdown)$/i.test(material.path) ? material.path : '', `Estudio: ${material.label}`);
  }
  window.mdHome.close();
  // La acción acaba de abrir el material: cierra el modal al salir de run.
  panel?.remove(); panel = null;
  document.removeEventListener('mk:pomodoro-history', updateStats);
}
function minutes(seconds) { return `${Math.round(seconds / 60 * 10) / 10} min`; }
function updateStats() {
  if (!panel || !category()) return;
  const stats = L.focusTotals(window.mdPomodoroHistory.getState().records, focusCategory(category()));
  for (const key of ['today', 'week', 'all']) {
    const node = panel.querySelector(`#study-time-${key}`); if (node) node.textContent = minutes(stats[key]);
  }
}
function render() {
  if (!panel) return;
  const box = panel.querySelector('.study-dialog');
  if (!data.categories.some((c) => c.id === selectedId)) selectedId = data.categories[0]?.id || '';
  box.replaceChildren();
  const title = el('h2', 'Estudio por asignatura'); title.id = 'study-title';
  box.append(title);
  const error = el('p', errorText, 'study-error'); error.setAttribute('role', 'alert');
  const status = el('p', statusText, 'study-hint'); status.setAttribute('role', 'status');
  box.append(error, status);
  const plan = el('section', null, 'study-section'); plan.id = 'study-today';
  plan.append(el('h3', 'Plan de hoy · todas las asignaturas'));
  const budgetLabel = el('label', 'Minutos de foco disponibles hoy ');
  const budget = el('input'); budget.type = 'number'; budget.min = '25'; budget.max = '720'; budget.step = '25'; budget.id = 'study-plan-minutes'; budget.value = String(L.normalize(data.study).planMinutes);
  budgetLabel.append(budget); plan.append(budgetLabel, button('Actualizar plan', async () => {
    const value = Number(budget.value);
    if (!Number.isInteger(value) || value < 25 || value > 720) throw new Error('Indica entre 25 y 720 minutos.');
    data.study = L.normalize(data.study); data.study.planMinutes = value; await persist();
  }, 'study-plan-update'));
  const proposed = L.todayPlan(data.tasks.filter((task) => task.kind !== 'reminder'), data.categories, todayIso(), window.mdHomeLogic, Number(budget.value));
  plan.append(el('p', `Propuesta: ${proposed.items.length} bloques de 25 min · ${proposed.pending} tareas pendientes. Son bloques para avanzar, no estimaciones de cuánto tarda cada tarea. Las pausas no están incluidas.`, 'study-hint'));
  for (const item of proposed.items) {
    const row = el('div', null, 'study-row'); row.dataset.taskId = item.task.id;
    row.append(el('span', `${item.category.name} · ${item.task.title} · ${item.date || 'Sin fecha'}${item.date && item.date < todayIso() ? ' · Atrasada' : ''}`));
    const focus = button('Empezar tarea', async () => {
      if (!confirmFocus()) return;
      assertCategory(item.category);
      const mapping = focusCategory(item.category); draft(item.category).pomodoroCategory = mapping; await persist();
      await startPomodoroFor(item, mapping);
      panel?.remove(); panel = null; document.removeEventListener('mk:pomodoro-history', updateStats);
    }); focus.disabled = !canFocus(); row.append(focus); plan.append(row);
  }
  if (!proposed.items.length) plan.append(el('p', 'No hay tareas pendientes en las categorías de Home.'));
  plan.append(el('p', 'Prioridad: atrasadas → hoy → próximos 7 días → sin fecha → más adelante. El Pomodoro usa tu duración configurada; los bloques del plan son orientativos.', 'study-hint'));
  box.append(plan);
  box.append(renderWeekly());
  const label = el('label', 'Asignatura (categoría de Home) ');
  const select = el('select'); select.id = 'study-subject';
  data.categories.forEach((cat) => { const option = el('option', cat.name); option.value = cat.id; select.append(option); });
  select.value = selectedId;
  select.addEventListener('change', () => { selectedId = select.value; errorText = ''; statusText = ''; render(); });
  label.append(select); box.append(label);
  box.append(el('p', dataRoot ? `Materiales guardados en el Home de: ${dataRoot}` : 'Materiales guardados en el Home personal de MK.', 'study-hint'));
  const cat = category();
  if (!cat) {
    box.append(el('p', 'Crea una categoría en Home → 🏷 Categorías para empezar.'));
    box.append(button('Abrir categorías de Home', () => { window.mdHome.openCategories(); }));
  } else {
    box.append(button('Vista dividida · PDF, nota y pizarra', async () => {
      assertCategory(cat);
      await openWorkspace(subject(cat).materials);
    }, 'study-open-workspace'));
    const mapping = el('section', null, 'study-section');
    const learning = L.normalize(data.study).learning;
    const due = L.dueCards(learning.cards, cat.id).length;
    box.append(button(`Repaso y examen · ${due} pendientes`, () => window.mdLearning.open(cat.id), 'study-learning'));
    box.append(renderTopics(cat));
    mapping.append(el('h3', 'Tiempo de estudio'));
    const mapLabel = el('label', 'Categoría de Pomodoro ');
    const input = el('input'); input.id = 'study-focus-category'; input.value = focusCategory(cat); input.maxLength = 80; input.setAttribute('list', 'study-focus-options');
    const options = el('datalist'); options.id = 'study-focus-options';
    for (const name of [...new Set([cat.name, ...window.mdPomodoroHistory.getState().categories])]) { const option = el('option'); option.value = name; options.append(option); }
    mapLabel.append(input);
    mapping.append(mapLabel, options, button('Guardar vínculo de tiempo', async () => {
      assertCategory(cat);
      const name = input.value.trim(); if (!name) throw new Error('Escribe o elige una categoría de Pomodoro.');
      draft(cat).pomodoroCategory = name; await persist();
    }, 'study-save-mapping'));
    const totals = el('div', null, 'study-totals');
    for (const [key, text] of [['today', 'Hoy'], ['week', 'Esta semana'], ['all', 'Total']]) {
      const cell = el('div'); const value = el('strong'); value.id = `study-time-${key}`;
      cell.append(el('span', text), value); totals.append(cell);
    }
    mapping.append(totals, el('p', 'Tiempo registrado de esa categoría de Pomodoro (incluye parciales). Si dos asignaturas usan la misma categoría, comparten estos totales. Se actualiza al guardar checkpoints, pausar o finalizar.', 'study-hint'));
    const focus = button('Iniciar foco de esta asignatura', async () => {
      if (!confirmFocus()) return;
      assertCategory(cat);
      const name = focusCategory(cat); draft(cat).pomodoroCategory = name; await persist();
      await window.mdPomodoro.startForContext(name, '', `Asignatura: ${cat.name}`);
      statusText = `Foco iniciado: ${cat.name}.`;
    }, 'study-start-focus'); focus.disabled = !canFocus();
    const history = button('Ver historial de Pomodoros', async () => {
      await window.mdPomodoroPanel.open();
      panel?.remove(); panel = null; document.removeEventListener('mk:pomodoro-history', updateStats);
    }); history.disabled = !canFocus();
    mapping.append(focus, history); box.append(mapping);
    const materials = el('section', null, 'study-section');
    materials.append(el('h3', 'Apuntes y PDFs'));
    materials.append(button('Vincular nota abierta', () => linkMaterial(window.mdPomodoro.activeNotePath()), 'study-link-active'));
    materials.append(button('Elegir apunte, PDF o pizarra…', async () => { const path = await window.mdEditor.openFile(); if (path) await linkMaterial(path); }, 'study-pick-material'));
    materials.append(el('p', 'Son enlaces a archivos, no copias. En el diálogo, elige Todos los archivos para ver PDFs y pizarras. Para notas nuevas, guarda el archivo primero.', 'study-hint'));
    const list = el('div'); list.id = 'study-materials';
    for (const material of subject(cat).materials) {
      const row = el('div', null, 'study-row'); row.dataset.path = material.path;
      const name = el('span', material.label); name.title = material.path;
      const focus = button('Abrir e iniciar foco', () => openMaterial(material, true)); focus.disabled = !canFocus();
      row.append(name, button('Abrir', () => openMaterial(material)), focus, button('Desvincular', async () => {
        assertCategory(cat); draft(cat).materials = subject(cat).materials.filter((m) => m.path !== material.path); await persist();
      })); list.append(row);
    }
    if (!subject(cat).materials.length) list.append(el('p', 'Vincula el primer material de esta asignatura.'));
    materials.append(list); box.append(materials);
    const tasks = L.pendingTasks(data.tasks.filter((task) => task.kind !== 'reminder'), cat.id, todayIso(), window.mdHomeLogic);
    const until = window.mdHomeLogic.iso(window.mdHomeLogic.addDays(new Date(), 30));
    for (const [title, items, id] of [
      ['Próximas entregas · 30 días', tasks.filter((item) => item.date && item.date >= todayIso() && item.date <= until), 'study-upcoming'],
      ['Tareas pendientes', tasks, 'study-pending']
    ]) {
      const section = el('section', null, 'study-section'); section.id = id;
      section.append(el('h3', `${title} (${items.length})`));
      items.slice(0, 100).forEach((item) => {
        const row = el('div', null, 'study-row'); row.dataset.taskId = item.task.id;
        row.append(el('span', `${item.task.title} · ${item.date || 'Sin fecha'}${item.date && item.date < todayIso() ? ' · Atrasada' : ''}${item.recurring ? ' · Repetición' : ''}`));
        row.append(button('Ver tarea en Home', async () => {
          await window.mdHome.revealTask(item.task.id, item.date);
          panel?.remove(); panel = null; document.removeEventListener('mk:pomodoro-history', updateStats);
        }));
        const focus = button('Foco en esta tarea', async () => {
          if (!confirmFocus()) return;
          assertCategory(cat); const name = focusCategory(cat); draft(cat).pomodoroCategory = name; await persist();
          await startPomodoroFor(item, name);
          panel?.remove(); panel = null; document.removeEventListener('mk:pomodoro-history', updateStats);
        }); focus.disabled = !canFocus(); row.append(focus); section.append(row);
      });
      if (!items.length) section.append(el('p', 'No hay tareas de Home en esta sección.'));
      if (items.length > 100) section.append(el('p', 'Se muestran las primeras 100. Consulta todas en Home.'));
      box.append(section);
    }
    box.append(el('p', 'Tareas de la categoría de Home; no incluye casillas de notas ni filas de bases de datos. Para series recurrentes se muestra su siguiente repetición pendiente dentro de 30 días.', 'study-hint'));
  }
  box.append(button('Actualizar', async () => { await load(); archivedTasks = await loadArchive(); profile = dataRoot; }), button('Reintentar guardado', persist), button('Cerrar', () => {
    busy = false; closeStudy();
  }, 'study-close'));
  updateStats();
  updateLearningCounts();
}
function refresh() {
  if (busy) return;
  updateLearningCounts();
  profile = dataRoot; if (panel) render();
}
function updateLearningCounts() {
  const learning = L.normalize(data.study).learning;
  const ids = new Set(data.categories.map((c) => c.id));
  const due = L.dueCards(learning.cards.filter((c) => ids.has(c.category)), '').length;
  const button = document.getElementById('home-study-btn');
  if (button) button.textContent = due ? `Estudio · ${due} repasos` : 'Estudio';
  const selected = panel?.querySelector('#study-learning');
  if (selected && category()) selected.textContent = `Repaso y examen · ${L.dueCards(learning.cards, category().id).length} pendientes`;
  if (panel && category()) for (const topic of subject(category()).topics || []) {
    const node = [...panel.querySelectorAll('[data-topic-evidence]')].find((n) => n.dataset.topicEvidence === topic.id);
    if (node) node.textContent = evidenceText(L.topicEvidence(topic, learning, category().id));
  }
}
export async function openStudy(categoryId = '') {
  if (window.mdModules && !window.mdModules.isOn('home')) return;
  await load(); await window.mdPomodoroHistory.ready;
  archivedTasks = await loadArchive();
  if (panel) { refresh(); return; }
  selectedId = categoryId || selectedId;
  profile = dataRoot; errorText = ''; statusText = '';
  previousFocus = document.activeElement;
  panel = el('div', null, 'modal-overlay'); panel.id = 'study-panel';
  const box = el('div', null, 'modal study-dialog');
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'study-title');
  panel.append(box); document.body.append(panel);
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); closeStudy(); }
    if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  panel.addEventListener('mousedown', (event) => { if (event.target === panel) closeStudy(); });
  document.addEventListener('mk:pomodoro-history', updateStats);
  render(); panel.querySelector('select')?.focus();
}
window.mdStudy = { open: openStudy, close: closeStudy, refresh, linkMaterial, openLearning: async () => { await openStudy(); if (category()) window.mdLearning.open(category().id); }, getState: () => L.normalize(data.study) };
setInterval(updateLearningCounts, 60000);
