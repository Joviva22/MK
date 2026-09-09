(function () {
'use strict';

let autosaveIntervalMs = 1000;

window.mdGetAutosaveInterval = () => autosaveIntervalMs;

window.initDropdown('btn-settings', 'settings-menu');

const autosaveSelect = document.getElementById('autosave-select');
const fontSizeSelect = document.getElementById('fontsize-select');
const fontFamilySelect = document.getElementById('fontfamily-select');
const tabSizeSelect = document.getElementById('tabsize-select');
const wordWrapToggle = document.getElementById('wordwrap-toggle');
const snippetsTextarea = document.getElementById('snippets-textarea');

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

  window.mdCodeMirror.refresh();
})();

})();
