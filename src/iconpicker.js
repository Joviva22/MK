(function () {
'use strict';

const overlay = document.getElementById('icon-picker');
const input = document.getElementById('icon-picker-input');
const grid = document.getElementById('icon-picker-list');

let allIconNames = [];
let onPick = null;

function toKebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function getAllIconNames() {
  if (!allIconNames.length) {
    allIconNames = Object.keys(window.lucide.icons).map(toKebabCase).sort();
  }
  return allIconNames;
}

function renderGrid(filter) {
  const q = filter.trim().toLowerCase();
  const names = getAllIconNames().filter((n) => n.includes(q)).slice(0, 120);
  grid.innerHTML = '';
  if (!names.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'Sin resultados.';
    grid.appendChild(empty);
    return;
  }
  names.forEach((name) => {
    const btn = document.createElement('button');
    btn.className = 'icon-picker-item';
    btn.title = name;
    btn.innerHTML = `<i data-lucide="${name}"></i>`;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pick(name);
    });
    grid.appendChild(btn);
  });
  window.lucide.createIcons({ attrs: { width: 18, height: 18, 'stroke-width': 1.75 }, root: grid });
}

function pick(name) {
  const callback = onPick;
  close();
  if (callback) callback(name);
}

function open(label, callback) {
  onPick = callback;
  input.value = '';
  overlay.hidden = false;
  renderGrid('');
  input.focus();
}

function close() {
  overlay.hidden = true;
  onPick = null;
}

input.addEventListener('input', () => renderGrid(input.value));
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});

window.mdIconPicker = { open, close };

})();
