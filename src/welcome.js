(function () {
'use strict';

// Primer arranque guiado: tres pasos cortos —qué vas a usar (perfil de
// módulos), dónde van tus notas y los atajos para encontrar el resto—.
// Se muestra una sola vez (config.onboarded) y solo en una instalación
// nueva: quien ya tenía una carpeta abierta no la ve. Se puede volver a ver
// desde la paleta ("Bienvenida: …").

// Qué módulos quedan apagados en cada perfil (ver modules.js).
const PROFILES = [
  { id: 'escribir', icon: '✍', name: 'Escribir', desc: 'Notas y documentos en Markdown, con etiquetas y enlaces entre notas. Lo más simple.', off: ['home', 'databases', 'kanban', 'graph', 'terminal', 'pdf', 'pomodoro', 'media'] },
  { id: 'planificar', icon: '📅', name: 'Escribir y planificar', desc: 'Además: Home con calendario y tareas, recordatorios, Kanban y Pomodoro.', off: ['databases', 'graph', 'terminal', 'pdf', 'media'] },
  { id: 'todo', icon: '🧰', name: 'Todo', desc: 'Además: bases de datos, grafo, terminal e IA, herramientas de PDF y reproductor.', off: [] }
];

const overlay = document.createElement('div');
overlay.className = 'modal-overlay welcome-overlay';
overlay.hidden = true;
overlay.innerHTML = `<div class="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
  <div class="welcome-steps" aria-hidden="true"><span></span><span></span><span></span></div>
  <section class="welcome-step" data-step="0">
    <h2 id="welcome-title">Bienvenida a MK</h2>
    <p class="welcome-lead">¿Para qué lo vas a usar? Se muestran solo esas herramientas; lo demás queda guardado, no borrado.</p>
    <div class="welcome-profiles" role="radiogroup" aria-label="Perfil"></div>
    <p class="welcome-hint">Cambialo cuando quieras en Ajustes → Módulos.</p>
  </section>
  <section class="welcome-step" data-step="1" hidden>
    <h2>Tus notas</h2>
    <p class="welcome-lead">Cada nota es un archivo <code>.md</code> en una carpeta tuya: nada queda encerrado en MK.</p>
    <div class="welcome-choices">
      <button type="button" class="welcome-choice" data-folder="create"><strong>Crear «Notas MK» en Documentos</strong><span>Con una nota de bienvenida para empezar.</span></button>
      <button type="button" class="welcome-choice" data-folder="pick"><strong>Elegir una carpeta que ya tengo…</strong><span>Por ejemplo, una carpeta de apuntes o un repositorio.</span></button>
      <button type="button" class="welcome-choice" data-folder="later"><strong>Más tarde</strong><span>El botón de carpeta de la barra lateral la abre cuando quieras.</span></button>
    </div>
    <p class="welcome-status" role="status"></p>
  </section>
  <section class="welcome-step" data-step="2" hidden>
    <h2>Listo</h2>
    <p class="welcome-lead">Tres atajos para encontrar todo lo demás:</p>
    <dl class="welcome-keys">
      <dt><kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>P</kbd></dt><dd>Paleta: cualquier cosa que hace MK, buscándola por nombre.</dd>
      <dt><kbd>Ctrl</kbd> <kbd>,</kbd></dt><dd>Ajustes: tema, barra, módulos, respaldo.</dd>
      <dt><kbd>Ctrl</kbd> <kbd>P</kbd></dt><dd>Abrir una nota por su nombre.</dd>
    </dl>
  </section>
  <div class="modal-actions">
    <button type="button" class="toolbar-button welcome-skip">Saltar</button>
    <button type="button" class="toolbar-button welcome-back" hidden>Atrás</button>
    <button type="button" class="toolbar-button welcome-next welcome-primary">Siguiente</button>
  </div>
</div>`;
document.body.appendChild(overlay);

const profilesEl = overlay.querySelector('.welcome-profiles');
const statusEl = overlay.querySelector('.welcome-status');
const nextBtn = overlay.querySelector('.welcome-next');
const backBtn = overlay.querySelector('.welcome-back');
const skipBtn = overlay.querySelector('.welcome-skip');
let step = 0;
let profile = 'todo';
let openedNote = null;

PROFILES.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'welcome-profile';
  b.dataset.profile = p.id;
  b.setAttribute('role', 'radio');
  b.innerHTML = '<span class="welcome-profile-icon" aria-hidden="true"></span><strong></strong><span class="welcome-profile-desc"></span>';
  b.querySelector('.welcome-profile-icon').textContent = p.icon;
  b.querySelector('strong').textContent = p.name;
  b.querySelector('.welcome-profile-desc').textContent = p.desc;
  b.addEventListener('click', () => selectProfile(p.id));
  profilesEl.appendChild(b);
});

function currentProfileFromModules() {
  const off = (window.mdModules ? window.mdModules.MODULES.filter((m) => !window.mdModules.isOn(m.id)).map((m) => m.id) : []).sort().join(',');
  const match = PROFILES.find((p) => p.off.slice().sort().join(',') === off);
  return match ? match.id : null;
}

function selectProfile(id) {
  profile = id;
  profilesEl.querySelectorAll('.welcome-profile').forEach((b) => {
    const on = b.dataset.profile === id;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-checked', String(on));
  });
}

function show(n) {
  step = n;
  overlay.querySelectorAll('.welcome-step').forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
  overlay.querySelectorAll('.welcome-steps span').forEach((s, i) => s.classList.toggle('done', i <= n));
  backBtn.hidden = n === 0;
  skipBtn.hidden = n === 2;
  nextBtn.textContent = n === 2 ? 'Empezar' : 'Siguiente';
  const stepEl = overlay.querySelector(`.welcome-step[data-step="${n}"]`);
  const focusable = stepEl.querySelector('.selected') || stepEl.querySelector('button') || nextBtn;
  focusable.focus();
}

async function applyProfile() {
  const p = PROFILES.find((x) => x.id === profile);
  if (p && window.mdModules && window.mdModules.setOff) await window.mdModules.setOff(p.off);
}

async function chooseFolder(kind) {
  statusEl.textContent = '';
  if (kind === 'later') return show(2);
  const result = kind === 'create' ? await window.mdEditor.createStarterFolder() : await window.mdEditor.openFolder();
  if (!result) {
    if (kind === 'create') statusEl.textContent = 'No se pudo crear la carpeta.';
    return;
  }
  window.mdSidebar.renderFolder(result);
  openedNote = result.note || null;
  show(2);
}

overlay.querySelectorAll('.welcome-choice').forEach((b) => b.addEventListener('click', () => chooseFolder(b.dataset.folder)));

async function finish() {
  overlay.hidden = true;
  await window.mdEditor.setConfig({ onboarded: true });
  if (openedNote && window.mdTabs) window.mdTabs.openTab(openedNote);
  openedNote = null;
}

nextBtn.addEventListener('click', async () => {
  if (step === 0) {
    await applyProfile();
    show(1);
  } else if (step === 1) show(2);
  else finish();
});
backBtn.addEventListener('click', () => show(Math.max(0, step - 1)));
skipBtn.addEventListener('click', finish);
overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    finish();
  }
});

function open() {
  selectProfile(currentProfileFromModules() || 'todo');
  statusEl.textContent = '';
  overlay.hidden = false;
  show(0);
}

// Solo en una instalación nueva: sin carpeta abierta y sin haberla visto.
(async () => {
  const config = await window.mdEditor.getConfig();
  if (config.onboarded || window.location.search.includes('mkTestFixtures')) return;
  if (config.lastFolder) {
    await window.mdEditor.setConfig({ onboarded: true }); // ya usaba MK
    return;
  }
  setTimeout(open, 400);
})();

window.mdWelcome = { open, finish, PROFILES, selectProfile, next: () => nextBtn.click(), chooseFolder };

})();
