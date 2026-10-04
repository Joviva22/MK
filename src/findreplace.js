(function () {
'use strict';

// Buscar/reemplazar dentro del archivo abierto (Ctrl+F) — Ctrl+Shift+F ya
// existía pero busca en TODA la carpeta y navega a otro archivo; esto es
// lo básico que le faltaba a MK como editor de texto: encontrar y cambiar
// texto sin salir del documento actual. Usa el addon searchcursor.js de
// CodeMirror para encontrar coincidencias, pero NO el addon search.js (ese
// trae su propio diálogo con un estilo que no combina con el resto de MK)
// — la UI de acá es propia, igual al resto de la app.

const cm = window.mdCodeMirror;
const widget = document.getElementById('find-widget');
const findInput = document.getElementById('find-input');
const countEl = document.getElementById('find-count');
const replaceRow = document.getElementById('find-replace-row');
const replaceInput = document.getElementById('replace-input');

let marks = [];
let matches = [];
let currentIndex = -1;
let debounceTimer = null;

function clearMarks() {
  marks.forEach((m) => m.clear());
  marks = [];
}

function computeMatches(query) {
  if (!query) return [];
  const results = [];
  const cursor = cm.getSearchCursor(query, { line: 0, ch: 0 }, { caseFold: true });
  while (cursor.findNext()) {
    results.push({ from: cursor.from(), to: cursor.to() });
  }
  return results;
}

function paintMarks() {
  clearMarks();
  matches.forEach((m, i) => {
    marks.push(
      cm.markText(m.from, m.to, { className: i === currentIndex ? 'cm-find-match-current' : 'cm-find-match' })
    );
  });
}

function updateCount() {
  countEl.textContent = matches.length ? `${currentIndex + 1}/${matches.length}` : '0/0';
}

function highlightCurrent(scroll) {
  if (currentIndex < 0 || !matches[currentIndex]) return;
  const m = matches[currentIndex];
  if (scroll !== false) cm.scrollIntoView({ from: m.from, to: m.to }, 60);
}

function runSearch(query, keepIndex) {
  const startPos = cm.getCursor();
  matches = computeMatches(query);
  if (!matches.length) {
    currentIndex = -1;
  } else if (!keepIndex || currentIndex < 0) {
    currentIndex = matches.findIndex((m) => CodeMirror.cmpPos(m.from, startPos) >= 0);
    if (currentIndex === -1) currentIndex = 0;
  } else {
    currentIndex = Math.min(currentIndex, matches.length - 1);
  }
  paintMarks();
  updateCount();
  highlightCurrent();
}

function next() {
  if (!matches.length) return;
  currentIndex = (currentIndex + 1) % matches.length;
  paintMarks();
  updateCount();
  highlightCurrent();
}

function prev() {
  if (!matches.length) return;
  currentIndex = (currentIndex - 1 + matches.length) % matches.length;
  paintMarks();
  updateCount();
  highlightCurrent();
}

function replaceOne() {
  if (currentIndex < 0 || !matches[currentIndex]) return;
  const m = matches[currentIndex];
  cm.replaceRange(replaceInput.value, m.from, m.to);
  runSearch(findInput.value, true);
}

function replaceAll() {
  if (!matches.length) return;
  const replacement = replaceInput.value;
  cm.operation(() => {
    // de atrás para adelante: reemplazar no corre las posiciones de los
    // que todavía faltan
    for (let i = matches.length - 1; i >= 0; i--) {
      cm.replaceRange(replacement, matches[i].from, matches[i].to);
    }
  });
  runSearch(findInput.value);
}

function scheduleRerun() {
  if (widget.hidden) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch(findInput.value, true), 150);
}

function open() {
  widget.hidden = false;
  const sel = cm.getSelection();
  if (sel && !sel.includes('\n')) findInput.value = sel;
  findInput.focus();
  findInput.select();
  runSearch(findInput.value);
}

function close() {
  widget.hidden = true;
  replaceRow.hidden = true;
  clearTimeout(debounceTimer);
  clearMarks();
  matches = [];
  currentIndex = -1;
  cm.focus();
}

findInput.addEventListener('input', () => runSearch(findInput.value));
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) prev(); else next();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
});

replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    replaceOne();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
});

document.getElementById('find-next').addEventListener('click', next);
document.getElementById('find-prev').addEventListener('click', prev);
document.getElementById('find-close').addEventListener('click', close);
document.getElementById('find-toggle-replace').addEventListener('click', () => {
  replaceRow.hidden = !replaceRow.hidden;
  if (!replaceRow.hidden) replaceInput.focus();
});
document.getElementById('replace-one').addEventListener('click', replaceOne);
document.getElementById('replace-all').addEventListener('click', replaceAll);

document.addEventListener('keydown', (e) => {
  if (window.mdShortcuts) return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    open();
  }
});

// Cambios en el documento (tipeo normal) o cambio de pestaña (swapDoc, CM5
// no dispara 'change' ahí) invalidan las posiciones ya calculadas.
cm.on('change', scheduleRerun);
cm.on('swapDoc', () => {
  if (!widget.hidden) close();
});

window.mdFindReplace = { open, close };

})();
