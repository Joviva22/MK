(function () {
'use strict';

// Tablero armado en vivo: cada "## Columna" es una columna, cada "- item"
// (con o sin checkbox) debajo es una tarjeta. Dos modos:
// - "Archivo activo" (por defecto): lee/escribe directo sobre el buffer del
//   editor (cm.getValue()/setValue()) — así "Guardar" y el autoguardado ya
//   funcionan solos, sin tocar disco por cuenta propia.
// - "Carpeta completa": junta las columnas (por título) de TODOS los
//   archivos de texto de la carpeta abierta en un solo tablero. Cada
//   tarjeta lleva de qué archivo vino (badge) y clic la togglea leyendo/
//   escribiendo ESE archivo en disco directo (no pasa por el editor) — ver
//   MANUAL.md para el límite de arrastrar entre columnas en este modo.

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

function moveCard(lineIndex, targetTitle) {
  const cm = window.mdCodeMirror;
  const lines = cm.getValue().split('\n');
  const cardLine = lines[lineIndex];
  if (cardLine == null) return;
  lines.splice(lineIndex, 1);

  let targetHeadingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.*)/);
    if (h && h[1].trim() === targetTitle) {
      targetHeadingIdx = i;
      break;
    }
  }
  if (targetHeadingIdx === -1) return;

  let insertAt = lines.length;
  for (let i = targetHeadingIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      insertAt = i;
      break;
    }
  }
  lines.splice(insertAt, 0, cardLine);
  cm.setValue(lines.join('\n'));
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

      if (scope === 'folder') {
        const src = document.createElement('span');
        src.className = 'kanban-card-source';
        src.textContent = card.filePath.split(/[\\/]/).pop();
        cardEl.appendChild(src);
        cardEl.title = 'Clic: marcar/desmarcar. (Arrastrar entre columnas no está disponible en modo carpeta completa.)';
      } else {
        cardEl.draggable = true;
        cardEl.title = 'Clic: marcar/desmarcar. Arrastrar: mover de columna.';
        cardEl.addEventListener('dragstart', (e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData(KANBAN_DRAG_MIME, String(card.line));
        });
      }
      listEl.appendChild(cardEl);
    });
    colEl.appendChild(listEl);

    if (scope === 'file') {
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
        const lineIndex = Number(e.dataTransfer.getData(KANBAN_DRAG_MIME));
        moveCard(lineIndex, col.title);
      });
    }

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
