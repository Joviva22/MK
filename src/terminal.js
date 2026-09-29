(function () {
'use strict';

// Terminal integrada (panel inferior, estilo VS Code). Cada pestaña es un
// xterm.js (dibujo) conectado por IPC a un pseudo-terminal real en el
// main-process (src/ptyhost.js). Arranca en la carpeta abierta.
//
// Atajos: Ctrl+` (o Ctrl+Ñ en teclado español) muestra/oculta el panel;
// F5 guarda y ejecuta el archivo activo (.py, .sh, .js, .c, .cpp, .java...);
// Ctrl+Shift+C / Ctrl+Shift+V copian/pegan dentro de la terminal; Ctrl+F
// busca en la salida. Con el
// foco en la terminal, las teclas NO llegan a los atajos globales de MK
// (Ctrl+W en el shell borra una palabra, no cierra la pestaña del editor),
// salvo unos pocos de la lista GLOBAL_KEYS.

const panel = document.getElementById('terminal-panel');
const body = document.getElementById('terminal-body');
const tabsEl = document.getElementById('terminal-tabs');
const resizer = document.getElementById('terminal-resizer');
const MIN_HEIGHT = 100;

const sessions = []; // { id, term, fit, el, title, exited }
let activeId = null;
let creating = null;

function isToggleKey(e) {
  return (e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'Backquote' || e.key === 'ñ' || e.key === 'Ñ');
}

// Atajos de MK que siguen funcionando aunque el foco esté en la terminal.
function isGlobalKey(e) {
  if (isToggleKey(e) || e.key === 'F11' || e.key === 'F5') return true;
  const ctrl = e.ctrlKey || e.metaKey;
  return ctrl && e.shiftKey && ['p', 'h'].includes(e.key.toLowerCase());
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function withAlpha(color, alphaHex) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color + alphaHex : color;
}

// Paletas ANSI (las de VS Code): la de xterm por defecto está pensada para
// fondo negro, y en temas claros el amarillo/verde/blanco casi no se leían.
const ANSI_DARK = {
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
  brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5'
};
const ANSI_LIGHT = {
  black: '#000000', red: '#cd3131', green: '#107c10', yellow: '#8a6d00', blue: '#0451a5', magenta: '#bc05bc', cyan: '#0e7490', white: '#555555',
  brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14801a', brightYellow: '#946b00', brightBlue: '#0451a5', brightMagenta: '#bc05bc', brightCyan: '#0e7490', brightWhite: '#333333'
};

// Luminancia relativa (0 = negro, 1 = blanco) de un color CSS #rgb/#rrggbb/rgb().
function luminance(color) {
  let r;
  let g;
  let b;
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const rgb = color.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) {
    [r, g, b] = rgb.slice(1, 4).map(Number);
  } else {
    return 0;
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function currentTheme() {
  const accent = cssVar('--accent', '#3b82f6');
  const bg = cssVar('--bg', '#ffffff');
  const palette = luminance(bg) > 0.5 ? ANSI_LIGHT : ANSI_DARK;
  return {
    ...palette,
    background: bg,
    foreground: cssVar('--text', '#1f2937'),
    cursor: accent,
    cursorAccent: bg,
    selectionBackground: withAlpha(accent, '55')
  };
}

function activeSession() {
  return sessions.find((s) => s.id === activeId) || null;
}

function fitActive() {
  const s = activeSession();
  if (!s || panel.hidden) return;
  try {
    s.fit.fit();
  } catch (e) {
    return;
  }
  if (!s.exited) window.mdEditor.terminal.resize(s.id, s.term.cols, s.term.rows);
}

function renderTabs() {
  tabsEl.innerHTML = '';
  sessions.forEach((s, idx) => {
    const tab = document.createElement('div');
    tab.className = 'terminal-tab' + (s.id === activeId ? ' terminal-tab-active' : '');
    tab.title = `${s.cwd}\nDoble clic en el nombre: renombrar`;
    const label = document.createElement('span');
    label.className = 'terminal-tab-label';
    label.textContent = `${idx + 1}: ${s.title}${s.exited ? ' (terminada)' : ''}`;
    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      renameTab(s, label);
    });
    tab.appendChild(label);
    tab.addEventListener('click', () => activate(s.id));
    const close = document.createElement('span');
    close.className = 'terminal-tab-close';
    close.textContent = '×';
    close.title = 'Cerrar esta terminal';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSession(s.id);
    });
    tab.appendChild(close);
    tabsEl.appendChild(tab);
  });
}

// Renombrar una pestaña ("servidor", "git"...): el nombre queda para esa
// terminal mientras esté abierta. Vacío vuelve al nombre del shell.
function renameTab(session, label) {
  const input = document.createElement('input');
  input.className = 'terminal-tab-rename';
  input.value = session.title;
  label.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    if (commit) session.title = input.value.trim() || session.shellName;
    renderTabs();
    const s = activeSession();
    if (s) s.term.focus();
  };
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function activate(id) {
  activeId = id;
  sessions.forEach((s) => { s.el.hidden = s.id !== id; });
  renderTabs();
  const s = activeSession();
  if (s) {
    requestAnimationFrame(() => {
      fitActive();
      s.term.focus();
    });
  }
}

async function copySelection(term) {
  const text = term.getSelection();
  if (text) window.mdEditor.clipboardWriteText(text);
}

async function createSession(cwd) {
  if (typeof Terminal === 'undefined') {
    alert('No se pudo cargar xterm.js (node_modules/@xterm/xterm). Probá "npm install".');
    return null;
  }
  const el = document.createElement('div');
  el.className = 'terminal-instance';
  body.appendChild(el);

  const term = new Terminal({
    cursorBlink: true,
    // Primero variantes "Nerd Font": los prompts con íconos (powerlevel10k,
    // starship, oh-my-posh) usan glifos que las fuentes comunes no tienen.
    fontFamily: '"JetBrainsMono Nerd Font Mono", "FiraCode Nerd Font Mono", "MesloLGS NF", "Symbols Nerd Font Mono", "JetBrains Mono", "Fira Code", Consolas, monospace',
    fontSize: 13,
    scrollback: 5000,
    allowProposedApi: false,
    theme: currentTheme()
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  const search = new SearchAddon.SearchAddon();
  term.loadAddon(search);
  term.open(el);
  try {
    fit.fit();
  } catch (e) {
    // panel todavía sin tamaño: se ajusta en activate()
  }

  const result = await window.mdEditor.terminal.create({
    cwd: cwd || window.mdState.rootFolder || null,
    cols: term.cols,
    rows: term.rows
  });
  if (!result || result.error) {
    term.write(`\x1b[31m${(result && result.error) || 'No se pudo abrir la terminal.'}\x1b[0m\r\n`);
    const failed = { id: 'err' + Date.now(), term, fit, search, el, title: 'error', cwd: '', exited: true };
    sessions.push(failed);
    activate(failed.id);
    return failed;
  }

  const session = { id: result.id, term, fit, search, el, title: result.shell, shellName: result.shell, cwd: result.cwd, exited: false };
  term.onData((data) => {
    if (!session.exited) window.mdEditor.terminal.write(session.id, data);
  });
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'c') {
      copySelection(term);
      return false;
    }
    if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
      openSearch();
      return false;
    }
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'v') {
      window.mdEditor.clipboardReadText().then((text) => { if (text) term.paste(text); });
      return false;
    }
    // Atajos globales de MK: que xterm no los mande al shell.
    return !isGlobalKey(e);
  });
  sessions.push(session);
  activate(session.id);
  return session;
}

function closeSession(id) {
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const s = sessions[idx];
  if (!s.exited) window.mdEditor.terminal.kill(s.id);
  s.term.dispose();
  s.el.remove();
  sessions.splice(idx, 1);
  if (!sessions.length) {
    activeId = null;
    renderTabs(); // si no, la pestaña de la última terminal quedaba dibujada
    hide();
    return;
  }
  if (activeId === id) activate((sessions[idx] || sessions[idx - 1]).id);
  else renderTabs();
}

async function show() {
  panel.hidden = false;
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
  if (!sessions.length) {
    if (!creating) creating = createSession().finally(() => { creating = null; });
    await creating;
  } else {
    activate(activeId);
  }
}

function hide() {
  panel.hidden = true;
  if (window.mdCodeMirror) {
    window.mdCodeMirror.refresh();
    window.mdCodeMirror.focus();
  }
}

function toggle() {
  if (panel.hidden) show(); else hide();
}

// ---- buscar en la salida (Ctrl+F con el foco en la terminal) ----

const searchBar = document.getElementById('terminal-search');
const searchInput = document.getElementById('terminal-search-input');
const searchStatus = document.getElementById('terminal-search-status');

function runSearch(backwards) {
  const s = activeSession();
  const q = searchInput.value;
  if (!s || !q) {
    searchStatus.textContent = '';
    return;
  }
  const opts = { caseSensitive: false, incremental: !backwards };
  const found = backwards ? s.search.findPrevious(q, opts) : s.search.findNext(q, opts);
  searchStatus.textContent = found ? '' : 'Sin resultados';
}

function openSearch() {
  searchBar.hidden = false;
  const s = activeSession();
  const selected = s && s.term.getSelection();
  if (selected && !selected.includes('\n')) searchInput.value = selected;
  searchInput.focus();
  searchInput.select();
}

function closeSearch() {
  searchBar.hidden = true;
  searchStatus.textContent = '';
  const s = activeSession();
  if (s) {
    s.term.clearSelection();
    s.term.focus();
  }
}

searchInput.addEventListener('input', () => runSearch(false));
searchInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') {
    e.preventDefault();
    runSearch(e.shiftKey);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
  }
});
document.getElementById('terminal-search-prev').addEventListener('click', () => runSearch(true));
document.getElementById('terminal-search-next').addEventListener('click', () => runSearch(false));
document.getElementById('terminal-search-close').addEventListener('click', closeSearch);
document.getElementById('terminal-search-btn').addEventListener('click', openSearch);

async function newTerminal(cwd) {
  panel.hidden = false;
  return createSession(cwd);
}

// Comillas simples estilo POSIX: sirve igual en bash, zsh y fish.
function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// Escribe un comando en la terminal activa (o abre una) y lo ejecuta.
async function runCommand(command) {
  panel.hidden = false;
  let s = activeSession();
  if (!s || s.exited) s = sessions.find((x) => !x.exited) || await createSession();
  if (!s || s.exited) return;
  activate(s.id);
  window.mdEditor.terminal.write(s.id, command + '\r');
}

// Cómo correr cada tipo de archivo. {f} = archivo, {bin} = ejecutable temporal.
const RUNNERS = {
  py: 'python3 {f}',
  sh: 'bash {f}',
  bash: 'bash {f}',
  js: 'node {f}',
  mjs: 'node {f}',
  rb: 'ruby {f}',
  go: 'go run {f}',
  java: 'java {f}',
  c: 'gcc {f} -o {bin} && {bin}',
  cpp: 'g++ {f} -o {bin} && {bin}',
  cc: 'g++ {f} -o {bin} && {bin}',
  cxx: 'g++ {f} -o {bin} && {bin}'
};

function commandForFile(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const template = RUNNERS[ext];
  if (!template) return null;
  const dir = window.mdEditor.dirName(filePath);
  const base = filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const bin = `/tmp/mk-run-${base.replace(/[^\w.-]/g, '_')}`;
  return `cd ${shellQuote(dir)} && ` + template.replace(/\{f\}/g, shellQuote(filePath)).replace(/\{bin\}/g, shellQuote(bin));
}

// "▶ Ejecutar archivo" (F5): guarda y corre el archivo activo en la terminal.
async function runActiveFile() {
  const info = window.mdTabs && window.mdTabs.getActiveTabInfo();
  if (!info || !info.filePath) {
    alert('Guardá el archivo primero: para ejecutarlo necesita estar en disco.');
    return;
  }
  const command = commandForFile(info.filePath);
  if (!command) {
    alert(`No sé cómo ejecutar este tipo de archivo. Soportados: ${Object.keys(RUNNERS).map((e) => '.' + e).join(', ')}.`);
    return;
  }
  if (info.modified) await window.mdTabs.saveActive();
  await runCommand(command);
}

window.mdEditor.terminal.onData(({ id, data }) => {
  const s = sessions.find((x) => x.id === id);
  if (s) s.term.write(data);
});

window.mdEditor.terminal.onExit(({ id, exitCode }) => {
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  s.exited = true;
  s.term.write(`\r\n\x1b[2m[proceso terminado con código ${exitCode} — cerrá la pestaña con ×]\x1b[0m\r\n`);
  renderTabs();
});

// Con el foco dentro de la terminal, las teclas no siguen hasta los atajos
// globales de document (Ctrl+W, Ctrl+Tab, Ctrl+S, Escape...), salvo los de
// GLOBAL_KEYS.
body.addEventListener('keydown', (e) => {
  if (!isGlobalKey(e)) e.stopPropagation();
});

document.addEventListener('keydown', (e) => {
  if (isToggleKey(e)) {
    e.preventDefault();
    toggle();
  } else if (e.key === 'F5' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    runActiveFile();
  }
});

document.getElementById('terminal-new').addEventListener('click', () => newTerminal());
document.getElementById('terminal-hide').addEventListener('click', hide);
document.getElementById('btn-terminal').addEventListener('click', toggle);
document.getElementById('btn-run-file').addEventListener('click', runActiveFile);

// Alto del panel: arrastrar el borde de arriba. Se guarda en la config.
resizer.addEventListener('mousedown', (e) => {
  e.preventDefault();
  const startY = e.clientY;
  const startH = panel.getBoundingClientRect().height;
  resizer.classList.add('active');
  document.body.classList.add('resizing');
  const onMove = (ev) => {
    const max = window.innerHeight - 200;
    const h = Math.max(MIN_HEIGHT, Math.min(max, startH - (ev.clientY - startY)));
    panel.style.height = `${h}px`;
    fitActive();
  };
  const onUp = () => {
    resizer.classList.remove('active');
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (window.mdCodeMirror) window.mdCodeMirror.refresh();
    window.mdEditor.setConfig({ terminalHeight: Math.round(panel.getBoundingClientRect().height) });
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

new ResizeObserver(() => fitActive()).observe(body);

// Cambio de tema (data-theme o tema personalizado vía style inline): repintar.
new MutationObserver(() => {
  const theme = currentTheme();
  sessions.forEach((s) => { s.term.options.theme = theme; });
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });

(async () => {
  const config = await window.mdEditor.getConfig();
  if (config.terminalHeight) panel.style.height = `${config.terminalHeight}px`;
})();

window.mdTerminal = { show, hide, toggle, newTerminal, renameTab, runCommand, openSearch, runSearch, runActiveFile, commandForFile, getSessions: () => sessions.slice() };

})();
