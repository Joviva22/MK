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
  cmds.push({ label: 'Plantillas completas de Office', run: () => window.mdOfficeTools.templates() });
  cmds.push({ label: 'Ayuda práctica del documento', run: () => window.mdOfficeTools.help() });
  cmds.push({ label: 'Estudio: vista dividida PDF, nota y pizarra', run: () => window.mdStudyWorkspace.open().catch((error) => alert(error.message)) });
  cmds.push({ label: 'Insertar PDF o pizarra en la nota', run: () => window.mdStudyEmbed.insert().catch((error) => alert(error.message)) });
  cmds.push({ label: 'Pizarra: nueva Excalidraw (local)', run: () => window.mdDrawing.open().catch((error) => alert(error.message)) });

  cmds.push({ label: 'Abrir carpeta', run: () => document.getElementById('btn-open-folder').click() });
  cmds.push({ label: 'Refrescar archivos (ver si hay nuevos)', run: () => document.getElementById('btn-refresh-tree').click() });
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
  cmds.push({ label: 'Abrir archivo rápido por nombre', run: () => window.mdFileOpen && window.mdFileOpen.open() });
  cmds.push({ label: 'Pomodoro: iniciar/pausar', run: () => window.mdPomodoro && window.mdPomodoro.toggle() });
  cmds.push({ label: 'Pomodoro: categorías, estadísticas e historial', run: () => window.mdPomodoroPanel && window.mdPomodoroPanel.open() });
  cmds.push({ label: 'Pomodoro: iniciar foco con la nota abierta', run: () => window.mdPomodoro && window.mdPomodoro.startForNote().catch((error) => alert(error.message)) });
  cmds.push({ label: 'Pomodoro: cancelar', run: () => window.mdPomodoro && window.mdPomodoro.reset() });
  cmds.push({ label: 'Reproductor: play/pausa (playerctl)', run: () => window.mdMediaPlayer && window.mdMediaPlayer.playPause() });
  cmds.push({ label: 'Reproductor: siguiente (playerctl)', run: () => window.mdMediaPlayer && window.mdMediaPlayer.next() });
  cmds.push({ label: 'Reproductor: anterior (playerctl)', run: () => window.mdMediaPlayer && window.mdMediaPlayer.previous() });
  cmds.push({ label: 'Buscar y reemplazar en el archivo actual', run: () => window.mdFindReplace && window.mdFindReplace.open() });
  cmds.push({ label: 'Ver todas las etiquetas', run: () => window.mdTags && window.mdTags.open() });
  cmds.push({ label: 'Backlinks: qué enlaza aquí', run: () => window.mdBacklinks && window.mdBacklinks.open() });
  cmds.push({ label: 'Ver versiones anteriores...', run: () => window.mdHistory && window.mdHistory.open() });
  cmds.push({ label: 'Plugins y comunidad', run: () => window.mdPlugins && window.mdPlugins.open() });
  cmds.push({ label: 'Nota diaria de hoy', run: () => window.mdDailyNote && window.mdDailyNote.open() });
  cmds.push({ label: 'Ver tablero Kanban', run: () => window.mdKanban && window.mdKanban.open() });
  cmds.push({ label: 'Modo Live Preview (escribir viendo el Markdown renderizado)', run: () => window.mdModes && window.mdModes.toggleMode('live') });
  cmds.push({ label: 'Modo máquina de escribir (cursor centrado)', run: () => window.mdTypewriter && window.mdTypewriter.set({ typewriter: !window.mdTypewriter.isOn() }) });
  cmds.push({ label: 'Atenuar los otros párrafos', run: () => window.mdTypewriter && window.mdTypewriter.set({ dim: !window.mdTypewriter.isDim() }) });
  cmds.push({ label: 'Terminal: mostrar/ocultar', run: () => window.mdTerminal && window.mdTerminal.toggle() });
  cmds.push({ label: 'Ejecutar archivo actual en la terminal (F5)', run: () => window.mdTerminal && window.mdTerminal.runActiveFile() });
  ['claude', 'gemini', 'codex'].forEach((id) => {
    const label = { claude: 'Claude Code', gemini: 'Gemini CLI', codex: 'Codex' }[id];
    cmds.push({ label: `IA: abrir ${label} sobre el archivo actual`, run: () => window.mdTerminal && window.mdTerminal.openActiveWithAI(id) });
  });
  cmds.push({ label: 'Terminal: nueva terminal', run: () => window.mdTerminal && window.mdTerminal.newTerminal() });
  cmds.push({ label: 'Terminal: dividir (otra al lado)', run: () => window.mdTerminal && window.mdTerminal.splitTerminal() });
  cmds.push({ label: 'Mascotas: mi colección, huevos y logros', run: () => window.mdPet && window.mdPet.openCollection() });
  cmds.push({ label: 'Home: planificador semanal y mensual', run: () => window.mdHome && window.mdHome.open() });
  cmds.push({ label: 'Home: estudio por asignatura', run: () => window.mdStudy && window.mdStudy.open().catch((error) => alert(error.message)) });
  cmds.push({ label: 'Estudio: plan de hoy', run: () => window.mdStudy && window.mdStudy.open().catch((error) => alert(error.message)) });
  cmds.push({ label: 'Estudio: tarjetas, repaso espaciado y modo examen', run: () => window.mdStudy && window.mdStudy.openLearning().catch((error) => alert(error.message)) });
  cmds.push({ label: 'Bases de datos', run: () => window.mdDatabase && window.mdDatabase.open() });
  cmds.push({ label: 'Reportar un problema…', run: () => window.mdReportDialog && window.mdReportDialog.open() });
  cmds.push({ label: 'Reemplazar en toda la carpeta…', run: () => window.mdReplaceFolder && window.mdReplaceFolder.open() });
  cmds.push({ label: 'Bienvenida: volver a ver la guía de inicio', run: () => window.mdWelcome && window.mdWelcome.open() });
  cmds.push({ label: 'Respaldo: exportar todo (ajustes, Home, mascotas)', run: () => window.mdBackup && window.mdBackup.exportAll() });
  cmds.push({ label: 'Respaldo: importar…', run: () => window.mdBackup && window.mdBackup.importAll() });
  cmds.push({ label: 'Multimedia: explorar fotos, videos y audio de la carpeta', run: () => window.mdMediaBrowser && window.mdMediaBrowser.open() });
  cmds.push({ label: 'Ver grafo de notas', run: () => window.mdGraph && window.mdGraph.open() });
  cmds.push({ label: 'Operaciones de páginas PDF (unir, separar, rotar...)', run: () => window.mdPdfPages && window.mdPdfPages.open() });
  cmds.push({ label: 'PDF: seleccionar, copiar, subrayar y escribir (texto libre, formularios)', run: () => window.mdPdfHighlight && window.mdPdfHighlight.open() });
  cmds.push({ label: 'Sincronizar con git (elegir archivos y mensaje)...', run: () => window.mdGitPanel && window.mdGitPanel.open() });

  (window.mdThemes ? window.mdThemes.THEME_LIST : []).forEach((t) => {
    cmds.push({ label: `Tema: ${t.label}`, run: () => window.mdThemes.chooseTheme(t.slug) });
  });
  cmds.push({ label: 'Tema: ver la galería de temas', run: () => window.mdThemes.openGallery() });
  cmds.push({ label: 'Tema personalizado...', run: () => window.mdCustomTheme && window.mdCustomTheme.open() });

  if (window.mdTabs) {
    cmds.push({ label: 'Nueva pestaña', run: () => window.mdTabs.newTab() });
    cmds.push({ label: 'Pestaña: reabrir la última cerrada', run: () => window.mdTabs.reopenClosed() });
    cmds.push({ label: 'Pestaña siguiente', run: () => window.mdTabs.cycleTab(1) });
    cmds.push({ label: 'Pestaña anterior', run: () => window.mdTabs.cycleTab(-1) });
  }

  // Módulos apagados en Ajustes → Módulos no aparecen.
  return window.mdModules ? cmds.filter((c) => window.mdModules.allowsCommand(c.label)) : cmds;
}

function render(filter) {
  const q = filter.trim().toLowerCase();
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q));
  list.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = 'No hay comandos con ese nombre. Prueba con otra palabra.';
    list.appendChild(empty);
  }
  filtered.forEach((cmd, i) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item' + (i === selectedIndex ? ' selected' : '');
    window.mdSearchPresentation.highlight(item, cmd.label, filter);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      runCommand(cmd);
    });
    list.appendChild(item);
  });
  list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
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
    selectedIndex = Math.max(0, Math.min(selectedIndex + 1, filtered.length - 1));
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
  if (window.mdShortcuts) return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    if (overlay.hidden) openPalette(); else closePalette();
  }
});

window.mdCommandPalette = { open: openPalette, close: closePalette };

})();
