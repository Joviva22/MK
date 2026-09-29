(function () {
'use strict';

// Tema hecho a mano: color picker para los mismos 7 tokens que ya usan los
// 26 temas fijos de themes.js (--bg/--surface/--surface-2/--text/
// --text-muted/--border/--accent), guardado como un tema más en config.json
// bajo la clave "customTheme". Se aplica pisando esas variables con
// document.documentElement.style (inline, mayor especificidad que los
// bloques [data-theme="..."] de styles.css), así no hace falta tocar CSS
// para sumar un tema por usuario.

const TOKENS = [
  { key: 'bg', cssVar: '--bg', label: 'Fondo' },
  { key: 'surface', cssVar: '--surface', label: 'Superficie' },
  { key: 'surface2', cssVar: '--surface-2', label: 'Superficie 2' },
  { key: 'text', cssVar: '--text', label: 'Texto' },
  { key: 'textMuted', cssVar: '--text-muted', label: 'Texto tenue' },
  { key: 'border', cssVar: '--border', label: 'Borde' },
  { key: 'accent', cssVar: '--accent', label: 'Acento' }
];

const DEFAULTS = {
  bg: '#ffffff', surface: '#f5f7fa', surface2: '#eef1f5',
  text: '#1f2937', textMuted: '#6b7280', border: '#d8dee8', accent: '#2563eb'
};

const overlay = document.getElementById('custom-theme-panel');
const fieldsEl = document.getElementById('custom-theme-fields');
const warningEl = document.getElementById('custom-theme-warning');
const applyBtn = document.getElementById('custom-theme-apply');
const cancelBtn = document.getElementById('custom-theme-cancel');

let draft = { ...DEFAULTS };

function relativeLuminance(hex) {
  const c = hex.replace('#', '');
  const chan = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = chan(parseInt(c.substr(0, 2), 16));
  const g = chan(parseInt(c.substr(2, 2), 16));
  const b = chan(parseInt(c.substr(4, 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function renderWarning() {
  const textBg = contrastRatio(draft.text, draft.bg);
  const accentBg = contrastRatio(draft.accent, draft.bg);
  const problems = [];
  if (textBg < 4.5) problems.push(`texto/fondo ${textBg.toFixed(1)}:1 (recomendado 4.5:1+)`);
  if (accentBg < 3) problems.push(`acento/fondo ${accentBg.toFixed(1)}:1 (recomendado 3:1+)`);
  warningEl.textContent = problems.length ? ('⚠ Contraste bajo — ' + problems.join(', ')) : '';
  warningEl.hidden = !problems.length;
}

function applyLive() {
  const root = document.documentElement;
  root.setAttribute('data-theme', 'custom');
  TOKENS.forEach((t) => root.style.setProperty(t.cssVar, draft[t.key]));
  renderWarning();
}

function clearInline() {
  const root = document.documentElement;
  TOKENS.forEach((t) => root.style.removeProperty(t.cssVar));
}

function applyStored(colors) {
  draft = { ...DEFAULTS, ...(colors || {}) };
  applyLive();
}

function renderFields() {
  fieldsEl.innerHTML = '';
  TOKENS.forEach((t) => {
    const row = document.createElement('label');
    row.className = 'custom-theme-field';
    const span = document.createElement('span');
    span.textContent = t.label;
    row.appendChild(span);
    const input = document.createElement('input');
    input.type = 'color';
    input.value = draft[t.key];
    input.addEventListener('input', () => {
      draft[t.key] = input.value;
      applyLive();
    });
    row.appendChild(input);
    fieldsEl.appendChild(row);
  });
}

async function open() {
  const config = await window.mdEditor.getConfig();
  draft = { ...DEFAULTS, ...(config.customTheme || {}) };
  renderFields();
  applyLive();
  overlay.hidden = false;
}

async function close(revert) {
  overlay.hidden = true;
  if (revert) {
    const config = await window.mdEditor.getConfig();
    window.mdThemes.applyTheme(config.theme || 'light', config.customTheme);
  }
}

async function save() {
  await window.mdEditor.setConfig({ theme: 'custom', customTheme: draft });
  overlay.hidden = true;
  if (window.renderPreview) window.renderPreview();
}

applyBtn.addEventListener('click', save);
cancelBtn.addEventListener('click', () => close(true));
overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(true); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(true); });

window.mdCustomTheme = { open, applyStored, clearInline };

})();
