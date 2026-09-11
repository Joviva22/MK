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

// Estado de selección de hunks por archivo, solo para los que el usuario
// abrió con "Ver cambios" — un archivo que nunca se expande se trata como
// "todo o nada" (comportamiento de siempre, ver commitBtn más abajo).
// Map<file, { header: string, hunks: { text: string, checked: boolean }[] }>
const hunkState = new Map();

// "git diff" de un archivo -> { header, hunks[] }. header son las líneas de
// antes del primer "@@" (diff --git/index/---/+++, necesarias para que
// "git apply" sepa a qué archivo aplicar). Cada hunk arranca en su propia
// línea "@@ -a,b +c,d @@" y se corta en el próximo "@@" o el final — cada
// uno trae sus propios números de línea originales, así que se puede omitir
// cualquier subconjunto de hunks del patch sin tener que recalcular nada
// (misma idea que usa "git add -p" internamente).
function parseDiffHunks(diffText) {
  const lines = diffText.split('\n');
  const firstHunkIdx = lines.findIndex((l) => l.startsWith('@@'));
  if (firstHunkIdx === -1) return { header: diffText, hunks: [] };
  const header = `${lines.slice(0, firstHunkIdx).join('\n')}\n`;
  const hunks = [];
  let current = null;
  for (let i = firstHunkIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { summary: line, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) hunks.push(current);
  return {
    header,
    hunks: hunks.map((h) => ({ summary: h.summary, text: `${[h.summary, ...h.body].join('\n')}\n`, checked: true }))
  };
}

function renderHunkList(container, file, state) {
  container.innerHTML = '';
  if (!state.hunks.length) {
    container.textContent = 'Sin cambios sin preparar en este archivo.';
    return;
  }
  state.hunks.forEach((hunk) => {
    const box = document.createElement('div');
    box.className = 'git-hunk';

    const header = document.createElement('label');
    header.className = 'git-hunk-header';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = hunk.checked;
    cb.addEventListener('change', () => { hunk.checked = cb.checked; });
    header.appendChild(cb);
    header.appendChild(document.createTextNode(hunk.summary));
    box.appendChild(header);

    const pre = document.createElement('pre');
    pre.className = 'git-hunk-diff';
    hunk.text.split('\n').forEach((line, idx, arr) => {
      if (idx === arr.length - 1 && line === '') return;
      const span = document.createElement('div');
      if (line.startsWith('+') && !line.startsWith('+++')) span.className = 'diff-add';
      else if (line.startsWith('-') && !line.startsWith('---')) span.className = 'diff-remove';
      span.textContent = line;
      pre.appendChild(span);
    });
    box.appendChild(pre);

    container.appendChild(box);
  });
}

async function toggleHunkView(root, file, toggleBtn, listEl2) {
  if (!listEl2.hidden) {
    listEl2.hidden = true;
    toggleBtn.textContent = 'Ver cambios';
    return;
  }
  toggleBtn.textContent = 'Cargando…';
  let state = hunkState.get(file);
  if (!state) {
    const diff = await window.mdEditor.gitDiffFile(root, file);
    state = parseDiffHunks(diff || '');
    hunkState.set(file, state);
  }
  renderHunkList(listEl2, file, state);
  listEl2.hidden = false;
  toggleBtn.textContent = 'Ocultar cambios';
}

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

  hunkState.clear();

  files.forEach((f) => {
    const entry = document.createElement('div');
    entry.className = 'git-file-entry';

    const row = document.createElement('div');
    row.className = 'git-file-row';

    const label = document.createElement('label');
    label.className = 'git-file-row-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.file = f.file;
    label.appendChild(checkbox);

    const status = document.createElement('span');
    status.className = 'git-file-status';
    status.textContent = STATUS_LABELS[f.status] || f.status.trim();
    label.appendChild(status);

    const name = document.createElement('span');
    name.className = 'git-file-name';
    name.textContent = f.file;
    label.appendChild(name);

    row.appendChild(label);

    // Selección por hunk: solo tiene sentido para archivos con cambios sin
    // preparar todavía (' M'/'MM') — un archivo nuevo o ya preparado del
    // todo no tiene "git diff" no vacío para partir en pedazos.
    if (f.status.includes('M')) {
      const hunkList = document.createElement('div');
      hunkList.className = 'git-hunk-list';
      hunkList.hidden = true;

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'git-hunk-toggle';
      toggleBtn.textContent = 'Ver cambios';
      toggleBtn.addEventListener('click', () => toggleHunkView(root, f.file, toggleBtn, hunkList));
      row.appendChild(toggleBtn);

      entry.appendChild(row);
      entry.appendChild(hunkList);
    } else {
      entry.appendChild(row);
    }

    listEl.appendChild(entry);
  });
}

// Cada fila marcada se stagea completa (git add) salvo que se haya abierto
// "Ver cambios" y destildado ahí algún hunk puntual — en ese caso se arma un
// patch solo con los hunks que quedaron tildados y se aplica con
// "git apply --cached" (equivalente a elegir hunks con "git add -p", pero
// desde la UI del panel en vez de una sesión de terminal interactiva).
commitBtn.addEventListener('click', async () => {
  const root = window.mdState.rootFolder;
  // [data-file] filtra los checkboxes de archivo, únicos a los que se les
  // pone ese atributo — sin esto también entrarían los checkboxes de hunk
  // (anidados en el mismo #git-file-list cuando "Ver cambios" está abierto).
  const checkedRows = Array.from(listEl.querySelectorAll('input[type="checkbox"][data-file]:checked'));
  if (!checkedRows.length) {
    alert('Elegí al menos un archivo.');
    return;
  }
  const message = messageInput.value.trim();
  if (!message) {
    alert('Escribí un mensaje de commit.');
    return;
  }

  const wholeFiles = [];
  const partialPatches = [];
  for (const cb of checkedRows) {
    const file = cb.dataset.file;
    const state = hunkState.get(file);
    if (!state || !state.hunks.length) {
      wholeFiles.push(file);
      continue;
    }
    const selectedHunks = state.hunks.filter((h) => h.checked);
    if (selectedHunks.length === state.hunks.length) {
      wholeFiles.push(file);
    } else if (selectedHunks.length > 0) {
      partialPatches.push(state.header + selectedHunks.map((h) => h.text).join(''));
    }
    // 0 hunks tildados: el archivo queda afuera de este commit, igual que
    // si se hubiera destildado el checkbox principal.
  }

  const addResult = await window.mdEditor.gitAddFiles(root, wholeFiles);
  if (!addResult.ok) {
    alert('No se pudieron preparar algunos archivos completos.');
    return;
  }
  for (const patch of partialPatches) {
    const patchResult = await window.mdEditor.gitStageHunks(root, patch);
    if (!patchResult.ok) {
      alert('No se pudo aplicar la selección de cambios de un archivo (¿el archivo cambió mientras tanto?).');
      return;
    }
  }

  const result = await window.mdEditor.gitCommitStaged(root, message);
  if (!result || !result.ok) {
    alert('No se pudo commitear (¿nada quedó preparado, o git no disponible?).');
    return;
  }
  messageInput.value = '';
  alert(`Commit hecho: ${wholeFiles.length + partialPatches.length} archivo(s).`);
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
