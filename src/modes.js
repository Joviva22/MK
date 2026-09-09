(function () {
'use strict';

const containerEl = document.querySelector('.container');

let currentLayoutMode = 'normal';

function setLayoutMode(mode) {
  containerEl.classList.remove('mode-focus', 'mode-read');
  currentLayoutMode = mode;
  if (mode === 'focus') containerEl.classList.add('mode-focus');
  if (mode === 'read') containerEl.classList.add('mode-read');
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
}

function toggleMode(mode) {
  setLayoutMode(currentLayoutMode === mode ? 'normal' : mode);
}

document.getElementById('btn-focus').addEventListener('click', () => {
  const next = currentLayoutMode === 'normal' ? 'focus' : currentLayoutMode === 'focus' ? 'read' : 'normal';
  setLayoutMode(next);
});

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
  if (e.key.toLowerCase() === 'e') {
    e.preventDefault();
    toggleMode('focus');
  } else if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    toggleMode('read');
  }
});

})();
