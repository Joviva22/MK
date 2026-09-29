(function () {
'use strict';

// Tablero armado en vivo: cada "## Columna" es una columna, cada "- item"
// (con o sin checkbox) debajo es una tarjeta. Dos modos:
// - "Archivo activo" (por defecto): lee/escribe directo sobre el buffer del
//   editor (cm.getValue()/setValue()) — así "Guardar" y el autoguardado ya
//   funcionan solos, sin tocar disco por cuenta propia.
// - "Carpeta completa": junta las columnas (por título) de TODOS los
//   archivos de texto de la carpeta abierta en un solo tablero. Cada
//   tarjeta lleva de qué archivo vino (badge); clic la togglea y arrastrarla
//   a otra columna la mueve DENTRO de su archivo (creando ahí el "## Columna"
//   si no lo tiene) — escribe ese archivo en disco, o el buffer del editor si
//   es el que está abierto.

const overlay = document.getElementById('kanban-panel');
const board = document.getElementById('kanban-board');
const scopeFileBtn = document.getElementById('kanban-scope-file');
const scopeFolderBtn = document.getElementById('kanban-scope-folder');
const KANBAN_DRAG_MIME = 'application/x-mk-kanban-card';

let scope = 'file'; // 'file' | 'folder'

function parseColumns(markdownText) {
  const lines = markdownText.split('\n');
  const columns = [];
  let current = null;
  lines.forEach((line, i) => {
    const heading = line.match(/^##\s+(.*)/);
    if (heading) {
      current = { title: heading[1].trim(), cards: [] };
      columns.push(current);
      return;
    }
    if (!current) return;
    const item = line.match(/^-\s+(?:\[([ xX])\]\s+)?(.*)/);
    if (item) {
      current.cards.push({ line: i, checked: !!(item[1] && item[1].toLowerCase() === 'x'), text: item[2].trim() });
    }
  });
  return columns;
}

// Modo carpeta: mismas columnas de arriba, pero fusionadas por título entre
// todos los archivos de texto de la carpeta — cada tarjeta se etiqueta con
// su archivo de origen (filePath) para poder togglearla más tarde.
async function buildFolderColumns() {
  const root = window.mdState.rootFolder;
  if (!root) return [];
  const files = await window.mdEditor.kanbanReadFolderFiles(root);
  const byTitle = new Map();
  files.forEach((f) => {
    parseColumns(f.content).forEach((col) => {
      let target = byTitle.get(col.title);
      if (!target) {
        target = { title: col.title, cards: [] };
        byTitle.set(col.title, target);
      }
      col.cards.forEach((card) => target.cards.push({ ...card, filePath: f.path }));
    });
  });
  return Array.from(byTitle.values());
}

function toggleLineInText(text, lineIndex) {
  const lines = text.split('\n');
  const line = lines[lineIndex];
  if (line == null) return null;
  const withBox = line.match(/^(-\s+)\[([ xX])\](\s+.*)/);
  if (withBox) {
    const newMark = withBox[2].trim() === '' ? 'x' : ' ';
    lines[lineIndex] = `${withBox[1]}[${newMark}]${withBox[3]}`;
  } else {
    const plain = line.match(/^(-\s+)(.*)/);
    if (plain) lines[lineIndex] = `${plain[1]}[x] ${plain[2]}`;
  }
  return lines.join('\n');
}

async function toggleCard(card) {
  if (scope === 'file') {
    const cm = window.mdCodeMirror;
    const updated = toggleLineInText(cm.getValue(), card.line);
    if (updated !== null) cm.setValue(updated);
  } else {
    const result = await window.mdEditor.readFile(card.filePath);
    if (!result || result.binary) return;
    const updated = toggleLineInText(result.content, card.line);
    if (updated !== null) await window.mdEditor.saveFile(updated, card.filePath, false);
  }
  render();
}

// Mueve la línea lineIndex (una tarjeta) al final de la columna "## targetTitle".
// Si esa columna no existe en el texto: con createIfMissing la agrega al
// final; si no, devuelve null (no se mueve nada).
function moveLineInText(text, lineIndex, targetTitle, createIfMissing) {
  const lines = text.split('\n');
  const cardLine = lines[lineIndex];
  if (cardLine == null || !/^-\s+/.test(cardLine)) return null;
  lines.splice(lineIndex, 1);

  let targetHeadingIdx = lines.findIndex((l) => {
    const h = l.match(/^##\s+(.*)/);
    return h && h[1].trim() === targetTitle;
  });
  if (targetHeadingIdx === -1) {
    if (!createIfMissing) return null;
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push('', `## ${targetTitle}`);
    targetHeadingIdx = lines.length - 1;
  }

  let insertAt = lines.length;
  for (let i = targetHeadingIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      insertAt = i;
      break;
    }
  }
  // Justo después de la última tarjeta de la columna (no después de líneas en blanco).
  while (insertAt > targetHeadingIdx + 1 && lines[insertAt - 1].trim() === '') insertAt--;
  lines.splice(insertAt, 0, cardLine);
  return lines.join('\n');
}

function moveCard(lineIndex, targetTitle) {
  const cm = window.mdCodeMirror;
  const updated = moveLineInText(cm.getValue(), lineIndex, targetTitle, false);
  if (updated === null) return;
  cm.setValue(updated);
  render();
}

// Modo carpeta: la tarjeta se mueve DENTRO de su propio archivo (a la
// columna de ese nombre; si el archivo no la tiene, se crea al final). Si el
// archivo está abierto en el editor se cambia el buffer, si no el disco.
async function moveFolderCard(card, targetTitle) {
  const active = window.mdTabs && window.mdTabs.getActiveTabInfo();
  if (active && active.filePath === card.filePath) {
    const cm = window.mdCodeMirror;
    const updated = moveLineInText(cm.getValue(), card.line, targetTitle, true);
    if (updated !== null) cm.setValue(updated);
  } else {
    const result = await window.mdEditor.readFile(card.filePath);
    if (!result || result.binary) return;
    const updated = moveLineInText(result.content, card.line, targetTitle, true);
    if (updated !== null) await window.mdEditor.saveFile(updated, card.filePath, false);
  }
  render();
}

async function render() {
  const columns = scope === 'file' ? parseColumns(window.mdCodeMirror.getValue()) : await buildFolderColumns();
  board.innerHTML = '';

  if (!columns.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = scope === 'file'
      ? 'Sin columnas todavía: usá encabezados "## Nombre de columna" con una lista debajo, cada ítem es una tarjeta.'
      : 'Sin columnas en la carpeta abierta (o no hay carpeta abierta).';
    board.appendChild(empty);
    return;
  }

  columns.forEach((col) => {
    const colEl = document.createElement('div');
    colEl.className = 'kanban-column';

    const titleEl = document.createElement('div');
    titleEl.className = 'kanban-column-title';
    titleEl.textContent = `${col.title} (${col.cards.length})`;
    colEl.appendChild(titleEl);

    const listEl = document.createElement('div');
    listEl.className = 'kanban-column-list';
    col.cards.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'kanban-card' + (card.checked ? ' kanban-card-done' : '');
      cardEl.textContent = card.text || '(vacío)';
      cardEl.addEventListener('click', () => toggleCard(card));

      cardEl.draggable = true;
      if (scope === 'folder') {
        const src = document.createElement('span');
        src.className = 'kanban-card-source';
        src.textContent = card.filePath.split(/[\\/]/).pop();
        cardEl.appendChild(src);
        cardEl.title = 'Clic: marcar/desmarcar. Arrastrar: mover de columna (dentro de su archivo).';
      } else {
        cardEl.title = 'Clic: marcar/desmarcar. Arrastrar: mover de columna.';
      }
      cardEl.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(KANBAN_DRAG_MIME, JSON.stringify({ line: card.line, filePath: card.filePath || null, from: col.title }));
      });
      listEl.appendChild(cardEl);
    });
    colEl.appendChild(listEl);

    colEl.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes(KANBAN_DRAG_MIME)) return;
      e.preventDefault();
      colEl.classList.add('drag-over');
    });
    colEl.addEventListener('dragleave', () => colEl.classList.remove('drag-over'));
    colEl.addEventListener('drop', (e) => {
      if (!e.dataTransfer.types.includes(KANBAN_DRAG_MIME)) return;
      e.preventDefault();
      colEl.classList.remove('drag-over');
      let ref;
      try {
        ref = JSON.parse(e.dataTransfer.getData(KANBAN_DRAG_MIME));
      } catch (err) {
        return;
      }
      if (typeof ref === 'number') ref = { line: ref }; // formato viejo: solo la línea
      if (ref.from === col.title) return;
      if (scope === 'folder' && ref.filePath) moveFolderCard({ line: ref.line, filePath: ref.filePath }, col.title);
      else moveCard(ref.line, col.title);
    });

    board.appendChild(colEl);
  });
}

function setScope(next) {
  scope = next;
  scopeFileBtn.classList.toggle('kanban-scope-active', scope === 'file');
  scopeFolderBtn.classList.toggle('kanban-scope-active', scope === 'folder');
  render();
}

scopeFileBtn.addEventListener('click', () => setScope('file'));
scopeFolderBtn.addEventListener('click', () => setScope('folder'));

function open() {
  overlay.hidden = false;
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

window.mdKanban = { open, close, setScope };

})();
