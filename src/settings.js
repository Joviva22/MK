(function () {
'use strict';

let autosaveIntervalMs = 1000;
let gitSyncEnabled = false;

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

fontSizeSelect.addEventListener('change', async (e) => {
  document.documentElement.style.setProperty('--editor-font-size', `${e.target.value}px`);
  window.mdCodeMirror.refresh();
  await window.mdEditor.setConfig({ editorFontSize: e.target.value });
});

// Ajuste rápido de tamaño de fuente sin pasar por el dropdown de Ajustes:
// Ctrl+scroll sobre el editor, o Ctrl+=/Ctrl+- en cualquier lado (Ctrl+0
// vuelve al tamaño por defecto) — mismo mecanismo/config que el select de
// arriba, así quedan siempre sincronizados.
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 14;

function currentFontSize() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size');
  return parseInt(raw, 10) || DEFAULT_FONT_SIZE;
}

async function setFontSize(px) {
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, px));
  document.documentElement.style.setProperty('--editor-font-size', `${clamped}px`);
  window.mdCodeMirror.refresh();
  fontSizeSelect.value = String(clamped);
  await window.mdEditor.setConfig({ editorFontSize: String(clamped) });
}

document.getElementById('editor-pane').addEventListener(
  'wheel',
  (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setFontSize(currentFontSize() + (e.deltaY < 0 ? 1 : -1));
  },
  { passive: false }
);

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

(async () => {
  const config = await window.mdEditor.getConfig();

  autosaveIntervalMs = config.autosaveInterval != null ? config.autosaveInterval : 1000;
  autosaveSelect.value = String(autosaveIntervalMs);

  const fontSize = config.editorFontSize || '14';
  fontSizeSelect.value = fontSize;
  document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);

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

  window.mdCodeMirror.refresh();
})();

})();
