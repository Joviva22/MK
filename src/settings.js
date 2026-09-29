(function () {
'use strict';

let autosaveIntervalMs = 1000;
let gitSyncEnabled = false;
let pomodoroFocusMinutes = 25;
let pomodoroBreakMinutes = 5;

window.mdGetAutosaveInterval = () => autosaveIntervalMs;
window.mdGetGitSyncEnabled = () => gitSyncEnabled;

window.initDropdown('btn-settings', 'settings-menu');

const autosaveSelect = document.getElementById('autosave-select');
const fontSizeSelect = document.getElementById('fontsize-select');
const fontFamilySelect = document.getElementById('fontfamily-select');
const tabSizeSelect = document.getElementById('tabsize-select');
const wordWrapToggle = document.getElementById('wordwrap-toggle');
const snippetsTextarea = document.getElementById('snippets-textarea');
const gitSyncToggle = document.getElementById('gitsync-toggle');
const pomodoroFocusSelect = document.getElementById('pomodoro-focus-select');
const pomodoroBreakSelect = document.getElementById('pomodoro-break-select');

// "/abrev = expansión", una por línea -> { "/abrev": "expansión" }
function parseSnippetsText(text) {
  const result = {};
  text.split('\n').forEach((line) => {
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key.startsWith('/') && value) result[key] = value;
  });
  return result;
}

function serializeSnippets(map) {
  return Object.entries(map).map(([key, value]) => `${key} = ${value}`).join('\n');
}

autosaveSelect.addEventListener('change', async (e) => {
  autosaveIntervalMs = Number(e.target.value);
  await window.mdEditor.setConfig({ autosaveInterval: autosaveIntervalMs });
});

fontSizeSelect.addEventListener('change', (e) => setFontSize(Number(e.target.value)));

// Ajuste rápido de tamaño de fuente sin pasar por el dropdown de Ajustes:
// Ctrl+scroll sobre el editor O el preview (el que esté visible — en modo
// lectura el editor está oculto), o Ctrl+=/Ctrl+- en cualquier lado (Ctrl+0
// vuelve al tamaño por defecto). Mueve los dos tamaños a la vez (editor y
// preview, cada uno con el mismo desplazamiento desde su propio default)
// para no tener que detectar en qué modo está el principal — así funciona
// igual esté como esté.
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_PREVIEW_FONT_SIZE = 15;
const MIN_PREVIEW_FONT_SIZE = MIN_FONT_SIZE + (DEFAULT_PREVIEW_FONT_SIZE - DEFAULT_FONT_SIZE);
const MAX_PREVIEW_FONT_SIZE = MAX_FONT_SIZE + (DEFAULT_PREVIEW_FONT_SIZE - DEFAULT_FONT_SIZE);

function currentFontSize() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size');
  return parseInt(raw, 10) || DEFAULT_FONT_SIZE;
}

function applyPreviewFontSize(editorSize) {
  const preview = Math.max(MIN_PREVIEW_FONT_SIZE, Math.min(MAX_PREVIEW_FONT_SIZE, editorSize + (DEFAULT_PREVIEW_FONT_SIZE - DEFAULT_FONT_SIZE)));
  document.documentElement.style.setProperty('--preview-font-size', `${preview}px`);
}

async function setFontSize(px) {
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, px));
  document.documentElement.style.setProperty('--editor-font-size', `${clamped}px`);
  applyPreviewFontSize(clamped);
  window.mdCodeMirror.refresh();
  fontSizeSelect.value = String(clamped);
  await window.mdEditor.setConfig({ editorFontSize: String(clamped) });
}

function wireZoomWheel(el) {
  el.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setFontSize(currentFontSize() + (e.deltaY < 0 ? 1 : -1));
    },
    { passive: false }
  );
}

wireZoomWheel(document.getElementById('editor-pane'));
wireZoomWheel(document.getElementById('preview-scroll'));

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === '=' || e.key === '+') {
    e.preventDefault();
    setFontSize(currentFontSize() + 1);
  } else if (e.key === '-') {
    e.preventDefault();
    setFontSize(currentFontSize() - 1);
  } else if (e.key === '0') {
    e.preventDefault();
    setFontSize(DEFAULT_FONT_SIZE);
  }
});

fontFamilySelect.addEventListener('change', async (e) => {
  document.documentElement.style.setProperty('--editor-font-family', e.target.value);
  window.mdCodeMirror.refresh();
  await window.mdEditor.setConfig({ editorFontFamily: e.target.value });
});

tabSizeSelect.addEventListener('change', async (e) => {
  const size = Number(e.target.value);
  window.mdCodeMirror.setOption('tabSize', size);
  window.mdCodeMirror.setOption('indentUnit', size);
  await window.mdEditor.setConfig({ editorTabSize: size });
});

wordWrapToggle.addEventListener('change', async (e) => {
  window.mdCodeMirror.setOption('lineWrapping', e.target.checked);
  await window.mdEditor.setConfig({ editorWordWrap: e.target.checked });
});

snippetsTextarea.addEventListener('change', async (e) => {
  const textSnippets = parseSnippetsText(e.target.value);
  await window.mdEditor.setConfig({ textSnippets });
  if (window.mdSnippets) window.mdSnippets.reload();
});

gitSyncToggle.addEventListener('change', async (e) => {
  gitSyncEnabled = e.target.checked;
  await window.mdEditor.setConfig({ gitSyncEnabled });
});

pomodoroFocusSelect.addEventListener('change', async (e) => {
  pomodoroFocusMinutes = Number(e.target.value);
  await window.mdEditor.setConfig({ pomodoroFocusMinutes });
});

pomodoroBreakSelect.addEventListener('change', async (e) => {
  pomodoroBreakMinutes = Number(e.target.value);
  await window.mdEditor.setConfig({ pomodoroBreakMinutes });
});

(async () => {
  const config = await window.mdEditor.getConfig();

  autosaveIntervalMs = config.autosaveInterval != null ? config.autosaveInterval : 1000;
  autosaveSelect.value = String(autosaveIntervalMs);

  const fontSize = config.editorFontSize || '14';
  fontSizeSelect.value = fontSize;
  document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  applyPreviewFontSize(Number(fontSize));

  const fontFamily = config.editorFontFamily || fontFamilySelect.options[0].value;
  fontFamilySelect.value = fontFamily;
  document.documentElement.style.setProperty('--editor-font-family', fontFamily);

  const tabSize = config.editorTabSize != null ? config.editorTabSize : 2;
  tabSizeSelect.value = String(tabSize);
  window.mdCodeMirror.setOption('tabSize', tabSize);
  window.mdCodeMirror.setOption('indentUnit', tabSize);

  const wordWrap = config.editorWordWrap !== false;
  wordWrapToggle.checked = wordWrap;
  window.mdCodeMirror.setOption('lineWrapping', wordWrap);

  snippetsTextarea.value = serializeSnippets(config.textSnippets || {});

  gitSyncEnabled = !!config.gitSyncEnabled;
  gitSyncToggle.checked = gitSyncEnabled;

  pomodoroFocusMinutes = config.pomodoroFocusMinutes != null ? config.pomodoroFocusMinutes : 25;
  pomodoroFocusSelect.value = String(pomodoroFocusMinutes);
  pomodoroBreakMinutes = config.pomodoroBreakMinutes != null ? config.pomodoroBreakMinutes : 5;
  pomodoroBreakSelect.value = String(pomodoroBreakMinutes);

  window.mdCodeMirror.refresh();
})();

// Bandeja y arranque con el sistema (ver traymode.js). "Seguir en la
// bandeja" viene activado por defecto (config.keepInTray !== false).
const keepInTrayToggle = document.getElementById('keep-in-tray-toggle');
const autostartToggle = document.getElementById('autostart-toggle');
(async () => {
  const config = await window.mdEditor.getConfig();
  keepInTrayToggle.checked = config.keepInTray !== false;
  autostartToggle.checked = await window.mdEditor.getAutostart();
})();
keepInTrayToggle.addEventListener('change', () => window.mdEditor.setConfig({ keepInTray: keepInTrayToggle.checked }));
autostartToggle.addEventListener('change', async () => {
  autostartToggle.checked = await window.mdEditor.setAutostart(autostartToggle.checked);
});

// Ctrl+Q: salir de verdad (cerrar la ventana solo la manda a la bandeja).
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'q') {
    e.preventDefault();
    window.mdEditor.quitApp();
  }
});

window.mdEditor.onTrayOpenHome(() => { if (window.mdHome) window.mdHome.open(); });

})();
