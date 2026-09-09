(function () {
'use strict';

// Tablero armado en vivo a partir del documento activo: cada "## Columna"
// es una columna, cada "- item" (con o sin checkbox) debajo es una tarjeta.
// No hay estado propio — todo se lee y se escribe directo sobre el texto
// del editor (así "Guardar" y el autoguardado ya funcionan solos).

const overlay = document.getElementById('kanban-panel');
const board = document.getElementById('kanban-board');
const KANBAN_DRAG_MIME = 'application/x-mk-kanban-card';

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

function toggleCard(lineIndex) {
  const cm = window.mdCodeMirror;
  const lines = cm.getValue().split('\n');
  const line = lines[lineIndex];
  if (line == null) return;
  const withBox = line.match(/^(-\s+)\[([ xX])\](\s+.*)/);
  if (withBox) {
    const newMark = withBox[2].trim() === '' ? 'x' : ' ';
    lines[lineIndex] = `${withBox[1]}[${newMark}]${withBox[3]}`;
  } else {
    const plain = line.match(/^(-\s+)(.*)/);
    if (plain) lines[lineIndex] = `${plain[1]}[x] ${plain[2]}`;
  }
  cm.setValue(lines.join('\n'));
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

function render() {
  const columns = parseColumns(window.mdCodeMirror.getValue());
  board.innerHTML = '';

  if (!columns.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'Sin columnas todavía: usá encabezados "## Nombre de columna" con una lista debajo, cada ítem es una tarjeta.';
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
      cardEl.draggable = true;
      cardEl.title = 'Clic: marcar/desmarcar. Arrastrar: mover de columna.';
      cardEl.addEventListener('click', () => toggleCard(card.line));
      cardEl.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(KANBAN_DRAG_MIME, String(card.line));
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
      const lineIndex = Number(e.dataTransfer.getData(KANBAN_DRAG_MIME));
      moveCard(lineIndex, col.title);
    });

    board.appendChild(colEl);
  });
}

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

window.mdKanban = { open, close };

})();
