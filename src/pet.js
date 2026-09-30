(function () {
'use strict';

// Mascotas (ver petart.js para el dibujo e ipc-pet.js para las imágenes).
//
// - Colección: varias mascotas; hasta TEAM_MAX caminan juntas (el equipo),
//   la primera es la líder. Cada tarea tildada (+10, una vez por tarea y
//   día) y cada Pomodoro de foco (+25) dan XP a TODO el equipo y a los
//   huevos que se están incubando. Ocultas (Ajustes) siguen ganando.
// - Nivel = 1 + ⌊√(XP/15)⌋; evolucionan en el nivel 5 y en el 10.
// - Cada evolución deja un 🥚 con una criatura nueva (60 XP para nacer).
// - Legendarios 🌟: por logros (racha de 7 días, 50 Pomodoros, 200 tareas,
//   3 mascotas en etapa final); su huevo necesita 150 XP.
// - Las crías nuevas salen de las criaturas de MK o de un juego de RPG Maker
//   (ajuste "Origen"); del juego, los legendarios son los marcados así en
//   su PBS/pokemon.txt.
// - Apariencia: criatura de MK, personaje de un juego o imágenes propias.

const ART = window.mdPetArt;
const XP = { task: 10, pomodoro: 25, feed: 2 };
const EVOLVE_AT = [5, 10];
const TEAM_MAX = 3;
const EGG_NEED = { normal: 60, legendary: 150 };
const MAX_AWARDED = 3000;
const NORMAL_KEYS = Object.keys(ART.SPECIES);
const LEGEND_KEYS = Object.keys(ART.LEGENDS);

const ACHIEVEMENTS = [
  { key: 'constancia', name: 'Constancia', desc: '7 días seguidos con al menos una tarea', goal: 7, value: () => streak() },
  { key: 'concentracion', name: 'Concentración', desc: '50 Pomodoros terminados', goal: 50, value: () => state.stats.pomodoros },
  { key: 'incansable', name: 'Incansable', desc: '200 tareas tildadas', goal: 200, value: () => state.stats.tasks },
  { key: 'maestria', name: 'Maestría', desc: '3 mascotas en su etapa final', goal: 3, value: () => state.pets.filter((p) => !p.legendary && stageOf(p) === 3).length }
];

const DEFAULTS = {
  version: 2,
  enabled: true,
  position: 'sidebar',
  source: 'mk', // de dónde salen las crías: 'mk' | 'game'
  charDir: '',
  pets: [],
  team: [],
  eggs: [],
  awarded: [],
  fed: {},
  achievements: [],
  stats: { tasks: 0, pomodoros: 0, taskDays: [] },
  nextId: 1
};

let state = JSON.parse(JSON.stringify(DEFAULTS));
let overdue = 0;
let catalog = null; // catálogo del juego (ipc-pet.js: charCatalog)
const spritesById = {}; // petId → { 1: { url, sheet, label } | null, … }

// ---------- utilidades ----------

const today = () => new Date().toISOString().slice(0, 10);
const levelFor = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 15));
const xpForLevel = (level) => 15 * (level - 1) * (level - 1);
const stageForLevel = (level) => (level >= EVOLVE_AT[1] ? 3 : level >= EVOLVE_AT[0] ? 2 : 1);

function stageOf(p) {
  if (p.legendary) return 1;
  return stageForLevel(levelFor(p.xp));
}

function petById(id) {
  return state.pets.find((p) => p.id === id) || null;
}

function teamPets() {
  return state.team.map(petById).filter(Boolean);
}

function leader() {
  return teamPets()[0] || state.pets[0] || null;
}

function sprite(p, stage) {
  const set = spritesById[p.id];
  if (!set) return null;
  for (let s = stage; s >= 1; s--) if (set[s]) return set[s];
  return set[2] || set[3] || null;
}

function isImagePet(p) {
  return (p.kind === 'game' || p.kind === 'custom') && !!sprite(p, 1);
}

function speciesName(p, stage) {
  const st = stage || stageOf(p);
  if (p.kind === 'game' || p.kind === 'custom') {
    const sp = sprite(p, st);
    if (sp && sp.label) return sp.label;
    if (p.line && p.line.names) return p.line.names[Math.min(st, p.line.names.length) - 1];
  }
  const def = ART.ALL[p.species] || ART.SPECIES.fuego;
  return def.names[st - 1];
}

function typeName(p) {
  if (p.kind === 'game') return p.legendary ? 'Legendario · juego' : 'Del juego';
  if (p.kind === 'custom') return 'Imágenes propias';
  return (ART.ALL[p.species] || ART.SPECIES.fuego).type;
}

function nameOf(p) {
  return p.name || speciesName(p);
}

function streak() {
  const days = new Set(state.stats.taskDays);
  const d = new Date();
  // La racha sigue viva si hoy todavía no tildaste nada pero ayer sí.
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function art(p, mood, stage) {
  const st = stage || stageOf(p);
  const badge = mood === 'sad' ? '😟' : mood === 'sleep' ? '💤' : '';
  const b = badge ? `<span class="pet-mood-badge">${badge}</span>` : '';
  if (p.kind === 'game' || p.kind === 'custom') {
    const sp = sprite(p, st);
    if (sp && sp.sheet) return `<div class="pet-sheet" style="background-image:url('${sp.url}')"></div>${b}`;
    if (sp) return `<img class="pet-img" src="${sp.url}" alt="" draggable="false"/>${b}`;
  }
  return ART.drawSpecies(ART.ALL[p.species] ? p.species : (p.mkSpecies || 'fuego'), st, mood);
}

async function loadSprites(p) {
  if (p.kind !== 'game' && p.kind !== 'custom') return;
  const res = await window.mdEditor.pet.sprites(p.id);
  const v = Date.now();
  const set = {};
  [1, 2, 3].forEach((n) => {
    const sp = res[n];
    set[n] = sp ? { url: `${window.mdEditor.toLocalUrl(sp.path)}?v=${v}`, sheet: sp.sheet, label: sp.label } : null;
  });
  spritesById[p.id] = set;
}

// ---------- guardar ----------

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.mdEditor.setConfig({ pet: state }), 300);
}

// Versión 1: una sola mascota { species, name, xp, awarded, lastFed }.
function migrate(saved) {
  if (!saved || typeof saved !== 'object') return JSON.parse(JSON.stringify(DEFAULTS));
  if (saved.version === 2) {
    const s = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...saved };
    s.stats = { ...DEFAULTS.stats, ...(saved.stats || {}) };
    s.pets = Array.isArray(saved.pets) ? saved.pets : [];
    s.team = (Array.isArray(saved.team) ? saved.team : []).filter((id) => s.pets.some((p) => p.id === id)).slice(0, TEAM_MAX);
    s.eggs = Array.isArray(saved.eggs) ? saved.eggs : [];
    return s;
  }
  const s = JSON.parse(JSON.stringify(DEFAULTS));
  s.enabled = saved.enabled !== false;
  s.position = saved.position === 'window' ? 'window' : 'sidebar';
  s.charDir = saved.charDir || '';
  s.awarded = Array.isArray(saved.awarded) ? saved.awarded.slice(-MAX_AWARDED) : [];
  if ('species' in saved || 'xp' in saved) {
    const kind = saved.species === 'game' ? 'game' : saved.species === 'custom' ? 'custom' : 'mk';
    s.pets.push({ id: 'p1', kind, species: kind === 'mk' && ART.SPECIES[saved.species] ? saved.species : 'fuego', mkSpecies: 'fuego', name: saved.name || '', xp: Number(saved.xp) || 0, legendary: false, born: today() });
    s.team = ['p1'];
    s.nextId = 2;
  }
  return s;
}

function ensureStarter() {
  if (state.pets.length) return;
  state.pets.push({ id: 'p1', kind: 'mk', species: 'fuego', mkSpecies: 'fuego', name: '', xp: 0, legendary: false, born: today() });
  state.team = ['p1'];
  state.nextId = Math.max(state.nextId, 2);
}

// ---------- escena: un "caminante" por mascota del equipo ----------

const lane = document.createElement('div');
lane.className = 'pet-lane';
lane.hidden = true;
const ball = document.createElement('div');
ball.className = 'pet-ball';
ball.hidden = true;
lane.appendChild(ball);
document.body.appendChild(lane);

const card = document.createElement('div');
card.className = 'pet-card';
card.hidden = true;
card.setAttribute('role', 'dialog');
card.setAttribute('aria-label', 'Tu mascota');
document.body.appendChild(card);

let walkers = []; // { pet, el, sprite, bubble, x, dir, mode, modeUntil, mood, stage }
let ballX = null;
let lastInteraction = Date.now();
let loopId = null;
let cardPetId = null;

function sizeOf(p) {
  const st = stageOf(p);
  if (p.legendary) return isImagePet(p) ? 72 : 66;
  if (isImagePet(p) && sprite(p, st) && sprite(p, st).sheet) return [0, 60, 66, 72][st];
  return [0, 42, 52, 62][st];
}

function makeWalker(p, i) {
  const el = document.createElement('div');
  el.className = 'pet' + (p.legendary ? ' pet-legendary' : '');
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  const spr = document.createElement('div');
  spr.className = 'pet-sprite';
  const bubble = document.createElement('div');
  bubble.className = 'pet-bubble';
  bubble.hidden = true;
  el.append(spr, bubble);
  lane.appendChild(el);
  const w = { pet: p, el, sprite: spr, bubble, x: 10 + i * 50, dir: i % 2 ? -1 : 1, mode: 'walk', modeUntil: 0, mood: null, stage: null };
  let clickTimer = null;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    lastInteraction = Date.now();
    if (w.mode === 'sleep') { w.mode = 'idle'; w.modeUntil = Date.now() + 1500; }
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      hearts(w);
      toggleCard(w);
    }, 230);
  });
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    clearTimeout(clickTimer);
    throwBall();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCard(w);
    }
  });
  return w;
}

function rebuildWalkers() {
  walkers.forEach((w) => w.el.remove());
  walkers = lane.hidden ? [] : teamPets().map(makeWalker);
  walkers.forEach((w) => renderWalker(w, true));
}

function moodOf(w) {
  if (w.mode === 'sleep') return 'sleep';
  if (w.mode === 'chase' || (w.mode === 'happy' && Date.now() < w.modeUntil)) return 'happy';
  if (overdue > 0) return 'sad';
  return 'normal';
}

function renderWalker(w, force) {
  const p = w.pet;
  const stage = stageOf(p);
  const m = moodOf(w);
  if (force || m !== w.mood || stage !== w.stage) {
    w.sprite.innerHTML = art(p, m, stage);
    w.mood = m;
    w.stage = stage;
    w.el.dataset.stage = String(stage);
    w.el.dataset.mood = m;
  }
  const s = sizeOf(p);
  w.el.style.width = `${s}px`;
  w.el.style.height = `${s}px`;
  w.el.style.transform = `translateX(${w.x}px)`;
  const sheet = w.sprite.querySelector('.pet-sheet');
  if (sheet) {
    // Hoja de RPG Maker: fila 0 de frente (quieta), 1 izquierda, 2 derecha.
    const moving = w.mode === 'walk' || w.mode === 'chase';
    const row = moving ? (w.dir < 0 ? 1 : 2) : 0;
    const col = moving ? Math.floor(Date.now() / 160) % 4 : 0;
    sheet.style.backgroundPosition = `${col * (100 / 3)}% ${row * (100 / 3)}%`;
    w.sprite.style.transform = 'none';
  } else {
    w.sprite.style.transform = `scaleX(${w.dir})`;
  }
  w.el.classList.toggle('pet-walking', w.mode === 'walk' || w.mode === 'chase');
  w.el.setAttribute('aria-label', `${nameOf(p)}, nivel ${levelFor(p.xp)}. Clic: detalles. Doble clic: pelota.`);
}

function say(w, text, ms) {
  if (!w) return;
  w.bubble.textContent = text;
  w.bubble.hidden = false;
  clearTimeout(w.sayTimer);
  w.sayTimer = setTimeout(() => { w.bubble.hidden = true; }, ms || 2500);
}

function hearts(w) {
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('span');
    h.className = 'pet-heart';
    h.textContent = '♥';
    h.style.left = `${w.x + sizeOf(w.pet) / 2 - 6 + (i - 1) * 10}px`;
    h.style.animationDelay = `${i * 120}ms`;
    lane.appendChild(h);
    setTimeout(() => h.remove(), 1400);
  }
}

function step() {
  if (lane.hidden) return;
  if (document.hidden) { // oculta: no caminan, pero el ánimo se actualiza
    walkers.forEach((w) => renderWalker(w));
    return;
  }
  const now = Date.now();
  const width = lane.clientWidth;
  // Persigue la pelota la mascota más cercana.
  let chaser = null;
  if (ballX != null) {
    chaser = walkers.reduce((best, w) => (!best || Math.abs(w.x - ballX) < Math.abs(best.x - ballX) ? w : best), null);
  }
  walkers.forEach((w) => {
    const max = Math.max(0, width - sizeOf(w.pet));
    const speed = [0, 0.9, 1.1, 1.3][stageOf(w.pet)];
    if (w === chaser) {
      w.mode = 'chase';
      const target = Math.min(max, Math.max(0, ballX - sizeOf(w.pet) / 2));
      w.dir = target > w.x ? 1 : -1;
      w.x += w.dir * speed * 3;
      if (Math.abs(target - w.x) < 4) {
        w.x = target;
        ball.hidden = true;
        ballX = null;
        w.mode = 'happy';
        w.modeUntil = now + 1400;
        hearts(w);
      }
    } else if (w.mode === 'walk' || w.mode === 'chase') {
      w.mode = 'walk';
      w.x += w.dir * speed;
      if (w.x <= 0 || w.x >= max) {
        w.dir = w.x <= 0 ? 1 : -1;
        w.x = Math.min(max, Math.max(0, w.x));
      }
      if (Math.random() < 0.006) {
        w.mode = 'idle';
        w.modeUntil = now + 2000 + Math.random() * 4000;
      }
    } else if (now > w.modeUntil) {
      w.mode = now - lastInteraction > 10 * 60 * 1000 ? 'sleep' : 'walk';
      if (w.mode === 'walk' && Math.random() < 0.5) w.dir = -w.dir;
      if (w.mode === 'sleep') w.modeUntil = now + 60 * 1000;
    }
    w.x = Math.min(max, Math.max(0, w.x));
    renderWalker(w);
  });
}

function throwBall() {
  if (!walkers.length) return;
  lastInteraction = Date.now();
  const width = lane.clientWidth;
  const lead = walkers[0];
  const max = Math.max(0, width - 14);
  ballX = lead.x > width / 2 ? Math.random() * max * 0.4 : max * (0.6 + Math.random() * 0.4);
  ball.style.left = `${ballX}px`;
  ball.hidden = false;
  ball.classList.remove('pet-ball-thrown');
  void ball.offsetWidth;
  ball.classList.add('pet-ball-thrown');
}

const sidebar = document.getElementById('sidebar-pane');
const statusbar = document.querySelector('.statusbar');

function placeLane() {
  if (lane.hidden) return;
  lane.style.bottom = `${statusbar ? statusbar.offsetHeight : 24}px`;
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

// ---------- tarjeta de una mascota ----------

function toggleCard(w) {
  if (!card.hidden && cardPetId === w.pet.id) {
    card.hidden = true;
    return;
  }
  cardPetId = w.pet.id;
  renderCard();
  card.hidden = false;
  const r = w.el.getBoundingClientRect();
  const cw = card.offsetWidth;
  card.style.left = `${Math.max(8, Math.min(window.innerWidth - cw - 8, r.left + r.width / 2 - cw / 2))}px`;
  card.style.bottom = `${window.innerHeight - r.top + 8}px`;
}

function progressHtml(p) {
  const level = levelFor(p.xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const pct = Math.round(((p.xp - from) / (to - from)) * 100);
  return `<div class="pet-card-level">Nivel ${level} <span>${p.xp - from}/${to - from} XP</span></div><div class="pet-card-bar"><div style="width:${pct}%"></div></div>`;
}

function renderCard() {
  const p = petById(cardPetId);
  if (!p) { card.hidden = true; return; }
  const stage = stageOf(p);
  const next = p.legendary ? '🌟 Legendaria: no evoluciona' : stage < 3 ? `Evoluciona a <b class="pet-next-name"></b> en el nivel ${EVOLVE_AT[stage - 1]}` : 'Etapa final alcanzada ✨';
  const moodText = overdue > 0 ? `😟 Preocupada: ${overdue} tarea${overdue === 1 ? '' : 's'} atrasada${overdue === 1 ? '' : 's'}` : '😊 Contenta';
  card.innerHTML = `
    <div class="pet-card-head"><div class="pet-card-art">${art(p, overdue > 0 ? 'sad' : 'happy', stage)}</div>
      <div><div class="pet-card-name"></div><div class="pet-card-species"></div></div></div>
    ${progressHtml(p)}
    <div class="pet-card-line">${next}</div>
    <div class="pet-card-line">${moodText}</div>
    <div class="pet-card-hint">+10 XP por tarea · +25 por Pomodoro · doble clic: pelota</div>
    <div class="pet-card-actions">
      <button type="button" class="toolbar-button" data-act="feed">🍖 Comer</button>
      <button type="button" class="toolbar-button" data-act="ball">⚾ Pelota</button>
      <button type="button" class="toolbar-button" data-act="collection">🐾 Mis mascotas</button>
    </div>`;
  card.querySelector('.pet-card-name').textContent = nameOf(p);
  card.querySelector('.pet-card-species').textContent = `${p.name ? speciesName(p) + ' · ' : ''}${typeName(p)}${p.legendary ? '' : ` · etapa ${stage}/3`}`;
  const nn = card.querySelector('.pet-next-name');
  if (nn) nn.textContent = speciesName(p, stage + 1);
  card.querySelector('[data-act="feed"]').addEventListener('click', () => { feed(p.id); renderCard(); });
  card.querySelector('[data-act="ball"]').addEventListener('click', () => { card.hidden = true; throwBall(); });
  card.querySelector('[data-act="collection"]').addEventListener('click', () => { card.hidden = true; openCollection(); });
}

document.addEventListener('mousedown', (e) => {
  if (!card.hidden && !card.contains(e.target) && !walkers.some((w) => w.el.contains(e.target))) card.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !card.hidden) card.hidden = true;
});

function feed(petId) {
  const p = petById(petId);
  const w = walkers.find((x) => x.pet.id === petId);
  lastInteraction = Date.now();
  if (w) hearts(w);
  if (!p) return;
  if (state.fed[petId] === today()) {
    say(w, '¡Ya comí hoy, gracias! 😋');
    return;
  }
  state.fed[petId] = today();
  addXp(p, XP.feed);
  say(w, '¡Ñam! +2 XP');
  save();
}

// ---------- experiencia, evolución, huevos y logros ----------

function notify(title, body) {
  try {
    new Notification(title, { body });
  } catch {
    // sin notificaciones del sistema: queda el globo
  }
}

const events = []; // últimos sucesos (tests y depuración)

function logEvent(e) {
  events.push({ ...e, at: Date.now() });
  if (events.length > 50) events.shift();
}

// Suma XP a una mascota y avisa si sube de nivel o evoluciona.
function addXp(p, amount) {
  const beforeLevel = levelFor(p.xp);
  const beforeStage = stageOf(p);
  const beforeName = nameOf(p);
  p.xp += amount;
  const level = levelFor(p.xp);
  const stage = stageOf(p);
  const w = walkers.find((x) => x.pet.id === p.id);
  if (stage > beforeStage) {
    const to = speciesName(p, stage);
    say(w, `¡Evolucioné a ${to}! ✨`, 4000);
    if (w) {
      w.el.classList.remove('pet-evolving');
      void w.el.offsetWidth;
      w.el.classList.add('pet-evolving');
    }
    notify(`✨ ¡${beforeName} evolucionó!`, `Ahora es ${to}. ¡Y encontraste un huevo! 🥚`);
    logEvent({ type: 'evolved', petId: p.id, stage });
    grantEgg('normal', `la evolución de ${beforeName}`);
  } else if (level > beforeLevel) {
    say(w, `¡Nivel ${level}! 🎉`, 3000);
  }
  if (w) renderWalker(w, true);
  return { evolved: stage > beforeStage, levelUp: level > beforeLevel };
}

// Criaturas que ya tenés (para no repetir en los huevos).
function owned() {
  const mk = new Set();
  const game = new Set();
  state.pets.forEach((p) => {
    if (p.kind === 'mk') mk.add(p.species);
    if (p.kind === 'game' && p.line) game.add(p.line.ids[0]);
  });
  state.eggs.forEach((e) => {
    if (e.pick.kind === 'mk') mk.add(e.pick.species);
    if (e.pick.kind === 'game') game.add(e.pick.line.ids[0]);
  });
  return { mk, game };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Qué criatura trae un huevo (del origen elegido; del juego sin catálogo →
// de MK). null si ya no queda ninguna nueva (legendarios).
function choosePick(type) {
  const own = owned();
  if (state.source === 'game' && catalog && catalog.lines.length) {
    const pool = catalog.lines.filter((l) => (type === 'legendary' ? l.legendary : !l.legendary));
    const fresh = pool.filter((l) => !own.game.has(l.ids[0]));
    const line = pickRandom(fresh.length ? fresh : (type === 'legendary' ? [] : pool));
    if (line) return { kind: 'game', line: { ids: line.ids, names: line.names }, dir: catalog.dir };
  }
  const keys = type === 'legendary' ? LEGEND_KEYS : NORMAL_KEYS;
  const fresh = keys.filter((k) => !own.mk.has(k));
  const key = pickRandom(fresh.length ? fresh : (type === 'legendary' ? [] : keys));
  return key ? { kind: 'mk', species: key } : null;
}

function grantEgg(type, reason) {
  const pick = choosePick(type);
  if (!pick) return null;
  const egg = { id: `e${state.nextId++}`, type, need: EGG_NEED[type], xp: 0, pick, reason, found: today() };
  state.eggs.push(egg);
  logEvent({ type: 'egg', eggId: egg.id, eggType: type });
  say(walkers[0], type === 'legendary' ? '¡Un huevo legendario! 🌟' : '¡Encontré un huevo! 🥚', 3500);
  if (type === 'legendary') notify('🌟 ¡Huevo legendario!', `Por ${reason}. Nace con ${EGG_NEED.legendary} XP.`);
  if (!overlay.hidden) renderCollection();
  return egg;
}

async function hatch(egg) {
  state.eggs = state.eggs.filter((e) => e.id !== egg.id);
  const id = `p${state.nextId++}`;
  const p = { id, kind: egg.pick.kind, name: '', xp: 0, legendary: egg.type === 'legendary', born: today(), mkSpecies: 'fuego' };
  if (egg.pick.kind === 'mk') {
    p.species = egg.pick.species;
  } else {
    p.species = 'fuego';
    p.line = egg.pick.line;
  }
  state.pets.push(p);
  if (p.kind === 'game') {
    const res = await window.mdEditor.pet.useChars(id, egg.pick.dir, p.line.ids, p.line.names);
    if (res && res.error) { // sin el juego a mano: una de MK
      p.kind = 'mk';
      p.species = p.legendary ? pickRandom(LEGEND_KEYS) : pickRandom(NORMAL_KEYS);
    }
    await loadSprites(p);
  }
  if (state.team.length < TEAM_MAX) state.team.push(id);
  logEvent({ type: 'hatched', petId: id, legendary: p.legendary });
  const who = speciesName(p);
  notify(p.legendary ? `🌟 ¡Nació ${who}!` : `🥚 ¡Nació ${who}!`, state.team.includes(id) ? 'Ya camina con tu equipo.' : 'Está en tu colección (🐾 Mis mascotas).');
  rebuildWalkers();
  say(walkers.find((x) => x.pet.id === id), '¡Hola! 👋', 3000);
  save();
  if (!overlay.hidden) renderCollection();
  return p;
}

function checkAchievements() {
  ACHIEVEMENTS.forEach((a) => {
    if (state.achievements.includes(a.key) || a.value() < a.goal) return;
    state.achievements.push(a.key);
    logEvent({ type: 'achievement', key: a.key });
    notify(`🏆 Logro: ${a.name}`, `${a.desc}. ¡Ganaste un huevo legendario!`);
    grantEgg('legendary', `el logro "${a.name}"`);
  });
}

// kind: 'task' | 'pomodoro'. key: una tarea en un día (no vuelve a sumar).
async function gain(kind, key) {
  const amount = XP[kind] || 0;
  if (!amount) return null;
  ensureStarter();
  if (key) {
    if (state.awarded.includes(key)) return { ...info(), duplicate: true };
    state.awarded.push(key);
    if (state.awarded.length > MAX_AWARDED) state.awarded.splice(0, state.awarded.length - MAX_AWARDED);
  }
  if (kind === 'task') {
    state.stats.tasks++;
    const d = today();
    if (!state.stats.taskDays.includes(d)) state.stats.taskDays.push(d);
    if (state.stats.taskDays.length > 400) state.stats.taskDays.splice(0, state.stats.taskDays.length - 400);
  }
  if (kind === 'pomodoro') state.stats.pomodoros++;
  lastInteraction = Date.now();
  const team = teamPets().length ? teamPets() : [leader()];
  const incubating = new Set(state.eggs.map((e) => e.id)); // los de antes de esta vuelta
  let evolved = false;
  let levelUp = false;
  team.forEach((p) => {
    const r = addXp(p, amount);
    evolved = evolved || r.evolved;
    levelUp = levelUp || r.levelUp;
  });
  // Los huevos también se incuban con lo que hacés (los que aparecieron
  // en esta misma vuelta empiezan de 0).
  const ready = [];
  state.eggs.forEach((e) => {
    if (!incubating.has(e.id)) return;
    e.xp += amount;
    if (e.xp >= e.need) ready.push(e);
  });
  checkAchievements();
  walkers.forEach((w) => {
    if (!evolved && !levelUp) say(w, `+${amount} XP`, 1600);
    w.mode = 'happy';
    w.modeUntil = Date.now() + 1200;
    hearts(w);
    renderWalker(w, true);
  });
  save();
  for (const e of ready) await hatch(e);
  if (!card.hidden) renderCard();
  if (!overlay.hidden) renderCollection();
  return { ...info(), evolved, levelUp, hatched: ready.length };
}

function info() {
  const p = leader();
  if (!p) return { xp: 0, level: 1, stage: 1, name: '', species: '' };
  return { xp: p.xp, level: levelFor(p.xp), stage: stageOf(p), name: nameOf(p), species: p.species, kind: p.kind };
}

function setOverdue(n) {
  const was = overdue;
  overdue = Math.max(0, n | 0);
  if (overdue > 0 && was === 0 && !lane.hidden) say(walkers[0], `Hay ${overdue} tarea${overdue === 1 ? '' : 's'} atrasada${overdue === 1 ? '' : 's'}… 😟`, 3500);
  walkers.forEach((w) => renderWalker(w));
}

// ---------- panel "Mis mascotas" ----------

const overlay = document.createElement('div');
overlay.className = 'modal-overlay pet-collection-overlay';
overlay.hidden = true;
overlay.innerHTML = `<div class="pet-collection" role="dialog" aria-modal="true" aria-labelledby="pet-collection-title">
  <div class="pet-col-head"><h2 id="pet-collection-title">🐾 Mis mascotas</h2><span class="pet-col-summary"></span>
    <button type="button" class="toolbar-button pet-col-close" aria-label="Cerrar">✕</button></div>
  <div class="pet-col-body"></div></div>`;
document.body.appendChild(overlay);
const colBody = overlay.querySelector('.pet-col-body');
overlay.querySelector('.pet-col-close').addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) overlay.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) overlay.hidden = true; });

function openCollection() {
  ensureStarter();
  renderCollection();
  overlay.hidden = false;
}

function mk(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderCollection() {
  const totalMk = NORMAL_KEYS.length + LEGEND_KEYS.length;
  const own = owned();
  const ownedMk = new Set(state.pets.filter((p) => p.kind === 'mk').map((p) => p.species)).size;
  const legends = state.pets.filter((p) => p.legendary).length;
  overlay.querySelector('.pet-col-summary').textContent = `${state.pets.length} mascota${state.pets.length === 1 ? '' : 's'} · ${legends} legendaria${legends === 1 ? '' : 's'} · MK ${ownedMk}/${totalMk}${catalog ? ` · juego ${own.game.size}/${catalog.lines.length}` : ''}`;
  colBody.innerHTML = '';

  colBody.appendChild(mk('h3', 'pet-col-section', `Equipo (${state.team.length}/${TEAM_MAX}) y colección`));
  colBody.appendChild(mk('p', 'pet-col-hint', 'El equipo camina y gana experiencia con cada tarea y Pomodoro. La primera es la líder.'));
  const grid = mk('div', 'pet-col-grid');
  const sorted = [...state.pets].sort((a, b) => {
    const ia = state.team.indexOf(a.id);
    const ib = state.team.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.xp - a.xp;
  });
  sorted.forEach((p) => {
    const inTeam = state.team.includes(p.id);
    const isLeader = state.team[0] === p.id;
    const c = mk('div', 'pet-col-card' + (inTeam ? ' in-team' : '') + (p.legendary ? ' legendary' : ''));
    c.dataset.petId = p.id;
    const artBox = mk('div', 'pet-col-art');
    artBox.innerHTML = art(p, 'normal');
    const name = mk('div', 'pet-col-name', nameOf(p));
    const sub = mk('div', 'pet-col-sub', `${p.name ? speciesName(p) + ' · ' : ''}${typeName(p)}${p.legendary ? '' : ` · etapa ${stageOf(p)}/3`}`);
    const badges = mk('div', 'pet-col-badges', `${isLeader ? '👑 líder' : inTeam ? '👣 en el equipo' : '💤 descansa'}${p.legendary ? ' · 🌟' : ''}`);
    const prog = mk('div');
    prog.innerHTML = progressHtml(p);
    const actions = mk('div', 'pet-col-actions');
    const teamBtn = mk('button', 'toolbar-button pet-col-team', inTeam ? 'Descansar' : 'Al equipo');
    teamBtn.type = 'button';
    teamBtn.disabled = !inTeam && state.team.length >= TEAM_MAX;
    if (teamBtn.disabled) teamBtn.title = `Máximo ${TEAM_MAX} en el equipo`;
    teamBtn.addEventListener('click', () => setInTeam(p.id, !inTeam));
    actions.appendChild(teamBtn);
    if (inTeam && !isLeader) {
      const lead = mk('button', 'toolbar-button pet-col-lead', '👑 Líder');
      lead.type = 'button';
      lead.addEventListener('click', () => makeLeader(p.id));
      actions.appendChild(lead);
    }
    const ren = mk('button', 'toolbar-button', 'Nombre');
    ren.type = 'button';
    ren.addEventListener('click', async () => {
      const v = await window.mdAsk(`Nombre para ${speciesName(p)} (vacío = el de su especie):`, p.name || '');
      if (v === null) return;
      p.name = v.trim().slice(0, 24);
      save();
      rebuildWalkers();
      renderCollection();
    });
    actions.appendChild(ren);
    c.append(artBox, name, sub, badges, prog, actions);
    grid.appendChild(c);
  });
  colBody.appendChild(grid);

  colBody.appendChild(mk('h3', 'pet-col-section', `Huevos (${state.eggs.length})`));
  if (!state.eggs.length) {
    colBody.appendChild(mk('p', 'pet-col-hint', 'Cada vez que una mascota evoluciona encontrás un huevo 🥚. Los legendarios 🌟 se ganan con logros. Se incuban con tus tareas y Pomodoros.'));
  } else {
    const eggs = mk('div', 'pet-col-grid');
    state.eggs.forEach((e) => {
      const c = mk('div', 'pet-col-card egg' + (e.type === 'legendary' ? ' legendary' : ''));
      const a = mk('div', 'pet-col-art');
      a.innerHTML = ART.drawEgg(e.type === 'legendary', e.xp / e.need);
      const pct = Math.min(100, Math.round((e.xp / e.need) * 100));
      const p = mk('div');
      p.innerHTML = `<div class="pet-card-level">${e.type === 'legendary' ? 'Huevo legendario' : 'Huevo'} <span>${e.xp}/${e.need} XP</span></div><div class="pet-card-bar"><div style="width:${pct}%"></div></div>`;
      c.append(a, p, mk('div', 'pet-col-sub', `Por ${e.reason}. ¿Qué habrá adentro?`));
      eggs.appendChild(c);
    });
    colBody.appendChild(eggs);
  }

  colBody.appendChild(mk('h3', 'pet-col-section', 'Logros legendarios'));
  const ach = mk('div', 'pet-col-achievements');
  ACHIEVEMENTS.forEach((a) => {
    const done = state.achievements.includes(a.key);
    const v = Math.min(a.goal, a.value());
    const row = mk('div', 'pet-col-ach' + (done ? ' done' : ''));
    row.innerHTML = `<div class="pet-col-ach-top"><b></b><span>${done ? '✔ conseguido' : `${v}/${a.goal}`}</span></div><div class="pet-col-sub"></div><div class="pet-card-bar"><div style="width:${Math.round((v / a.goal) * 100)}%"></div></div>`;
    row.querySelector('b').textContent = `🏆 ${a.name}`;
    row.querySelector('.pet-col-sub').textContent = `${a.desc} → huevo legendario`;
    ach.appendChild(row);
  });
  colBody.appendChild(ach);
}

function setInTeam(id, on) {
  if (on && !state.team.includes(id) && state.team.length < TEAM_MAX) state.team.push(id);
  if (!on) state.team = state.team.filter((x) => x !== id);
  save();
  rebuildWalkers();
  syncSettings();
  renderCollection();
}

function makeLeader(id) {
  state.team = [id, ...state.team.filter((x) => x !== id)];
  save();
  rebuildWalkers();
  syncSettings();
  renderCollection();
}

// ---------- Ajustes → Mascota ----------

const enabledEl = document.getElementById('pet-enabled');
const lookEl = document.getElementById('pet-species'); // apariencia de la líder
const sourceEl = document.getElementById('pet-source');
const positionEl = document.getElementById('pet-position');
const resetEl = document.getElementById('pet-reset');
const customRow = document.getElementById('pet-custom-row');
const gameRow = document.getElementById('pet-game-row');
const spriteStatus = document.getElementById('pet-sprite-status');
const charDirEl = document.getElementById('pet-char-dir');
const charSearch = document.getElementById('pet-char-search');
const charList = document.getElementById('pet-char-list');
const charStatus = document.getElementById('pet-char-status');

function lookOf(p) {
  if (!p) return 'fuego';
  if (p.kind === 'game') return 'game';
  if (p.kind === 'custom') return 'custom';
  return p.species;
}

function syncSettings() {
  const p = leader();
  if (enabledEl) enabledEl.checked = state.enabled;
  if (positionEl) positionEl.value = state.position;
  if (sourceEl) sourceEl.value = state.source;
  if (lookEl) lookEl.value = lookOf(p);
  if (customRow) customRow.hidden = !(p && p.kind === 'custom');
  if (gameRow) gameRow.hidden = !(p && p.kind === 'game') && state.source !== 'game';
  updateSpriteStatus();
}

function updateSpriteStatus() {
  if (!spriteStatus) return;
  const p = leader();
  const set = (p && spritesById[p.id]) || {};
  const have = [1, 2, 3].filter((n) => set[n]);
  spriteStatus.textContent = have.length ? `Cargadas: etapa ${have.join(', ')}` : 'Sin imágenes todavía.';
}

function apply() {
  lane.hidden = !state.enabled;
  document.body.classList.toggle('pet-on', state.enabled);
  if (state.enabled) {
    placeLane();
    if (!loopId) loopId = setInterval(step, 50);
  } else {
    clearInterval(loopId);
    loopId = null;
    card.hidden = true;
    document.body.classList.remove('pet-on-sidebar');
  }
  rebuildWalkers();
  syncSettings();
}

if (enabledEl) enabledEl.addEventListener('change', () => { state.enabled = enabledEl.checked; apply(); save(); });
if (positionEl) positionEl.addEventListener('change', () => { state.position = positionEl.value === 'window' ? 'window' : 'sidebar'; apply(); save(); });
if (sourceEl) {
  sourceEl.addEventListener('change', () => {
    state.source = sourceEl.value === 'game' ? 'game' : 'mk';
    save();
    syncSettings();
    if (state.source === 'game' && !catalog) initCharDir();
  });
}
if (lookEl) {
  lookEl.addEventListener('change', async () => {
    ensureStarter();
    const p = leader();
    const v = lookEl.value;
    if (v === 'game') {
      if (gameRow) gameRow.hidden = false;
      if (charStatus) charStatus.textContent = 'Elegí una línea de la lista para tu líder.';
      return;
    }
    if (v === 'custom') {
      p.kind = 'custom';
      if (customRow) customRow.hidden = false;
    } else if (ART.ALL[v]) {
      p.kind = 'mk';
      p.species = v;
      p.mkSpecies = v;
    }
    await loadSprites(p);
    save();
    rebuildWalkers();
    syncSettings();
  });
}

document.querySelectorAll('.pet-sprite-picks [data-stage]').forEach((b) => {
  b.addEventListener('click', async () => {
    ensureStarter();
    const p = leader();
    const res = await window.mdEditor.pet.pickSprite(p.id, Number(b.dataset.stage));
    if (res && res.error) { if (spriteStatus) spriteStatus.textContent = '⚠ ' + res.error; return; }
    if (!res || res.canceled) return;
    p.kind = 'custom';
    await loadSprites(p);
    save();
    rebuildWalkers();
    syncSettings();
  });
});
const clearBtn = document.getElementById('pet-clear-sprites');
if (clearBtn) {
  clearBtn.addEventListener('click', async () => {
    const p = leader();
    if (!p) return;
    await window.mdEditor.pet.clearSprites(p.id);
    p.kind = 'mk';
    p.species = ART.ALL[p.mkSpecies] ? p.mkSpecies : 'fuego';
    await loadSprites(p);
    save();
    rebuildWalkers();
    syncSettings();
  });
}

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
  if (charStatus) charStatus.textContent = `${res.lines.length} ${res.withEvolutions ? 'líneas evolutivas' : 'personajes'} · ${res.legendaries} legendarias (${res.total} sprites).`;
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
    b.textContent = (l.legendary ? '🌟 ' : '') + l.names.join(' → ');
    b.title = 'Usar esta línea para tu mascota líder (conserva su nivel)';
    b.addEventListener('click', async () => {
      ensureStarter();
      const p = leader();
      if (charStatus) charStatus.textContent = 'Copiando…';
      const res = await window.mdEditor.pet.useChars(p.id, catalog.dir, l.ids, l.names);
      if (res.error) { if (charStatus) charStatus.textContent = '⚠ ' + res.error; return; }
      p.kind = 'game';
      p.line = { ids: l.ids, names: l.names };
      state.charDir = catalog.dir;
      await loadSprites(p);
      save();
      rebuildWalkers();
      syncSettings();
      if (charStatus) charStatus.textContent = `✔ Tu líder ahora es ${l.names[0]}${l.names.length > 1 ? ` (evoluciona a ${l.names.slice(1).join(' y ')})` : ''}.`;
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
  if (dir) await loadCatalog(dir);
  else if (charStatus) charStatus.textContent = 'Elegí la carpeta Graphics/Characters de tu juego.';
}

const openColBtn = document.getElementById('pet-open-collection');
if (openColBtn) openColBtn.addEventListener('click', () => { if (window.mdSettingsPanel) window.mdSettingsPanel.close(); openCollection(); });

if (resetEl) {
  resetEl.addEventListener('click', async () => {
    if (!confirm('¿Empezar de cero? Se pierden TODAS las mascotas, huevos y logros.')) return;
    for (const p of state.pets) await window.mdEditor.pet.clearSprites(p.id);
    const keep = { enabled: state.enabled, position: state.position, source: state.source, charDir: state.charDir };
    state = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...keep };
    ensureStarter();
    save();
    apply();
  });
}

(async () => {
  const config = await window.mdEditor.getConfig();
  state = migrate(config.pet);
  // En la suite de tests arrancan ocultas (no se mueven entre los checks).
  if (window.location.search.includes('mkTestFixtures') && !('pet' in config)) state.enabled = false;
  ensureStarter();
  for (const p of state.pets) await loadSprites(p);
  apply();
  if (config.pet && config.pet.version !== 2) save(); // guardar ya migrado
  initCharDir();
})();

window.mdPet = {
  gain,
  info,
  setOverdue,
  throwBall,
  feed: (id) => feed(id || (leader() && leader().id)),
  openCollection,
  drawPet: (species, stage, mood) => ART.drawSpecies(species, stage, mood),
  levelFor,
  stageFor: stageForLevel,
  loadCatalog,
  streak,
  events: () => events.slice(),
  getState: () => JSON.parse(JSON.stringify(state)),
  setState: async (s) => {
    state = { ...state, ...JSON.parse(JSON.stringify(s)) };
    for (const p of state.pets) await loadSprites(p);
    apply();
    save();
  },
  SPECIES: ART.ALL
};

})();
