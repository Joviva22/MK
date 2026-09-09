(function () {
'use strict';

// Control fino de sincronización con git: separado del sync automático al
// guardar (⚙ Ajustes, siempre "git add -A" + mensaje genérico) — acá se
// elige a mano qué archivos entran en el commit y se escribe el mensaje.
// Nunca corre "git init" por cuenta propia, igual que el resto de la
// integración con git en esta app.

const overlay = document.getElementById('git-panel');
const emptyEl = document.getElementById('git-empty');
const listEl = document.getElementById('git-file-list');
const actionsEl = document.getElementById('git-actions');
const messageInput = document.getElementById('git-commit-message');
const commitBtn = document.getElementById('git-commit-btn');

const STATUS_LABELS = {
  '??': 'nuevo',
  ' M': 'modificado',
  'M ': 'modificado (preparado)',
  'MM': 'modificado (parcial)',
  'A ': 'agregado',
  ' D': 'borrado',
  'D ': 'borrado (preparado)',
  'R ': 'renombrado'
};

async function render() {
  const root = window.mdState.rootFolder;
  if (!root) {
    emptyEl.textContent = 'Abrí una carpeta primero.';
    emptyEl.hidden = false;
    listEl.hidden = true;
    actionsEl.hidden = true;
    return;
  }
  const isRepo = await window.mdEditor.isGitRepo(root);
  if (!isRepo) {
    emptyEl.textContent = 'La carpeta abierta no es un repositorio git (MK no corre "git init" por cuenta propia).';
    emptyEl.hidden = false;
    listEl.hidden = true;
    actionsEl.hidden = true;
    return;
  }
  const files = await window.mdEditor.gitStatus(root);
  if (!files || !files.length) {
    emptyEl.textContent = 'Sin cambios para commitear.';
    emptyEl.hidden = false;
    listEl.hidden = true;
    actionsEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  listEl.hidden = false;
  actionsEl.hidden = false;
  listEl.innerHTML = '';

  files.forEach((f) => {
    const row = document.createElement('label');
    row.className = 'git-file-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.file = f.file;
    row.appendChild(checkbox);

    const status = document.createElement('span');
    status.className = 'git-file-status';
    status.textContent = STATUS_LABELS[f.status] || f.status.trim();
    row.appendChild(status);

    const name = document.createElement('span');
    name.className = 'git-file-name';
    name.textContent = f.file;
    row.appendChild(name);

    listEl.appendChild(row);
  });
}

commitBtn.addEventListener('click', async () => {
  const root = window.mdState.rootFolder;
  const selected = Array.from(listEl.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.dataset.file);
  if (!selected.length) {
    alert('Elegí al menos un archivo.');
    return;
  }
  const message = messageInput.value.trim();
  if (!message) {
    alert('Escribí un mensaje de commit.');
    return;
  }
  const result = await window.mdEditor.gitCommitSelected(root, selected, message);
  if (!result || !result.ok) {
    alert('No se pudo commitear (¿archivos ya sin cambios, o git no disponible?).');
    return;
  }
  messageInput.value = '';
  alert(`Commit hecho: ${selected.length} archivo(s).`);
  render();
});

function open() {
  overlay.hidden = false;
  messageInput.value = '';
  render();
}

function close() {
  overlay.hidden = true;
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) close();
});

window.mdGitPanel = { open, close };

})();
