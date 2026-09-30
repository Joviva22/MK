(function () {
'use strict';

// Guiño a Kingdom Hearts. Con una hoja de keyblades propia (Ajustes →
// Apariencia; se copia a la configuración local, ver ipc-kh.js):
// - Llavero: cada keyblade se desbloquea con un hito (tareas, racha,
//   Pomodoros); la equipada la lleva la mascota principal y se usa en lo
//   de abajo. Se ve también en la colección de mascotas.
// - Golpe: al tildar una tarea, un tajo corto con destello donde hiciste clic.
// - Cursor keyblade (fuera del texto: dentro del editor sigue el de texto).
// - El tema "Kingdom Hearts" (themes.js) usa la equipada de marca de agua.
// Todo opcional; config.kh.

const MILESTONES = [
  { label: 'De regalo', value: () => 1, goal: 1 },
  { label: '10 tareas tildadas', value: (s) => s.tasks, goal: 10 },
  { label: 'Racha de 7 días', value: (s) => s.streak, goal: 7 },
  { label: '25 Pomodoros', value: (s) => s.pomodoros, goal: 25 },
  { label: '100 tareas tildadas', value: (s) => s.tasks, goal: 100 },
  { label: 'Racha de 30 días', value: (s) => s.streak, goal: 30 },
  { label: '250 tareas tildadas', value: (s) => s.tasks, goal: 250 },
  { label: '100 Pomodoros', value: (s) => s.pomodoros, goal: 100 },
  { label: '500 tareas tildadas', value: (s) => s.tasks, goal: 500 }
];
// Más keyblades que hitos: cada 250 tareas más, una.
function milestone(i) {
  if (i < MILESTONES.length) return MILESTONES[i];
  const goal = 500 + (i - MILESTONES.length + 1) * 250;
  return { label: `${goal} tareas tildadas`, value: (s) => s.tasks, goal };
}

const DEFAULTS = { swing: true, cursor: false, petCarries: true, equipped: 0, unlocked: [0] };

let keyblades = []; // [{ dataUrl, width, height }]
let cfg = { ...DEFAULTS };
let cursorStyle = null;
let lastPointer = null;

function stats() {
  const st = window.mdPet ? window.mdPet.getState().stats || {} : {};
  return { tasks: st.tasks || 0, pomodoros: st.pomodoros || 0, streak: window.mdPet ? window.mdPet.streak() : 0 };
}

function isUnlocked(i) {
  return cfg.unlocked.includes(i);
}

function equipped() {
  const i = isUnlocked(cfg.equipped) ? cfg.equipped : 0;
  return keyblades[i] || null;
}

async function saveCfg() {
  await window.mdEditor.setConfig({ kh: cfg });
}

// ---- desbloqueos ----
function checkUnlocks(announce) {
  const s = stats();
  const fresh = [];
  keyblades.forEach((kb, i) => {
    if (isUnlocked(i)) return;
    const m = milestone(i);
    if (m.value(s) >= m.goal) {
      cfg.unlocked.push(i);
      fresh.push(i);
    }
  });
  if (fresh.length) {
    saveCfg();
    if (announce) fresh.forEach((i, n) => setTimeout(() => toast(i), n * 2600));
    renderSettings();
  }
  return fresh;
}

function toast(i) {
  const kb = keyblades[i];
  if (!kb) return;
  const el = document.createElement('div');
  el.className = 'kh-toast';
  el.setAttribute('role', 'status');
  const img = document.createElement('img');
  img.src = kb.dataUrl;
  img.alt = '';
  const text = document.createElement('div');
  text.innerHTML = '<b>¡Nueva keyblade!</b><span></span>';
  text.querySelector('span').textContent = `Keyblade ${i + 1} · ${milestone(i).label}. Equipala en Ajustes → Apariencia.`;
  el.append(img, text);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('kh-toast-out'), 4200);
  setTimeout(() => el.remove(), 4800);
}

// ---- golpe al completar una tarea ----
document.addEventListener('pointerdown', (e) => { lastPointer = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);

function swing(x, y) {
  const kb = equipped();
  if (!kb || !cfg.swing) return false;
  const p = lastPointer && Date.now() - lastPointer.t < 3000 ? lastPointer : { x: x || window.innerWidth / 2, y: y || window.innerHeight / 2 };
  const wrap = document.createElement('div');
  wrap.className = 'kh-swing';
  wrap.style.left = `${p.x}px`;
  wrap.style.top = `${p.y}px`;
  const img = document.createElement('img');
  img.src = kb.dataUrl;
  img.alt = '';
  const h = 64;
  img.style.height = `${h}px`;
  img.style.width = `${Math.round((kb.width / kb.height) * h)}px`;
  const spark = document.createElement('div');
  spark.className = 'kh-spark';
  spark.textContent = '✦';
  wrap.append(img, spark);
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 700);
  return true;
}

document.addEventListener('mk:pet-gain', (e) => {
  if (!keyblades.length) return;
  if (e.detail && e.detail.kind === 'task') swing();
  checkUnlocks(true);
});

// ---- cursor ----
function cursorDataUrl(kb) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 32;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false; // pixel art: sin borronear
      // La punta (arriba de la imagen) en (2,2), el punto activo del cursor,
      // y el resto en diagonal hacia abajo a la derecha, como una flecha:
      // girar -45° lleva el "abajo" de la imagen a la diagonal (1,1).
      const len = Math.hypot(size, size) - 4;
      const scale = len / img.height;
      g.translate(2, 2);
      g.rotate(-Math.PI / 4);
      g.drawImage(img, -(img.width * scale) / 2, 0, img.width * scale, img.height * scale);
      resolve(c.toDataURL());
    };
    img.onerror = () => resolve(null);
    img.src = kb.dataUrl;
  });
}

async function applyCursor() {
  if (cursorStyle) { cursorStyle.remove(); cursorStyle = null; }
  const kb = equipped();
  document.body.classList.toggle('kh-cursor', !!(kb && cfg.cursor));
  if (!kb || !cfg.cursor) return;
  const url = await cursorDataUrl(kb);
  if (!url) return;
  cursorStyle = document.createElement('style');
  cursorStyle.textContent = `body.kh-cursor, body.kh-cursor button, body.kh-cursor a, body.kh-cursor [role="button"], body.kh-cursor select, body.kh-cursor label { cursor: url("${url}") 2 2, default; }`;
  document.head.appendChild(cursorStyle);
}

// ---- mascota y tema ----
function attachToPet(el) {
  if (!el) return;
  el.querySelectorAll('.pet-keyblade').forEach((x) => x.remove());
  const kb = equipped();
  if (!kb || !cfg.petCarries) return;
  const img = document.createElement('img');
  img.className = 'pet-keyblade';
  img.src = kb.dataUrl;
  img.alt = '';
  el.appendChild(img);
}

function applyAll() {
  const kb = equipped();
  document.documentElement.style.setProperty('--kh-keyblade', kb ? `url("${kb.dataUrl}")` : 'none');
  document.body.classList.toggle('kh-has-keyblade', !!kb);
  attachToPet(document.querySelector('.pet'));
  applyCursor();
  renderSettings();
}

// ---- Ajustes → Apariencia ----
const box = document.getElementById('kh-settings');

function renderKeychain(container, compact) {
  const s = stats();
  const strip = document.createElement('div');
  strip.className = 'kh-keychain' + (compact ? ' kh-keychain-compact' : '');
  keyblades.forEach((kb, i) => {
    const open = isUnlocked(i);
    const m = milestone(i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kh-key' + (open ? '' : ' kh-locked') + (open && (cfg.equipped === i) ? ' kh-equipped' : '');
    b.disabled = !open;
    const v = Math.min(m.goal, m.value(s));
    b.title = open ? `Keyblade ${i + 1} — ${m.label}${cfg.equipped === i ? ' (equipada)' : '. Clic para equipar'}` : `Bloqueada: ${m.label} (${v}/${m.goal})`;
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(open && cfg.equipped === i));
    const img = document.createElement('img');
    img.src = kb.dataUrl;
    img.alt = '';
    const cap = document.createElement('span');
    cap.textContent = open ? (cfg.equipped === i ? 'Equipada' : `N.º ${i + 1}`) : `${v}/${m.goal}`;
    b.append(img, cap);
    b.addEventListener('click', () => equip(i));
    strip.appendChild(b);
  });
  container.appendChild(strip);
  return strip;
}

function renderSettings() {
  if (!box) return;
  box.innerHTML = '';
  const status = document.getElementById('kh-status');
  const clearBtn = document.getElementById('kh-clear');
  if (!keyblades.length) {
    if (status) status.textContent = 'Sin imagen todavía. Elegí una hoja PNG con keyblades sobre fondo transparente, una al lado de la otra.';
    if (clearBtn) clearBtn.hidden = true;
    return;
  }
  if (clearBtn) clearBtn.hidden = false;
  if (status) status.textContent = `${keyblades.length} keyblades · ${cfg.unlocked.filter((i) => i < keyblades.length).length} desbloqueadas. Las otras se ganan con tus tareas, rachas y Pomodoros.`;
  renderKeychain(box);
  ['swing', 'cursor', 'petCarries'].forEach((k) => {
    const t = document.getElementById(`kh-${k}`);
    if (t) t.checked = !!cfg[k];
  });
}

async function equip(i) {
  if (!isUnlocked(i)) return;
  cfg.equipped = i;
  await saveCfg();
  applyAll();
}

async function importSheet(fromPath, testPath) {
  const r = await window.mdEditor.khImport(fromPath, testPath);
  const status = document.getElementById('kh-status');
  if (r.error && status) status.textContent = r.error;
  if (!r.ok) return r;
  keyblades = r.keyblades;
  cfg.unlocked = cfg.unlocked.filter((i) => i < keyblades.length);
  if (!cfg.unlocked.includes(0)) cfg.unlocked.unshift(0);
  checkUnlocks(false); // lo que ya habías logrado cuenta
  await saveCfg();
  applyAll();
  return r;
}

async function clearSheet() {
  await window.mdEditor.khClear();
  keyblades = [];
  applyAll();
}

async function showCandidates() {
  const btn = document.getElementById('kh-from-downloads');
  if (!btn) return;
  const found = await window.mdEditor.khCandidates();
  btn.hidden = !found.length || keyblades.length > 0;
  btn.dataset.path = found[0] || '';
  if (found[0]) btn.title = found[0];
}

function wire(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(el.type === 'checkbox' ? 'change' : 'click', fn);
}
wire('kh-pick', () => importSheet(null));
wire('kh-from-downloads', (e) => importSheet(e.currentTarget.dataset.path).then(showCandidates));
wire('kh-clear', () => clearSheet().then(showCandidates));
['swing', 'cursor', 'petCarries'].forEach((k) => wire(`kh-${k}`, async (e) => {
  cfg[k] = e.currentTarget.checked;
  await saveCfg();
  applyAll();
}));

(async () => {
  const config = await window.mdEditor.getConfig();
  cfg = { ...DEFAULTS, ...(config.kh || {}) };
  if (!Array.isArray(cfg.unlocked)) cfg.unlocked = [0];
  keyblades = await window.mdEditor.khKeyblades();
  if (keyblades.length) checkUnlocks(false);
  applyAll();
  showCandidates();
})();

window.mdKeyblades = {
  attachToPet,
  renderKeychain: (container) => { if (keyblades.length) renderKeychain(container, true); },
  swing,
  equip,
  importSheet,
  clearSheet,
  checkUnlocks,
  milestone,
  getState: () => ({ count: keyblades.length, cfg: JSON.parse(JSON.stringify(cfg)) }),
  setCfgForTest: async (partial) => { cfg = { ...cfg, ...partial }; await saveCfg(); applyAll(); }
};

})();
