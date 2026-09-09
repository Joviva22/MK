(function () {
'use strict';

const overlay = document.getElementById('command-palette');
const input = document.getElementById('command-palette-input');
const list = document.getElementById('command-palette-list');

let commands = [];
let selectedIndex = 0;

// Los comandos se arman en el momento a partir de los botones ya existentes
// en la UI (dropdowns de plantillas/temas incluidos), así la paleta nunca se
// desincroniza de lo que la app realmente puede hacer.
function buildCommands() {
  const cmds = [];

  cmds.push({ label: 'Abrir carpeta', run: () => document.getElementById('btn-open-folder').click() });
  cmds.push({ label: 'Abrir archivo', run: () => document.getElementById('btn-open').click() });
  cmds.push({ label: 'Guardar', run: () => document.getElementById('btn-save').click() });
  cmds.push({ label: 'Guardar como', run: () => document.getElementById('btn-save-as').click() });

  document.querySelectorAll('#new-menu button[data-template]').forEach((btn) => {
    cmds.push({ label: `Nuevo: ${btn.textContent}`, run: () => btn.click() });
  });

  cmds.push({ label: 'Exportar a HTML', run: () => document.getElementById('btn-export-html').click() });
  cmds.push({ label: 'Exportar a PDF', run: () => document.getElementById('btn-export-pdf').click() });

  cmds.push({ label: 'Alternar índice del documento', run: () => document.getElementById('btn-toc').click() });
  cmds.push({ label: 'Ver cambios desde el último guardado', run: () => document.getElementById('btn-diff').click() });
  cmds.push({ label: 'Alternar modo enfoque / lectura', run: () => document.getElementById('btn-focus').click() });
  cmds.push({ label: 'Búsqueda global en la carpeta', run: () => window.mdSearch && window.mdSearch.open() });
  cmds.push({ label: 'Ver todas las etiquetas', run: () => window.mdTags && window.mdTags.open() });
  cmds.push({ label: 'Backlinks: qué enlaza aquí', run: () => window.mdBacklinks && window.mdBacklinks.open() });
  cmds.push({ label: 'Ver versiones anteriores...', run: () => window.mdHistory && window.mdHistory.open() });
  cmds.push({ label: 'Plugins y comunidad', run: () => window.mdPlugins && window.mdPlugins.open() });

  document.querySelectorAll('#theme-menu button[data-theme]').forEach((btn) => {
    cmds.push({ label: `Tema: ${btn.textContent}`, run: () => btn.click() });
  });

  if (window.mdTabs) {
    cmds.push({ label: 'Nueva pestaña', run: () => window.mdTabs.newTab() });
    cmds.push({ label: 'Pestaña siguiente', run: () => window.mdTabs.cycleTab(1) });
    cmds.push({ label: 'Pestaña anterior', run: () => window.mdTabs.cycleTab(-1) });
  }

  return cmds;
}

function render(filter) {
  const q = filter.trim().toLowerCase();
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q));
  list.innerHTML = '';
  filtered.forEach((cmd, i) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item' + (i === selectedIndex ? ' selected' : '');
    item.textContent = cmd.label;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      runCommand(cmd);
    });
    list.appendChild(item);
  });
  return filtered;
}

function runCommand(cmd) {
  closePalette();
  if (cmd) cmd.run();
}

function openPalette() {
  commands = buildCommands();
  selectedIndex = 0;
  input.value = '';
  overlay.hidden = false;
  render('');
  input.focus();
}

function closePalette() {
  overlay.hidden = true;
}

input.addEventListener('input', () => {
  selectedIndex = 0;
  render(input.value);
});

input.addEventListener('keydown', (e) => {
  const filtered = render(input.value);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
    render(input.value);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    render(input.value);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filtered[selectedIndex]) runCommand(filtered[selectedIndex]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closePalette();
  }
});

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) closePalette();
});

document.getElementById('btn-command-palette').addEventListener('click', openPalette);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    if (overlay.hidden) openPalette(); else closePalette();
  }
});

window.mdCommandPalette = { open: openPalette, close: closePalette };

})();
