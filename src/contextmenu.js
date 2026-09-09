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

let clickWordRange = null; // {anchor, head} en el cm del "word" bajo el clic derecho, si había uno
let pendingSpellcheck = null; // último {misspelledWord, dictionarySuggestions} recibido de main.js

function insertSpellSuggestion(cm, suggestion) {
  if (!clickWordRange) return;
  cm.replaceRange(suggestion, clickWordRange.anchor, clickWordRange.head);
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

function runAction(action, value) {
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
    case 'spellfix': insertSpellSuggestion(cm, value); break;
    case 'spellAddWord': window.mdEditor.addWordToDictionary(value); break;
    default: break;
  }
}

function buildItems() {
  const items = [];
  if (pendingSpellcheck && pendingSpellcheck.misspelledWord && clickWordRange) {
    const word = pendingSpellcheck.misspelledWord;
    const suggestions = (pendingSpellcheck.dictionarySuggestions || []).slice(0, 5);
    if (suggestions.length) {
      suggestions.forEach((s) => items.push({ label: s, action: 'spellfix', value: s }));
    } else {
      items.push({ label: 'Sin sugerencias', disabled: true });
    }
    items.push({ label: `Agregar "${word}" al diccionario`, action: 'spellAddWord', value: word });
    items.push({ sep: true });
  }
  return items.concat(MENU_ITEMS);
}

function renderMenuItems() {
  contextMenuEl.innerHTML = '';
  const hasSelection = window.mdCodeMirror.somethingSelected();
  buildItems().forEach((item) => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-sep';
      contextMenuEl.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.textContent = item.label;
    if (item.disabled || ((item.action === 'copy' || item.action === 'cut') && !hasSelection)) {
      btn.disabled = true;
    }
    btn.addEventListener('click', () => {
      hideContextMenu();
      runAction(item.action, item.value);
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
  const cm = window.mdCodeMirror;
  cm.focus();
  pendingSpellcheck = null;
  const pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
  const word = cm.findWordAt(pos);
  clickWordRange = word && word.anchor.ch !== word.head.ch ? { anchor: word.anchor, head: word.head } : null;
  showContextMenu(e.clientX, e.clientY);
});

// Llega async desde main.js (evento 'context-menu' de webContents) — casi
// siempre después de que el menú ya se mostró, así que si sigue abierto lo
// volvemos a dibujar para sumarle las sugerencias arriba.
window.mdEditor.onSpellcheckSuggestions((data) => {
  pendingSpellcheck = data;
  if (!contextMenuEl.hidden) renderMenuItems();
});

document.addEventListener('click', (e) => {
  if (!contextMenuEl.contains(e.target)) hideContextMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideContextMenu();
});

})();
