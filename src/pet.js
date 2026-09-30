(function () {
'use strict';

// Mascota virtual (idea de vscode-pets / vscode-pokemon, con criaturas
// PROPIAS: nada de personajes con marca registrada). Camina al pie del
// sidebar (o por toda la ventana), gana experiencia con lo que hacés y
// evoluciona en 3 etapas:
//   - +10 XP por cada tarea tildada (Home o tarea 📅 de una nota), una sola
//     vez por tarea/día (tildar-destildar no suma de nuevo);
//   - +25 XP por cada Pomodoro de foco terminado;
//   - +2 XP al darle de comer (una vez por día).
// Nivel = 1 + ⌊√(XP/15)⌋. Evoluciona en el nivel 5 y en el 10.
// Ánimo: contenta, o preocupada si tenés tareas atrasadas.
// Clic: tarjeta con nivel y experiencia. Doble clic: le tirás la pelota.

const SPECIES = {
  fuego: {
    names: ['Chispi', 'Chispón', 'Brasadrake'],
    main: '#ff8a3d', belly: '#ffd89a', dark: '#c9502a', extra: '#ffcf3d'
  },
  agua: {
    names: ['Gotín', 'Olaquín', 'Marejón'],
    main: '#4aa8ff', belly: '#cfe9ff', dark: '#2b72c4', extra: '#8fd3ff'
  },
  planta: {
    names: ['Brotito', 'Hojarín', 'Robleón'],
    main: '#6cc070', belly: '#e0f5cf', dark: '#3d8a44', extra: '#ff7eb6'
  },
  // Personajes de un juego de RPG Maker (hojas 4×4, ver ipc-pet.js).
  game: {
    names: ['Mi mascota', 'Mi mascota', 'Mi mascota'],
    main: '#ff8a3d', belly: '#ffd89a', dark: '#c9502a', extra: '#ffcf3d'
  },
  // Imágenes propias del usuario (ipc-pet.js), una por etapa.
  custom: {
    names: ['Mi mascota', 'Mi mascota', 'Mi mascota'],
    main: '#ff8a3d', belly: '#ffd89a', dark: '#c9502a', extra: '#ffcf3d'
  }
};

// Especies que se dibujan con imágenes (del juego o propias), no en SVG.
function isImageSpecies(species) {
  return species === 'custom' || species === 'game';
}

// { 1: { url, sheet, label } | null, 2: ..., 3: ... } de las imágenes
// propias. sheet: hoja de caminata 4×4 de RPG Maker (filas: abajo,
// izquierda, derecha, arriba; 4 pasos cada una).
let customSprites = { 1: null, 2: null, 3: null };

async function loadCustomSprites() {
  const sprites = await window.mdEditor.pet.sprites();
  const v = Date.now();
  customSprites = {};
  [1, 2, 3].forEach((n) => {
    const sp = sprites[n];
    customSprites[n] = sp ? { url: `${window.mdEditor.toLocalUrl(sp.path)}?v=${v}`, sheet: sp.sheet, label: sp.label } : null;
  });
}

function customSprite(stage) {
  for (let s = stage; s >= 1; s--) if (customSprites[s]) return customSprites[s];
  return customSprites[2] || customSprites[3] || null;
}

const XP = { task: 10, pomodoro: 25, feed: 2 };
const EVOLVE_AT = [5, 10]; // nivel para la etapa 2 y la 3
const MAX_AWARDED = 3000;

const DEFAULT_STATE = { enabled: true, species: 'fuego', name: '', xp: 0, awarded: [], lastFed: '', position: 'sidebar' };
let state = { ...DEFAULT_STATE };
let overdue = 0;

function levelFor(xp) {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 15));
}

function xpForLevel(level) {
  return 15 * (level - 1) * (level - 1);
}

function stageFor(level) {
  if (level >= EVOLVE_AT[1]) return 3;
  if (level >= EVOLVE_AT[0]) return 2;
  return 1;
}

function speciesName(st) {
  const stage = stageFor(levelFor(st.xp));
  if (isImageSpecies(st.species)) {
    const sp = customSprite(stage);
    if (sp && sp.label) return sp.label;
  }
  return SPECIES[st.species].names[stage - 1];
}

function stageName(species, stage) {
  if (isImageSpecies(species)) {
    const sp = customSprites[stage] || customSprite(stage);
    if (sp && sp.label) return sp.label;
  }
  return SPECIES[species].names[stage - 1];
}

function displayName() {
  return state.name || speciesName(state);
}

// ---------- dibujo (SVG 64×64, el piso en y=60) ----------

function face(cx, cy, mood, scale) {
  const s = scale || 1;
  const dx = 6.5 * s;
  const r = 3.1 * s;
  let eyes;
  if (mood === 'sleep') {
    eyes = `<path d="M${cx - dx - r} ${cy} q${r} ${r * 0.8} ${2 * r} 0 M${cx + dx - r} ${cy} q${r} ${r * 0.8} ${2 * r} 0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  } else {
    eyes = [cx - dx, cx + dx].map((x) => `<g class="pet-eye"><circle cx="${x}" cy="${cy}" r="${r}" fill="#2b2b2b"/><circle cx="${x + r * 0.35}" cy="${cy - r * 0.4}" r="${r * 0.35}" fill="#fff"/></g>`).join('');
  }
  const my = cy + 6 * s;
  let mouth;
  if (mood === 'sad') mouth = `<path d="M${cx - 3 * s} ${my + 2 * s} q${3 * s} ${-3 * s} ${6 * s} 0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M${cx + dx + 1} ${cy + 3 * s} q1.5 3 0 4.5 q-1.5 -1.5 0 -4.5z" fill="#7cc4ff"/>`;
  else if (mood === 'happy') mouth = `<path d="M${cx - 3.5 * s} ${my - 1} q${3.5 * s} ${5 * s} ${7 * s} 0z" fill="#8a2f2f"/>`;
  else mouth = `<path d="M${cx - 2.5 * s} ${my} q${2.5 * s} ${2.5 * s} ${5 * s} 0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  const blush = `<ellipse cx="${cx - dx - 3 * s}" cy="${cy + 4 * s}" rx="${2.2 * s}" ry="${1.3 * s}" fill="#ff6b8a" opacity="0.35"/><ellipse cx="${cx + dx + 3 * s}" cy="${cy + 4 * s}" rx="${2.2 * s}" ry="${1.3 * s}" fill="#ff6b8a" opacity="0.35"/>`;
  return eyes + mouth + blush;
}

function feet(y, spread, c) {
  return `<ellipse cx="${32 - spread}" cy="${y}" rx="5" ry="3" fill="${c}"/><ellipse cx="${32 + spread}" cy="${y}" rx="5" ry="3" fill="${c}"/>`;
}

function flame(x, y, size, c1, c2) {
  const s = size;
  return `<path class="pet-flame" d="M${x} ${y - 9 * s} C${x + 5 * s} ${y - 3 * s} ${x + 6 * s} ${y + 1 * s} ${x} ${y + 3 * s} C${x - 6 * s} ${y + 1 * s} ${x - 4 * s} ${y - 4 * s} ${x} ${y - 9 * s}Z" fill="${c1}"/><path d="M${x} ${y - 4 * s} C${x + 2.5 * s} ${y - 1 * s} ${x + 2.5 * s} ${y + 1.5 * s} ${x} ${y + 2.5 * s} C${x - 2.5 * s} ${y + 1.5 * s} ${x - 2 * s} ${y - 1 * s} ${x} ${y - 4 * s}Z" fill="${c2}"/>`;
}

function leaf(x, y, angle, size, c) {
  return `<path transform="translate(${x} ${y}) rotate(${angle}) scale(${size})" d="M0 0 C4 -6 10 -7 14 -6 C12 -1 6 3 0 0Z" fill="${c}" stroke="rgba(0,0,0,0.15)" stroke-width="0.6"/>`;
}

function drawFuego(stage, mood, c) {
  if (stage === 1) {
    return feet(57, 7, c.dark) +
      `<ellipse cx="32" cy="43" rx="16" ry="15" fill="${c.main}"/><ellipse cx="32" cy="48" rx="9" ry="7.5" fill="${c.belly}"/>` +
      flame(32, 27, 0.9, c.extra, '#fff3b0') + face(32, 40, mood, 0.95);
  }
  if (stage === 2) {
    return `<path d="M46 48 C56 46 58 38 55 32" stroke="${c.main}" stroke-width="5" fill="none" stroke-linecap="round"/>` + flame(55, 30, 0.8, c.extra, '#fff3b0') +
      feet(58, 8, c.dark) +
      `<path d="M21 26 L19 15 L27 22Z M43 26 L45 15 L37 22Z" fill="${c.dark}"/>` +
      `<ellipse cx="32" cy="41" rx="17" ry="18" fill="${c.main}"/><ellipse cx="32" cy="47" rx="10" ry="9" fill="${c.belly}"/>` +
      face(32, 36, mood, 1);
  }
  return `<path d="M20 36 C6 26 4 16 8 12 C12 20 16 24 22 28Z M44 36 C58 26 60 16 56 12 C52 20 48 24 42 28Z" fill="${c.dark}" opacity="0.9"/>` +
    `<path d="M48 50 C60 50 63 40 60 33" stroke="${c.main}" stroke-width="6" fill="none" stroke-linecap="round"/>` + flame(60, 31, 1, c.extra, '#fff3b0') +
    feet(59, 9, c.dark) +
    `<path d="M20 24 L15 9 L27 19Z M44 24 L49 9 L37 19Z" fill="#f4e3c0"/>` +
    `<ellipse cx="32" cy="39" rx="20" ry="20" fill="${c.main}"/><ellipse cx="32" cy="46" rx="12" ry="11" fill="${c.belly}"/>` +
    `<path d="M22 28 l7 2 M42 28 l-7 2" stroke="#7a2e14" stroke-width="1.6" stroke-linecap="round"/>` +
    face(32, 34, mood, 1.05);
}

function drawAgua(stage, mood, c) {
  if (stage === 1) {
    return feet(58, 7, c.dark) +
      `<path d="M32 22 C40 33 48 39 48 47 A16 13 0 0 1 16 47 C16 39 24 33 32 22Z" fill="${c.main}"/><ellipse cx="32" cy="50" rx="9" ry="6" fill="${c.belly}"/>` +
      `<ellipse cx="27" cy="33" rx="2.5" ry="4" fill="#fff" opacity="0.5"/>` + face(32, 42, mood, 0.95);
  }
  if (stage === 2) {
    return `<path d="M46 50 C55 50 58 44 60 40 C56 42 54 38 55 34 C52 40 50 44 45 45Z" fill="${c.dark}"/>` +
      feet(58, 8, c.dark) +
      `<path d="M30 22 L38 10 L40 24Z" fill="${c.dark}"/>` +
      `<ellipse cx="32" cy="42" rx="17" ry="17" fill="${c.main}"/><ellipse cx="32" cy="48" rx="10" ry="8" fill="${c.belly}"/>` +
      `<path d="M15 44 C9 42 8 38 10 35 C13 38 15 39 17 40Z M49 44 C55 42 56 38 54 35 C51 38 49 39 47 40Z" fill="${c.extra}"/>` +
      face(32, 38, mood, 1);
  }
  return `<path d="M47 50 C58 52 62 44 64 38 C59 41 57 36 58 31 C54 39 51 44 45 45Z" fill="${c.dark}"/>` +
    feet(59, 9, c.dark) +
    `<path d="M22 22 L24 8 L30 20Z M30 20 L33 5 L37 20Z M37 21 L42 9 L44 23Z" fill="${c.extra}"/>` +
    `<ellipse cx="32" cy="40" rx="20" ry="20" fill="${c.main}"/><ellipse cx="32" cy="47" rx="12" ry="10" fill="${c.belly}"/>` +
    `<path d="M12 44 C4 42 2 34 5 29 C9 34 12 36 15 38Z M52 44 C60 42 62 34 59 29 C55 34 52 36 49 38Z" fill="${c.extra}"/>` +
    `<path d="M24 52 q2 2 4 0 M36 52 q2 2 4 0" stroke="${c.dark}" stroke-width="1" fill="none"/>` +
    face(32, 35, mood, 1.05);
}

function drawPlanta(stage, mood, c) {
  if (stage === 1) {
    return feet(57, 7, c.dark) +
      `<path d="M32 30 C32 26 33 22 35 19" stroke="${c.dark}" stroke-width="1.8" fill="none"/>` + leaf(35, 20, -30, 0.9, '#8bd35f') + leaf(34, 21, 200, 0.7, '#8bd35f') +
      `<ellipse cx="32" cy="44" rx="15" ry="14" fill="${c.main}"/><ellipse cx="32" cy="49" rx="8.5" ry="7" fill="${c.belly}"/>` +
      face(32, 41, mood, 0.95);
  }
  if (stage === 2) {
    return feet(58, 8, c.dark) +
      leaf(32, 25, -60, 1.1, '#8bd35f') + leaf(32, 25, 240, 1.1, '#8bd35f') + leaf(32, 24, -95, 0.8, '#a5e27a') +
      `<ellipse cx="32" cy="42" rx="17" ry="17" fill="${c.main}"/><ellipse cx="32" cy="48" rx="10" ry="8" fill="${c.belly}"/>` +
      leaf(16, 43, 160, 0.8, '#8bd35f') + leaf(48, 43, 20, 0.8, '#8bd35f') +
      face(32, 38, mood, 1);
  }
  return feet(59, 9, c.dark) +
    leaf(32, 22, -40, 1.3, '#8bd35f') + leaf(32, 22, 220, 1.3, '#8bd35f') + leaf(32, 21, -80, 1.1, '#a5e27a') + leaf(32, 21, 260, 1.1, '#a5e27a') + leaf(32, 20, -115, 0.9, '#8bd35f') +
    `<g transform="translate(43 20)"><circle r="3" cx="0" cy="-3" fill="${c.extra}"/><circle r="3" cx="3" cy="0" fill="${c.extra}"/><circle r="3" cx="0" cy="3" fill="${c.extra}"/><circle r="3" cx="-3" cy="0" fill="${c.extra}"/><circle r="2" fill="#ffe066"/></g>` +
    `<ellipse cx="32" cy="40" rx="20" ry="20" fill="${c.main}"/><ellipse cx="32" cy="47" rx="12" ry="10" fill="${c.belly}"/>` +
    `<path d="M26 47 l3 4 M38 47 l-3 4 M32 45 v6" stroke="${c.dark}" stroke-width="1" opacity="0.5"/>` +
    leaf(13, 42, 170, 1, '#8bd35f') + leaf(51, 42, 10, 1, '#8bd35f') +
    face(32, 35, mood, 1.05);
}

function drawPet(species, stage, mood) {
  if (isImageSpecies(species)) {
    const sp = customSprite(stage);
    const badge = mood === 'sad' ? '😟' : mood === 'sleep' ? '💤' : mood === 'happy' ? '✨' : '';
    const b = badge ? `<span class="pet-mood-badge">${badge}</span>` : '';
    if (sp && sp.sheet) return `<div class="pet-sheet" style="background-image:url('${sp.url}')"></div>${b}`;
    if (sp) return `<img class="pet-img" src="${sp.url}" alt="" draggable="false"/>${b}`;
    species = 'fuego'; // sin imágenes todavía: la de fuego
  }
  const c = SPECIES[species] || SPECIES.fuego;
  const body = species === 'agua' ? drawAgua(stage, mood, c) : species === 'planta' ? drawPlanta(stage, mood, c) : drawFuego(stage, mood, c);
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><ellipse class="pet-shadow" cx="32" cy="61" rx="14" ry="2.5" fill="rgba(0,0,0,0.18)"/><g class="pet-body">${body}</g></svg>`;
}

// ---------- escena: carril, mascota, pelota, globo, tarjeta ----------

const lane = document.createElement('div');
lane.className = 'pet-lane';
lane.hidden = true;
const petEl = document.createElement('div');
petEl.className = 'pet';
petEl.setAttribute('role', 'button');
petEl.tabIndex = 0;
const sprite = document.createElement('div');
sprite.className = 'pet-sprite';
petEl.appendChild(sprite);
const bubble = document.createElement('div');
bubble.className = 'pet-bubble';
bubble.hidden = true;
petEl.appendChild(bubble);
const ball = document.createElement('div');
ball.className = 'pet-ball';
ball.hidden = true;
lane.append(ball, petEl);
document.body.appendChild(lane);

const card = document.createElement('div');
card.className = 'pet-card';
card.hidden = true;
card.setAttribute('role', 'dialog');
card.setAttribute('aria-label', 'Tu mascota');
document.body.appendChild(card);

let x = 20;
let dir = 1;
let mode = 'walk'; // walk | idle | chase | happy | sleep
let modeUntil = 0;
let ballX = null;
let lastInteraction = Date.now();
let loopId = null;
let currentMood = null;
let currentStage = null;

function size() {
  const stage = stageFor(levelFor(state.xp));
  // Sprites pixelados de juego: un poco más grandes (el cuadro trae aire).
  if (isImageSpecies(state.species) && customSprite(stage) && customSprite(stage).sheet) return [0, 60, 66, 72][stage];
  return [0, 42, 52, 62][stage];
}

function mood() {
  if (mode === 'sleep') return 'sleep';
  // El festejo vence por tiempo aunque la animación esté en pausa (ventana
  // oculta en la bandeja): si no, quedaría "contenta" para siempre.
  if (mode === 'chase' || (mode === 'happy' && Date.now() < modeUntil)) return 'happy';
  if (overdue > 0) return 'sad';
  return 'normal';
}

function render(force) {
  const stage = stageFor(levelFor(state.xp));
  const m = mood();
  if (force || m !== currentMood || stage !== currentStage) {
    sprite.innerHTML = drawPet(state.species, stage, m);
    currentMood = m;
    currentStage = stage;
    petEl.dataset.stage = String(stage);
    petEl.dataset.mood = m;
  }
  const s = size();
  petEl.style.width = `${s}px`;
  petEl.style.height = `${s}px`;
  petEl.style.transform = `translateX(${x}px)`;
  const sheet = sprite.querySelector('.pet-sheet');
  if (sheet) {
    // Hoja de RPG Maker: fila según la dirección (1 izquierda, 2 derecha,
    // 0 de frente quieta/durmiendo), columna = paso de la caminata.
    const moving = mode === 'walk' || mode === 'chase';
    const row = moving ? (dir < 0 ? 1 : 2) : 0;
    const col = moving ? Math.floor(Date.now() / 160) % 4 : 0;
    sheet.style.backgroundPosition = `${col * (100 / 3)}% ${row * (100 / 3)}%`;
    sprite.style.transform = 'none';
  } else {
    sprite.style.transform = `scaleX(${dir})`;
  }
  petEl.classList.toggle('pet-walking', mode === 'walk' || mode === 'chase');
  petEl.setAttribute('aria-label', `${displayName()}, nivel ${levelFor(state.xp)}. Clic: ver detalles. Doble clic: tirar la pelota.`);
}

function laneWidth() {
  return lane.clientWidth;
}

function say(text, ms) {
  bubble.textContent = text;
  bubble.hidden = false;
  clearTimeout(say.t);
  say.t = setTimeout(() => { bubble.hidden = true; }, ms || 2500);
}

function hearts() {
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('span');
    h.className = 'pet-heart';
    h.textContent = '♥';
    h.style.left = `${x + size() / 2 - 6 + (i - 1) * 10}px`;
    h.style.animationDelay = `${i * 120}ms`;
    lane.appendChild(h);
    setTimeout(() => h.remove(), 1400);
  }
}

function step() {
  if (lane.hidden) return;
  if (document.hidden) { // oculta: no camina, pero el ánimo se actualiza
    render();
    return;
  }
  const now = Date.now();
  const max = Math.max(0, laneWidth() - size());
  const speed = [0, 0.9, 1.1, 1.3][stageFor(levelFor(state.xp))];
  if (mode === 'chase' && ballX != null) {
    const target = Math.min(max, Math.max(0, ballX - size() / 2));
    dir = target > x ? 1 : -1;
    x += dir * speed * 3;
    if (Math.abs(target - x) < 4) {
      x = target;
      ball.hidden = true;
      ballX = null;
      mode = 'happy';
      modeUntil = now + 1400;
      hearts();
    }
  } else if (mode === 'walk') {
    x += dir * speed;
    if (x <= 0 || x >= max) {
      dir = x <= 0 ? 1 : -1;
      x = Math.min(max, Math.max(0, x));
    }
    if (Math.random() < 0.006) {
      mode = 'idle';
      modeUntil = now + 2000 + Math.random() * 4000;
    }
  } else if (now > modeUntil) {
    // Mucho rato sin tocarla: se duerme (hasta que hagas algo).
    mode = now - lastInteraction > 10 * 60 * 1000 ? 'sleep' : 'walk';
    if (mode === 'walk' && Math.random() < 0.5) dir = -dir;
    if (mode === 'sleep') modeUntil = now + 60 * 1000;
  }
  x = Math.min(max, Math.max(0, x));
  render();
}

function startLoop() {
  if (loopId) return;
  loopId = setInterval(step, 50);
}

function stopLoop() {
  clearInterval(loopId);
  loopId = null;
}

// ---------- carril: al pie del sidebar o por toda la ventana ----------

const sidebar = document.getElementById('sidebar-pane');
const statusbar = document.querySelector('.statusbar');

function placeLane() {
  if (lane.hidden) return;
  const bottom = statusbar ? statusbar.offsetHeight : 24;
  lane.style.bottom = `${bottom}px`;
  const onSidebar = state.position === 'sidebar' && sidebar && sidebar.offsetWidth > 60 && getComputedStyle(sidebar).display !== 'none';
  if (onSidebar) {
    const r = sidebar.getBoundingClientRect();
    lane.style.left = `${r.left}px`;
    lane.style.width = `${r.width}px`;
  } else {
    lane.style.left = '0px';
    lane.style.width = '100%';
  }
  document.body.classList.toggle('pet-on-sidebar', !!onSidebar);
}

if (sidebar) new ResizeObserver(placeLane).observe(sidebar);
window.addEventListener('resize', placeLane);

// ---------- interacción ----------

let clickTimer = null;
petEl.addEventListener('click', (e) => {
  e.stopPropagation();
  lastInteraction = Date.now();
  if (mode === 'sleep') { mode = 'idle'; modeUntil = Date.now() + 1500; }
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    hearts();
    toggleCard();
  }, 230);
});

petEl.addEventListener('dblclick', (e) => {
  e.stopPropagation();
  clearTimeout(clickTimer);
  throwBall();
});

petEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleCard();
  }
});

function throwBall() {
  lastInteraction = Date.now();
  const max = Math.max(0, laneWidth() - 14);
  const petCenter = x + size() / 2;
  // Lejos de donde está, para que corra.
  ballX = petCenter > laneWidth() / 2 ? Math.random() * max * 0.4 : max * (0.6 + Math.random() * 0.4);
  ball.style.left = `${ballX}px`;
  ball.hidden = false;
  ball.classList.remove('pet-ball-thrown');
  void ball.offsetWidth;
  ball.classList.add('pet-ball-thrown');
  mode = 'chase';
}

function feed() {
  const today = new Date().toISOString().slice(0, 10);
  lastInteraction = Date.now();
  hearts();
  if (state.lastFed === today) {
    say('¡Ya comí hoy, gracias! 😋');
    return;
  }
  state.lastFed = today;
  gain('feed', null);
  say('¡Ñam! +2 XP');
}

function toggleCard() {
  if (!card.hidden) {
    card.hidden = true;
    return;
  }
  renderCard();
  card.hidden = false;
  const r = petEl.getBoundingClientRect();
  const w = card.offsetWidth;
  card.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  card.style.bottom = `${window.innerHeight - r.top + 8}px`;
}

function renderCard() {
  const level = levelFor(state.xp);
  const stage = stageFor(level);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const pct = Math.round(((state.xp - from) / (to - from)) * 100);
  const nextName = stage < 3 ? stageName(state.species, stage + 1) : '';
  const next = stage < 3 ? `Evoluciona a <b class="pet-next-name"></b> en el nivel ${EVOLVE_AT[stage - 1]}` : 'Etapa final alcanzada ✨';
  const moodText = overdue > 0 ? `😟 Preocupada: ${overdue} tarea${overdue === 1 ? '' : 's'} atrasada${overdue === 1 ? '' : 's'}` : '😊 Contenta';
  card.innerHTML = `
    <div class="pet-card-head"><div class="pet-card-art">${drawPet(state.species, stage, overdue > 0 ? 'sad' : 'happy')}</div>
      <div><div class="pet-card-name"></div><div class="pet-card-species">${state.name ? speciesName(state) + ' · ' : ''}${{ fuego: 'Fuego', agua: 'Agua', planta: 'Planta', game: 'De un juego', custom: 'Imágenes propias' }[state.species]} · etapa ${stage}/3</div></div></div>
    <div class="pet-card-level">Nivel ${level} <span>${state.xp - from}/${to - from} XP</span></div>
    <div class="pet-card-bar"><div style="width:${pct}%"></div></div>
    <div class="pet-card-line">${next}</div>
    <div class="pet-card-line">${moodText}</div>
    <div class="pet-card-hint">+10 XP por tarea · +25 por Pomodoro · doble clic: pelota</div>
    <div class="pet-card-actions">
      <button type="button" class="toolbar-button" data-act="feed">🍖 Dar de comer</button>
      <button type="button" class="toolbar-button" data-act="ball">⚾ Pelota</button>
      <button type="button" class="toolbar-button" data-act="settings" title="Ajustes → Mascota">⚙</button>
    </div>`;
  card.querySelector('.pet-card-name').textContent = displayName(); // nombre elegido: como texto
  const nn = card.querySelector('.pet-next-name');
  if (nn) nn.textContent = nextName;
  card.querySelector('[data-act="feed"]').addEventListener('click', () => { feed(); renderCard(); });
  card.querySelector('[data-act="ball"]').addEventListener('click', () => { card.hidden = true; throwBall(); });
  card.querySelector('[data-act="settings"]').addEventListener('click', () => {
    card.hidden = true;
    if (window.mdSettingsPanel) window.mdSettingsPanel.open('pet');
  });
}

document.addEventListener('mousedown', (e) => {
  if (!card.hidden && !card.contains(e.target) && !petEl.contains(e.target)) card.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !card.hidden) card.hidden = true;
});

// ---------- experiencia ----------

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.mdEditor.setConfig({ pet: state }), 300);
}

function notifyEvolution(fromName, toName) {
  say(`¡Evolucioné a ${toName}! ✨`, 4000);
  petEl.classList.remove('pet-evolving');
  void petEl.offsetWidth;
  petEl.classList.add('pet-evolving');
  try {
    new Notification(`✨ ¡${fromName} evolucionó!`, { body: `Ahora es ${toName}. Seguí tildando tareas y terminando Pomodoros.` });
  } catch {
    // sin notificaciones del sistema: queda el globo
  }
}

// kind: 'task' | 'pomodoro' | 'feed'. key: identificador único de lo que la
// ganó (una tarea en un día); con la misma key no vuelve a sumar.
function gain(kind, key) {
  const amount = XP[kind] || 0;
  if (!amount) return null;
  if (key) {
    if (state.awarded.includes(key)) return { ...info(), duplicate: true };
    state.awarded.push(key);
    if (state.awarded.length > MAX_AWARDED) state.awarded.splice(0, state.awarded.length - MAX_AWARDED);
  }
  const beforeLevel = levelFor(state.xp);
  const beforeStage = stageFor(beforeLevel);
  const beforeName = speciesName(state);
  state.xp += amount;
  const after = info();
  lastInteraction = Date.now();
  if (state.enabled && !lane.hidden) {
    if (after.stage > beforeStage) notifyEvolution(state.name || beforeName, speciesName(state));
    else if (after.level > beforeLevel) say(`¡Nivel ${after.level}! 🎉`, 3000);
    else if (kind !== 'feed') say(`+${amount} XP`, 1600);
    if (kind !== 'feed') { mode = 'happy'; modeUntil = Date.now() + 1200; hearts(); }
    render(true);
  }
  if (!card.hidden) renderCard();
  save();
  return { ...after, evolved: after.stage > beforeStage, levelUp: after.level > beforeLevel };
}

function info() {
  const level = levelFor(state.xp);
  return { xp: state.xp, level, stage: stageFor(level), name: displayName(), species: state.species };
}

function setOverdue(n) {
  const was = overdue;
  overdue = Math.max(0, n | 0);
  if (overdue > 0 && was === 0 && !lane.hidden) say(`Hay ${overdue} tarea${overdue === 1 ? '' : 's'} atrasada${overdue === 1 ? '' : 's'}… 😟`, 3500);
  render();
}

// ---------- ajustes (sección Mascota) ----------

const enabledEl = document.getElementById('pet-enabled');
const speciesEl = document.getElementById('pet-species');
const nameEl = document.getElementById('pet-name');
const positionEl = document.getElementById('pet-position');
const resetEl = document.getElementById('pet-reset');
const customRow = document.getElementById('pet-custom-row');
const gameRow = document.getElementById('pet-game-row');
const spriteStatus = document.getElementById('pet-sprite-status');

function updateSpriteStatus() {
  if (!spriteStatus) return;
  const have = [1, 2, 3].filter((n) => customSprites[n]);
  spriteStatus.textContent = have.length ? `Cargadas: etapa ${have.join(', ')}` : 'Sin imágenes todavía (se usa la de fuego).';
}

document.querySelectorAll('.pet-sprite-picks [data-stage]').forEach((b) => {
  b.addEventListener('click', async () => {
    const res = await window.mdEditor.pet.pickSprite(Number(b.dataset.stage));
    if (res && res.error) { if (spriteStatus) spriteStatus.textContent = '⚠ ' + res.error; return; }
    if (!res || res.canceled) return;
    await loadCustomSprites();
    updateSpriteStatus();
    render(true);
  });
});
// ---- personajes de un juego (RPG Maker / Pokémon Essentials) ----
const charDirEl = document.getElementById('pet-char-dir');
const charSearch = document.getElementById('pet-char-search');
const charList = document.getElementById('pet-char-list');
const charStatus = document.getElementById('pet-char-status');
let catalog = null;

async function loadCatalog(dir) {
  if (!dir) return;
  if (charStatus) charStatus.textContent = 'Leyendo…';
  const res = await window.mdEditor.pet.charCatalog(dir);
  if (res.error) {
    catalog = null;
    if (charStatus) charStatus.textContent = '⚠ ' + res.error;
    renderCharList();
    return;
  }
  catalog = res;
  if (charDirEl) charDirEl.textContent = dir;
  if (charStatus) charStatus.textContent = `${res.lines.length} ${res.withEvolutions ? 'líneas evolutivas' : 'personajes'} (${res.total} sprites).`;
  renderCharList();
}

function renderCharList() {
  if (!charList) return;
  charList.innerHTML = '';
  if (!catalog) return;
  const q = (charSearch && charSearch.value.trim().toLowerCase()) || '';
  const matches = catalog.lines.filter((l) => !q || l.names.join(' ').toLowerCase().includes(q) || l.ids.join(' ').toLowerCase().includes(q)).slice(0, 60);
  matches.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pet-char-option';
    b.textContent = l.names.join(' → ');
    b.title = 'Usar esta línea como mascota';
    b.addEventListener('click', async () => {
      if (charStatus) charStatus.textContent = 'Copiando…';
      const res = await window.mdEditor.pet.useChars(catalog.dir, l.ids, l.names);
      if (res.error) { if (charStatus) charStatus.textContent = '⚠ ' + res.error; return; }
      state.species = 'game';
      state.charDir = catalog.dir;
      await loadCustomSprites();
      updateSpriteStatus();
      apply();
      render(true);
      save();
      if (charStatus) charStatus.textContent = `✔ Ahora tu mascota es ${l.names[0]}${l.names.length > 1 ? ` (evoluciona a ${l.names.slice(1).join(' y ')})` : ''}.`;
    });
    charList.appendChild(b);
  });
  if (!matches.length) charList.textContent = 'Nada coincide.';
}

if (charSearch) charSearch.addEventListener('input', renderCharList);
const pickDirBtn = document.getElementById('pet-char-pick');
if (pickDirBtn) {
  pickDirBtn.addEventListener('click', async () => {
    const dir = await window.mdEditor.pet.pickCharDir();
    if (!dir) return;
    state.charDir = dir;
    save();
    loadCatalog(dir);
  });
}

async function initCharDir() {
  let dir = state.charDir;
  if (!dir) {
    const found = await window.mdEditor.pet.findCharDirs();
    dir = found[0] || '';
  }
  if (dir) loadCatalog(dir);
  else if (charStatus) charStatus.textContent = 'Elegí la carpeta Graphics/Characters de tu juego.';
}

const clearBtn = document.getElementById('pet-clear-sprites');
if (clearBtn) {
  clearBtn.addEventListener('click', async () => {
    await window.mdEditor.pet.clearSprites();
    await loadCustomSprites();
    updateSpriteStatus();
    render(true);
  });
}

function apply() {
  lane.hidden = !state.enabled;
  document.body.classList.toggle('pet-on', state.enabled);
  if (state.enabled) {
    placeLane();
    startLoop();
    render(true);
  } else {
    stopLoop();
    card.hidden = true;
    document.body.classList.remove('pet-on-sidebar');
  }
  if (enabledEl) enabledEl.checked = state.enabled;
  if (speciesEl) speciesEl.value = state.species;
  if (nameEl && document.activeElement !== nameEl) nameEl.value = state.name;
  if (positionEl) positionEl.value = state.position;
  if (customRow) customRow.hidden = state.species !== 'custom';
  if (gameRow) gameRow.hidden = state.species !== 'game';
}

if (enabledEl) enabledEl.addEventListener('change', () => { state.enabled = enabledEl.checked; apply(); save(); });
if (speciesEl) speciesEl.addEventListener('change', () => { state.species = SPECIES[speciesEl.value] ? speciesEl.value : 'fuego'; apply(); render(true); save(); });
if (nameEl) nameEl.addEventListener('change', () => { state.name = nameEl.value.trim().slice(0, 24); apply(); save(); });
if (positionEl) positionEl.addEventListener('change', () => { state.position = positionEl.value === 'window' ? 'window' : 'sidebar'; apply(); save(); });
if (resetEl) {
  resetEl.addEventListener('click', () => {
    if (!confirm('¿Reiniciar la mascota? Vuelve al nivel 1 (etapa 1) y pierde la experiencia.')) return;
    state.xp = 0;
    state.awarded = [];
    state.lastFed = '';
    apply();
    render(true);
    save();
  });
}

(async () => {
  const config = await window.mdEditor.getConfig();
  const saved = config.pet && typeof config.pet === 'object' ? config.pet : {};
  state = {
    ...DEFAULT_STATE,
    ...saved,
    species: SPECIES[saved.species] ? saved.species : 'fuego',
    xp: Number.isFinite(saved.xp) ? Math.max(0, saved.xp) : 0,
    awarded: Array.isArray(saved.awarded) ? saved.awarded.slice(-MAX_AWARDED) : [],
    position: saved.position === 'window' ? 'window' : 'sidebar'
  };
  await loadCustomSprites();
  updateSpriteStatus();
  initCharDir();
  // En la suite de tests arranca apagada (no se mueve entre los checks).
  if (window.location.search.includes('mkTestFixtures') && !('pet' in config)) state.enabled = false;
  apply();
})();

window.mdPet = {
  gain,
  info,
  setOverdue,
  throwBall,
  feed,
  drawPet,
  loadCatalog,
  reloadSprites: async () => { await loadCustomSprites(); updateSpriteStatus(); render(true); },
  levelFor,
  stageFor,
  getState: () => ({ ...state, awarded: state.awarded.slice() }),
  setState: (s) => { state = { ...state, ...s }; apply(); render(true); save(); },
  SPECIES
};

})();
