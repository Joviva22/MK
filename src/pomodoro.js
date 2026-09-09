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

async function focusMinutes() {
  const config = await window.mdEditor.getConfig();
  return config.pomodoroFocusMinutes != null ? config.pomodoroFocusMinutes : 25;
}

async function breakMinutes() {
  const config = await window.mdEditor.getConfig();
  return config.pomodoroBreakMinutes != null ? config.pomodoroBreakMinutes : 5;
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
  const label = phase === 'focus' ? '🍅 Foco' : '☕ Descanso';
  statusEl.textContent = `${label} ${formatTime(remainingSeconds)}${running ? '' : ' (pausado)'}`;
  btn.title = running ? 'Pomodoro: pausar' : 'Pomodoro: reanudar';
}

function notifyPhaseEnd(endedPhase, nextMinutes) {
  try {
    const title = endedPhase === 'focus' ? 'Pomodoro: fin del foco' : 'Pomodoro: fin del descanso';
    const body = endedPhase === 'focus'
      ? `Arrancó un descanso de ${nextMinutes} min.`
      : `Arrancó un nuevo ciclo de foco de ${nextMinutes} min.`;
    // eslint-disable-next-line no-new
    new Notification(title, { body });
  } catch (e) {
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
  intervalId = setInterval(tick, 1000);
}

async function switchPhase() {
  stopInterval(); // corta ya mismo — el round-trip de config de abajo es async
  const endedPhase = phase;
  phase = endedPhase === 'focus' ? 'break' : 'focus';
  const nextMinutes = phase === 'focus' ? await focusMinutes() : await breakMinutes();
  remainingSeconds = nextMinutes * 60;
  notifyPhaseEnd(endedPhase, nextMinutes);
  updateUI();
  if (running) startInterval();
}

function tick() {
  remainingSeconds--;
  if (remainingSeconds <= 0) {
    switchPhase();
    return;
  }
  updateUI();
}

async function toggle() {
  if (phase === 'idle') {
    phase = 'focus';
    remainingSeconds = (await focusMinutes()) * 60;
    running = true;
    startInterval();
    updateUI();
    return;
  }
  running = !running;
  if (running) startInterval(); else stopInterval();
  updateUI();
}

function reset() {
  phase = 'idle';
  running = false;
  remainingSeconds = 0;
  stopInterval();
  updateUI();
}

btn.addEventListener('click', toggle);
statusEl.addEventListener('click', reset);

window.mdPomodoro = {
  toggle,
  reset,
  getState: () => ({ phase, running, remainingSeconds })
};

})();
