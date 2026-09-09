(function () {
'use strict';

const contextMenuEl = document.createElement('div');
contextMenuEl.id = 'context-menu';
contextMenuEl.className = 'context-menu';
contextMenuEl.hidden = true;
document.body.appendChild(contextMenuEl);

function ensureFreshLine(cm) {
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  if (line.length > 0) {
    cm.replaceRange('\n', cursor);
    cm.setCursor(cursor.line + 1, 0);
  }
}

function insertHeading(cm) {
  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  const prefix = '## ';
  cm.replaceRange(prefix, cursor);
  cm.setCursor(cursor.line, cursor.ch + prefix.length);
  cm.focus();
}

function insertTable(cm) {
  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  const block = '| Columna 1 | Columna 2 |\n| --------- | --------- |\n|           |           |';
  cm.replaceRange(block, cursor);
  cm.setCursor(cursor.line + 2, 2);
  cm.focus();
}

function insertLink(cm) {
  const from = cm.getCursor('from');
  const text = cm.getSelection() || 'texto';
  cm.replaceSelection(`[${text}](url)`);
  const urlStart = from.ch + `[${text}](`.length;
  cm.setSelection({ line: from.line, ch: urlStart }, { line: from.line, ch: urlStart + 3 });
  cm.focus();
}

function insertImage(cm) {
  const cursor = cm.getCursor();
  cm.replaceRange('![alt](ruta.png)', cursor);
  cm.setSelection({ line: cursor.line, ch: cursor.ch + 2 }, { line: cursor.line, ch: cursor.ch + 5 });
  cm.focus();
}

function insertCodeBlock(cm) {
  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  cm.replaceRange('```\ncódigo\n```', cursor);
  cm.setSelection({ line: cursor.line + 1, ch: 0 }, { line: cursor.line + 1, ch: 6 });
  cm.focus();
}

function insertCallout(cm) {
  ensureFreshLine(cm);
  const cursor = cm.getCursor();
  cm.replaceRange('> [!NOTE]\n> ', cursor);
  cm.setCursor(cursor.line + 1, 2);
  cm.focus();
}

const MENU_ITEMS = [
  { label: 'Copiar', action: 'copy' },
  { label: 'Cortar', action: 'cut' },
  { label: 'Pegar', action: 'paste' },
  { label: 'Seleccionar todo', action: 'selectall' },
  { sep: true },
  { label: 'Insertar título (H2)', action: 'heading' },
  { label: 'Insertar tabla', action: 'table' },
  { label: 'Insertar enlace', action: 'link' },
  { label: 'Insertar imagen', action: 'image' },
  { label: 'Insertar bloque de código', action: 'code' },
  { label: 'Insertar cita / callout', action: 'callout' }
];

function runAction(action) {
  const cm = window.mdCodeMirror;
  switch (action) {
    case 'copy':
      if (cm.somethingSelected()) window.mdEditor.clipboardWriteText(cm.getSelection());
      break;
    case 'cut':
      if (cm.somethingSelected()) {
        window.mdEditor.clipboardWriteText(cm.getSelection());
        cm.replaceSelection('');
      }
      break;
    case 'paste': {
      const text = window.mdEditor.clipboardReadText();
      if (text) cm.replaceSelection(text);
      cm.focus();
      break;
    }
    case 'selectall':
      cm.execCommand('selectAll');
      break;
    case 'heading': insertHeading(cm); break;
    case 'table': insertTable(cm); break;
    case 'link': insertLink(cm); break;
    case 'image': insertImage(cm); break;
    case 'code': insertCodeBlock(cm); break;
    case 'callout': insertCallout(cm); break;
    default: break;
  }
}

function renderMenuItems() {
  contextMenuEl.innerHTML = '';
  const hasSelection = window.mdCodeMirror.somethingSelected();
  MENU_ITEMS.forEach((item) => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-sep';
      contextMenuEl.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.textContent = item.label;
    if ((item.action === 'copy' || item.action === 'cut') && !hasSelection) {
      btn.disabled = true;
    }
    btn.addEventListener('click', () => {
      hideContextMenu();
      runAction(item.action);
    });
    contextMenuEl.appendChild(btn);
  });
}

function showContextMenu(x, y) {
  renderMenuItems();
  contextMenuEl.style.left = `${x}px`;
  contextMenuEl.style.top = `${y}px`;
  contextMenuEl.hidden = false;

  const rect = contextMenuEl.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 4;
  const maxY = window.innerHeight - rect.height - 4;
  if (x > maxX) contextMenuEl.style.left = `${Math.max(4, maxX)}px`;
  if (y > maxY) contextMenuEl.style.top = `${Math.max(4, maxY)}px`;
}

function hideContextMenu() {
  contextMenuEl.hidden = true;
}

document.getElementById('editor-pane').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.mdCodeMirror.focus();
  showContextMenu(e.clientX, e.clientY);
});

document.addEventListener('click', (e) => {
  if (!contextMenuEl.contains(e.target)) hideContextMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideContextMenu();
});

})();
