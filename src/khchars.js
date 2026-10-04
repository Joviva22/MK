(function () {
'use strict';

// Sora y Roxas (guiño a Kingdom Hearts): con las hojas de sprites del
// usuario (se copian solo a la configuración local, ver ipc-kh.js):
// - Sora y Roxas se unen al importar sus hojas, sin requisitos de emblemas.
//   Caminan animados y dan un
//   golpe de keyblade cuando tildás una tarea (pet.js, kind 'kh').
// - Retratos que reaccionan: un aviso chico con la cara de Sora (feliz al
//   completar, decidido con un Pomodoro, preocupado si aparecen atrasadas).
// Ajustes → Apariencia; config.khPortraits.

const PORTRAIT_GAP_MS = 15000;
let chars = {}; // id → { name, anims, portraits }
let portraitsOn = true;
let lastPortrait = 0;

function get(id) {
  return chars[id] || null;
}

function hasPet(species) {
  return !!(window.mdPet && window.mdPet.getState().pets.some((p) => p.kind === 'kh' && p.species === species));
}

// Quién ya puede estar en la colección.
function syncPets() {
  if (!window.mdPet) return;
  if (chars.sora && !hasPet('sora')) window.mdPet.addKhPet('sora');
  if (chars.roxas && !hasPet('roxas')) {
    window.mdPet.addKhPet('roxas');
    portrait('roxas', 'normal', '¡Roxas se unió!', 'Desbloqueado desde el inicio, sin buscar emblemas.', true);
  }
}

// ---- retratos ----
function portrait(who, mood, title, text, force) {
  const c = chars[who];
  if (!c || (!portraitsOn && !force)) return false;
  const now = Date.now();
  if (!force && now - lastPortrait < PORTRAIT_GAP_MS) return false;
  lastPortrait = now;
  document.querySelectorAll('.kh-portrait-toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'kh-portrait-toast';
  el.setAttribute('role', 'status');
  const img = document.createElement('img');
  img.src = c.portraits[mood] || c.portraits.normal;
  img.alt = '';
  const box = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = title;
  const s = document.createElement('span');
  s.textContent = text;
  box.append(b, s);
  el.append(img, box);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('kh-toast-out'), 3600);
  setTimeout(() => el.remove(), 4200);
  return true;
}

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

document.addEventListener('mk:pet-gain', (e) => {
  if (!chars.sora || !hasPet('sora')) return;
  const kind = e.detail && e.detail.kind;
  if (kind === 'task') portrait('sora', 'feliz', pick(['¡Tarea hecha!', '¡Bien ahí!', '¡Una menos!']), pick(['Mis amigos son mi poder.', 'Seguimos.', '¡Vamos por la próxima!']));
  else if (kind === 'pomodoro') portrait('sora', 'decidido', '¡Pomodoro terminado!', 'Un descanso y seguimos.');
});

document.addEventListener('mk:pet-overdue', (e) => {
  if (!chars.sora || !hasPet('sora')) return;
  const n = e.detail.overdue;
  portrait('sora', 'preocupado', `${n} tarea${n === 1 ? '' : 's'} atrasada${n === 1 ? '' : 's'}`, 'Todavía estamos a tiempo…');
});

document.addEventListener('mk:lucky-found', () => syncPets());

// ---- Ajustes ----
function renderStatus() {
  const status = document.getElementById('kh-chars-status');
  const btn = document.getElementById('kh-chars-import');
  if (!status) return;
  const names = Object.values(chars).map((c) => c.name);
  if (!names.length) status.textContent = 'Con las hojas de sprites de Sora (Chain of Memories) y Roxas, se suman a tus mascotas.';
  else {
    const roxas = chars.roxas ? (hasPet('roxas') ? ' Roxas ya está con vos.' : ' Roxas está desbloqueado y se unirá a la colección.') : ' Roxas está desbloqueado: falta importar su hoja.';
    status.textContent = `${names.join(' y ')} listos.${roxas}`;
  }
  if (btn) btn.textContent = names.length === 2 ? 'Volver a importar' : 'Buscar hojas en Descargas…';
  const t = document.getElementById('kh-portraits');
  if (t) t.checked = portraitsOn;
}

async function load() {
  const list = await window.mdEditor.khChars();
  chars = {};
  list.forEach((c) => { chars[c.id] = c; });
  syncPets();
  if (window.mdPet && window.mdPet.refreshWalkers) window.mdPet.refreshWalkers();
  renderStatus();
}

async function importChars(testPaths) {
  const r = await window.mdEditor.khCharImport(testPaths);
  const status = document.getElementById('kh-chars-status');
  if (r.error && status) status.textContent = r.error;
  if (r.ok) {
    await load();
    if (r.imported.includes('sora')) portrait('sora', 'feliz', '¡Sora se unió!', 'Camina con tus mascotas y te acompaña en las tareas.', true);
  }
  return r;
}

const importBtn = document.getElementById('kh-chars-import');
if (importBtn) importBtn.addEventListener('click', () => importChars());
const portraitsToggle = document.getElementById('kh-portraits');
if (portraitsToggle) {
  portraitsToggle.addEventListener('change', () => {
    portraitsOn = portraitsToggle.checked;
    window.mdEditor.setConfig({ khPortraits: portraitsOn });
  });
}

(async () => {
  const config = await window.mdEditor.getConfig();
  portraitsOn = config.khPortraits !== false;
  // Después de que pet.js cargó su estado (si no, "no hay mascotas").
  setTimeout(load, 800);
})();

window.mdKhChars = { get, load, importChars, portrait, syncPets, ids: () => Object.keys(chars) };

})();
