(function () {
'use strict';

// Temporizador Pomodoro: ciclos de foco/descanso con notificación al
// terminar cada uno. Los minutos de cada fase se leen de config.json
// (Ajustes → Pomodoro) en el momento en que arranca cada fase — directo,
// no a través de una variable cacheada de settings.js, así siempre agarra
// el valor más reciente sin acoplarse a cuándo corrió ese módulo.

const btn = document.getElementById('btn-pomodoro');
const statusEl = document.getElementById('status-pomodoro');

let phase = 'idle'; // 'idle' | 'focus' | 'break'
let running = false;
let remainingSeconds = 0;
let intervalId = null;
let remainingMs = 0;
let elapsedMs = 0;
let lastAt = 0;
let checkpointMs = 0;
let sessionId = null;
let startedAt = null;
let category = '';
let notePath = '';
let detail = '';
let durationOverride = null;
let generation = 0;
let transitioning = false;
let saveErrorShown = false;

function validMinutes(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1440 ? Number(value) : fallback;
}
// Tarea del Home asociada (ver home.js startPomodoroFor): su título se ve en
// la barra de estado, y al terminar cada foco se llama onFocusEnd — si
// devuelve false, la tarea deja de estar asociada.
let linked = null; // { label, onFocusEnd }

async function focusMinutes() {
  const config = await window.mdEditor.getConfig();
  return durationOverride || validMinutes(config.pomodoroFocusMinutes, 25);
}

async function breakMinutes() {
  const config = await window.mdEditor.getConfig();
  return validMinutes(config.pomodoroBreakMinutes, 5);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateUI() {
  if (phase === 'idle') {
    statusEl.hidden = true;
    btn.title = 'Pomodoro: iniciar (foco/descanso configurables en Ajustes)';
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = '';
  if (phase === 'focus') {
    statusEl.append(window.mdLuckyEmblem.mini(), ' Foco');
  } else {
    statusEl.append('☕ Descanso');
  }
  statusEl.append(` ${formatTime(remainingSeconds)}${running ? '' : ' (pausado)'}${category ? ` · ${category}` : ''}${linked ? ` · ${linked.label}` : ''}${notePath ? ` · ${notePath.split('/').pop()}` : ''}`);
  btn.title = running ? 'Pomodoro: pausar' : 'Pomodoro: reanudar';
}

function notifyPhaseEnd(endedPhase, nextMinutes) {
  try {
    const title = endedPhase === 'focus' ? 'Pomodoro: fin del foco' : 'Pomodoro: fin del descanso';
    const body = endedPhase === 'focus'
      ? `Arrancó un descanso de ${nextMinutes} min.`
      : `Arrancó un nuevo ciclo de foco de ${nextMinutes} min.`;
    new Notification(title, { body });
  } catch {
    // Notification puede no estar disponible/permitida en algunos entornos
    // (ej. la suite de tests) — no tiene que romper el temporizador.
  }
}

function stopInterval() {
  clearInterval(intervalId);
  intervalId = null;
}

function startInterval() {
  stopInterval();
  lastAt = performance.now();
  intervalId = setInterval(tick, 1000);
}

function account() {
  if (!running || transitioning) return;
  const now = performance.now();
  const spent = Math.min(remainingMs, Math.max(0, now - lastAt));
  remainingMs -= spent;
  if (phase === 'focus') elapsedMs += spent;
  lastAt = now;
  remainingSeconds = Math.ceil(remainingMs / 1000);
}

function saveFocus(completed) {
  if (phase !== 'focus' || elapsedMs <= 0) return Promise.resolve();
  checkpointMs = elapsedMs;
  return window.mdPomodoroHistory.record({ id: sessionId, category, seconds: elapsedMs / 1000, date: startedAt, completed, task: linked?.label || '', notePath, detail }).catch((error) => {
    window.mdEditor.logError('pomodoro:history', String(error));
    if (!saveErrorShown) {
      saveErrorShown = true;
      alert('No se pudo guardar el tiempo del Pomodoro. Sigue en memoria: abre el historial y pulsa Reintentar guardado antes de cerrar MK.');
    }
  });
}

function preparePhase(minutes) {
  remainingMs = minutes * 60000;
  remainingSeconds = Math.ceil(remainingMs / 1000);
  elapsedMs = 0;
  checkpointMs = 0;
  sessionId = crypto.randomUUID();
  startedAt = new Date().toISOString();
}

async function switchPhase() {
  if (transitioning) return;
  transitioning = true;
  const version = ++generation;
  stopInterval(); // corta ya mismo — el round-trip de config de abajo es async
  const endedPhase = phase;
  saveFocus(true);
  if (endedPhase === 'focus' && window.mdPet) window.mdPet.gain('pomodoro', null);
  if (endedPhase === 'focus' && linked) {
    const keep = linked.onFocusEnd();
    if (keep === false) linked = null;
  }
  const nextPhase = endedPhase === 'focus' ? 'break' : 'focus';
  let nextMinutes;
  try { nextMinutes = nextPhase === 'focus' ? await focusMinutes() : await breakMinutes(); }
  catch { nextMinutes = nextPhase === 'focus' ? 25 : 5; }
  if (version !== generation) return;
  phase = nextPhase;
  preparePhase(nextMinutes);
  transitioning = false;
  notifyPhaseEnd(endedPhase, nextMinutes);
  updateUI();
  if (running) startInterval();
}

function tick() {
  account();
  if (remainingSeconds <= 0) {
    switchPhase();
    return;
  }
  if (phase === 'focus' && elapsedMs - checkpointMs >= 15000) saveFocus(false);
  updateUI();
}

async function toggle() {
  if (transitioning) return;
  if (phase === 'idle') {
    const version = ++generation;
    transitioning = true;
    let minutes;
    try { minutes = await focusMinutes(); }
    catch { transitioning = false; alert('No se pudieron cargar los ajustes del Pomodoro.'); return; }
    if (version !== generation) return;
    transitioning = false;
    phase = 'focus';
    preparePhase(minutes);
    running = true;
    startInterval();
    updateUI();
    return;
  }
  account();
  if (remainingMs <= 0) { await switchPhase(); return; }
  running = !running;
  if (running) startInterval(); else stopInterval();
  if (!running) saveFocus(false);
  updateUI();
}

// Arranca un foco nuevo (cortando el que hubiera) asociado a una tarea.
async function startFor(label, onFocusEnd, taskCategory) {
  await reset();
  linked = { label, onFocusEnd };
  if (taskCategory !== undefined) {
    category = window.mdPomodoroLogic.category(taskCategory);
    window.mdPomodoroHistory.selectCategory(category).catch(() => {});
  }
  await toggle();
}

function reset() {
  account();
  const saving = transitioning ? Promise.resolve() : saveFocus(false);
  generation++;
  transitioning = false;
  linked = null;
  notePath = '';
  detail = '';
  phase = 'idle';
  running = false;
  remainingSeconds = 0;
  stopInterval();
  updateUI();
  return saving;
}

function activeNotePath() {
  const mode = window.mdCodeMirror?.getOption('mode');
  return (typeof mode === 'string' ? mode : mode?.name) === 'markdown' ? window.mdPomodoroLogic.notePath(window.mdTabs?.getActiveTabInfo()?.filePath) : '';
}

function setContext(nextNote, nextDetail) {
  if (transitioning) throw new Error('Espera a que termine el cambio de fase.');
  account();
  if (phase !== 'idle' && remainingMs <= 0) { switchPhase(); throw new Error('La fase acaba de terminar. Espera al siguiente ciclo.'); }
  notePath = window.mdPomodoroLogic.notePath(nextNote);
  detail = window.mdPomodoroLogic.detail(nextDetail);
  saveFocus(false);
  updateUI();
}

async function startForNote() {
  const path = activeNotePath();
  if (!path) throw new Error('Abre y guarda una nota Markdown antes de vincular un foco.');
  await reset();
  notePath = path;
  await toggle();
}

async function startForContext(nextCategory, nextNote = '', nextDetail = '') {
  const context = { category: window.mdPomodoroLogic.category(nextCategory), notePath: window.mdPomodoroLogic.notePath(nextNote), detail: window.mdPomodoroLogic.detail(nextDetail) };
  await window.mdPomodoroHistory.ready;
  await reset(); // guarda el foco anterior antes de cambiar su contexto
  category = context.category;
  notePath = context.notePath;
  detail = context.detail;
  await window.mdPomodoroHistory.selectCategory(category);
  await toggle();
}

btn.addEventListener('click', toggle);
statusEl.addEventListener('click', () => window.mdPomodoroPanel.open());
statusEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.mdPomodoroPanel.open(); }
});
statusEl.title = 'Abrir categorías, estadísticas e historial de Pomodoros';

window.mdPomodoroHistory.ready.then(() => {
  if (!category) category = window.mdPomodoroHistory.getState().selectedCategory;
});

window.mdPomodoro = {
  toggle,
  startFor,
  startForNote,
  startForContext,
  activeNotePath,
  setContext,
  reset,
  getState: () => ({ phase, running, remainingSeconds, category, notePath, detail, task: linked?.label || '', durationOverride, elapsedSeconds: elapsedMs / 1000, sessionId, transitioning }),
  configure(nextCategory, minutes) {
    if (transitioning) throw new Error('Espera a que termine el cambio de fase.');
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) throw new Error('Minutos no válidos (mayor que cero, máximo 1440).');
    account();
    if (phase !== 'idle' && remainingMs <= 0) { switchPhase(); throw new Error('La fase acaba de terminar. Espera al siguiente ciclo.'); }
    category = window.mdPomodoroLogic.category(nextCategory);
    if (phase === 'idle') durationOverride = minutes;
    else { remainingMs = minutes * 60000; remainingSeconds = Math.ceil(remainingMs / 1000); saveFocus(false); }
    updateUI();
  },
  setCategory(name) {
    account();
    category = window.mdPomodoroLogic.category(name);
    if (!transitioning) saveFocus(false);
    updateUI();
  },
  useConfiguredDuration() { durationOverride = null; }
};

})();
