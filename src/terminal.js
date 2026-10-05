(function () {
'use strict';

// Terminal integrada (panel inferior, estilo VS Code). Cada pestaña es un
// xterm.js (dibujo) conectado por IPC a un pseudo-terminal real en el
// main-process (src/ptyhost.js). Arranca en la carpeta abierta.
//
// Atajos: Ctrl+` (o Ctrl+Ñ en teclado español) muestra/oculta el panel;
// F5 guarda y ejecuta el archivo activo (.py, .sh, .js, .c, .cpp, .java...);
// Ctrl+Shift+C / Ctrl+Shift+V copian/pegan dentro de la terminal; Ctrl+F
// busca en la salida; Ctrl+Shift+5 (o ◫) divide la pestaña en paneles lado
// a lado (hasta 4 por pestaña: cada panel es su propio shell). Con el
// foco en la terminal, las teclas NO llegan a los atajos globales de MK
// (Ctrl+W en el shell borra una palabra, no cierra la pestaña del editor),
// salvo unos pocos de la lista GLOBAL_KEYS.

const panel = document.getElementById('terminal-panel');
const body = document.getElementById('terminal-body');
const tabsEl = document.getElementById('terminal-tabs');
const resizer = document.getElementById('terminal-resizer');
const MIN_HEIGHT = 100;

const sessions = []; // { id, term, fit, el, title, exited, group }
let activeId = null;
let creating = null;

// Pantalla dividida: cada pestaña es un "grupo" con 1 a MAX_SPLIT paneles
// lado a lado. groups: id -> contenedor .terminal-group en #terminal-body.
const MAX_SPLIT = 4;
const groups = new Map();
let nextGroupId = 1;

function groupSessions(groupId) {
  return sessions.filter((s) => s.group === groupId);
}

// Grupos en el orden en que aparecen las pestañas (el de su primer panel).
function groupOrder() {
  const order = [];
  sessions.forEach((s) => { if (!order.includes(s.group)) order.push(s.group); });
  return order;
}

function newGroup() {
  const id = nextGroupId++;
  const el = document.createElement('div');
  el.className = 'terminal-group';
  body.appendChild(el);
  groups.set(id, el);
  return id;
}

function isSplitKey(e) {
  return (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.code === 'Digit5' || e.key === '%');
}

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
    green: cssVar('--syntax-string', palette.green),
    yellow: cssVar('--syntax-number', palette.yellow),
    blue: accent,
    magenta: cssVar('--syntax-keyword', palette.magenta),
    cyan: cssVar('--syntax-type', palette.cyan),
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

// Ajusta todos los paneles de la pestaña visible (en una división, cambiar
// el ancho de uno cambia el de los demás).
function fitActive() {
  const active = activeSession();
  if (!active || panel.hidden) return;
  groupSessions(active.group).forEach((s) => {
    try {
      s.fit.fit();
    } catch {
      return;
    }
    if (!s.exited) window.mdEditor.terminal.resize(s.id, s.term.cols, s.term.rows);
  });
}

function renderTabs() {
  tabsEl.innerHTML = '';
  const active = activeSession();
  groupOrder().forEach((groupId, idx) => {
    const members = groupSessions(groupId);
    // El panel con foco dentro del grupo (o el primero): es el que se
    // renombra y el que se enfoca al volver a la pestaña.
    const s = members.find((m) => m.id === activeId) || members.find((m) => m.id === groups.get(groupId).lastFocused) || members[0];
    const tab = document.createElement('div');
    tab.className = 'terminal-tab' + (active && active.group === groupId ? ' terminal-tab-active' : '');
    tab.title = `${s.cwd}\nDoble clic en el nombre: renombrar` + (members.length > 1 ? ' (el panel con foco)' : '');
    const label = document.createElement('span');
    label.className = 'terminal-tab-label';
    label.textContent = `${idx + 1}: ` + members.map((m) => `${m.title}${m.exited ? ' (terminada)' : ''}`).join(' │ ');
    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      renameTab(s, label);
    });
    tab.appendChild(label);
    tab.addEventListener('click', () => activate(s.id));
    const close = document.createElement('button');
    close.type = 'button';
    close.tabIndex = -1;
    close.className = 'terminal-tab-close';
    close.title = members.length > 1 ? `Cerrar esta pestaña (${members.length} paneles)` : 'Cerrar esta terminal';
    window.mdIcons.button(close, 'x');
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      members.forEach((m) => closeSession(m.id));
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
  const s0 = activeSession();
  groups.forEach((el, groupId) => {
    el.hidden = !s0 || s0.group !== groupId;
    el.classList.toggle('terminal-group-split', groupSessions(groupId).length > 1);
  });
  if (s0) groups.get(s0.group).lastFocused = id;
  sessions.forEach((s) => s.el.classList.toggle('terminal-instance-focused', s.id === id));
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

// ---- elegir shell (bash, zsh, fish...) ----
// La lista la arma el proceso principal (ptyhost.js: /etc/shells + PATH) y
// solo acepta uno de ella. '' = el del sistema ($SHELL).
let shellsCache = null;
let preferredShell = '';

async function listShells() {
  if (!shellsCache) shellsCache = await window.mdEditor.terminal.listShells();
  return shellsCache;
}

// opts.split: agrega el panel al lado del activo, en la misma pestaña.
// opts.shell: ruta del shell (si no, el elegido en Ajustes).
async function createSession(cwd, opts) {
  try {
    await window.mdLoadLib('xterm'); // se carga recién al abrir la primera terminal
  } catch {
    // abajo se avisa
  }
  if (typeof Terminal === 'undefined') {
    alert('No se pudo cargar xterm.js (node_modules/@xterm/xterm). Probá "npm install".');
    return null;
  }
  const current = activeSession();
  const group = opts && opts.split && current ? current.group : newGroup();
  const el = document.createElement('div');
  el.className = 'terminal-instance';
  groups.get(group).appendChild(el);
  // Visible ya (antes de medir), así el primer fit() tiene el ancho real.
  groups.forEach((g, id) => { g.hidden = id !== group; });
  groups.get(group).classList.toggle('terminal-group-split', groupSessions(group).length > 0);
  const paneClose = document.createElement('button');
  paneClose.className = 'terminal-pane-close';
  paneClose.title = 'Cerrar este panel';
  window.mdIcons.button(paneClose, 'x');
  el.appendChild(paneClose);

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
  } catch {
    // panel todavía sin tamaño: se ajusta en activate()
  }

  const result = await window.mdEditor.terminal.create({
    cwd: cwd || window.mdState.rootFolder || null,
    cols: term.cols,
    rows: term.rows,
    shell: (opts && opts.shell) || preferredShell
  });
  if (!result || result.error) {
    term.write(`\x1b[31m${(result && result.error) || 'No se pudo abrir la terminal.'}\x1b[0m\r\n`);
    const failed = { id: 'err' + Date.now(), term, fit, search, el, title: 'error', cwd: '', exited: true, group };
    paneClose.addEventListener('click', () => closeSession(failed.id));
    sessions.push(failed);
    activate(failed.id);
    return failed;
  }

  const session = { id: result.id, term, fit, search, el, title: result.shell, shellName: result.shell, shellPath: result.shellPath, cwd: result.cwd, exited: false, group };
  paneClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSession(session.id);
  });
  // Clic en otro panel de la división: pasa a ser el activo.
  el.addEventListener('focusin', () => {
    if (activeId === session.id) return;
    activeId = session.id;
    groups.get(group).lastFocused = session.id;
    sessions.forEach((x) => x.el.classList.toggle('terminal-instance-focused', x.id === session.id));
    renderTabs();
  });
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
    if (isSplitKey(e)) {
      splitTerminal();
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
  const siblings = groupSessions(s.group);
  if (!siblings.length) {
    groups.get(s.group).remove();
    groups.delete(s.group);
  }
  if (!sessions.length) {
    activeId = null;
    renderTabs(); // si no, la pestaña de la última terminal quedaba dibujada
    hide();
    return;
  }
  // Se cerró el activo: primero otro panel de la misma pestaña, si no la
  // pestaña vecina.
  if (activeId === id) activate((siblings[0] || sessions[idx] || sessions[idx - 1]).id);
  else activate(activeId); // la división cambió: reajustar anchos
}

// Divide la pestaña activa: un shell nuevo al lado (en la carpeta del
// activo). Sin terminal abierta, abre una normal.
async function splitTerminal() {
  const current = activeSession();
  if (!current) return newTerminal();
  if (groupSessions(current.group).length >= MAX_SPLIT) {
    alert(`Como mucho ${MAX_SPLIT} paneles por pestaña: abrí otra pestaña con +.`);
    return null;
  }
  panel.hidden = false;
  return createSession(current.cwd || null, { split: true, shell: current.shellPath });
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
  if (document.fullscreenElement === panel) document.exitFullscreen();
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

async function newTerminal(cwd, shell) {
  panel.hidden = false;
  return createSession(cwd, shell ? { shell } : undefined);
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
  cxx: 'g++ {f} -o {bin} && {bin}',
  zsh: 'zsh {f}',
  fish: 'fish {f}',
  ts: 'npx --yes tsx {f}',
  mts: 'npx --yes tsx {f}',
  rs: 'rustc {f} -o {bin} && {bin}',
  php: 'php {f}',
  pl: 'perl {f}',
  lua: 'lua {f}',
  r: 'Rscript {f}',
  jl: 'julia {f}',
  hs: 'runghc {f}',
  dart: 'dart run {f}',
  swift: 'swift {f}',
  kt: 'kotlinc {f} -include-runtime -d {bin}.jar && java -jar {bin}.jar',
  ps1: 'pwsh -File {f}',
  sql: 'sqlite3 :memory: < {f}',
  html: 'xdg-open {f}',
  htm: 'xdg-open {f}'
};

// Qué programa hace falta para cada tipo (para el aviso si no está).
const RUNNER_PROGRAMS = { ts: 'Node.js (npx)', mts: 'Node.js (npx)', rs: 'rustc', kt: 'kotlinc y Java', hs: 'GHC (runghc)', sql: 'sqlite3', r: 'R (Rscript)', ps1: 'PowerShell (pwsh)' };

function commandForFile(filePath) {
  const baseName = filePath.split(/[\\/]/).pop();
  // Makefile / GNUmakefile: make en su carpeta.
  if (/^(GNU)?makefile$/i.test(baseName)) return `cd ${shellQuote(window.mdEditor.dirName(filePath))} && make`;
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
    alert(`No sé cómo ejecutar este tipo de archivo. Soportados: ${Object.keys(RUNNERS).map((e) => '.' + e).join(', ')} y Makefile.`);
    return;
  }
  if (info.modified) await window.mdTabs.saveActive();
  await runCommand(command);
}

// ---- Abrir con IA (Claude Code, Gemini CLI, Codex) ----
// Abre una pestaña de terminal en la carpeta del archivo con la IA ya
// arrancada y el archivo como contexto. Son los programas de terminal del
// usuario, con sus cuentas y su configuración: MK solo escribe el comando.

const AI_TOOLS = [
  { id: 'claude', label: 'Claude Code', bin: 'claude', mention: (name) => `@${name}` },
  { id: 'gemini', label: 'Gemini CLI', bin: 'gemini', flag: '-i', mention: (name) => `@${name}` },
  { id: 'codex', label: 'Codex', bin: 'codex', mention: (name) => `el archivo ${name}` }
];

// Comando a escribir en la terminal. isFolder: la IA arranca en la carpeta,
// sin prompt; si no, con un prompt corto que le presenta el archivo.
function aiCommand(toolId, targetPath, isFolder) {
  const tool = AI_TOOLS.find((t) => t.id === toolId);
  if (!tool) return null;
  const dir = isFolder ? targetPath : window.mdEditor.dirName(targetPath);
  let cmd = `cd ${shellQuote(dir)} && ${tool.bin}`;
  if (!isFolder) {
    const name = targetPath.split(/[\\/]/).pop();
    const prompt = `Vamos a trabajar con ${tool.mention(name)} (está en esta carpeta). Leelo y esperá mis instrucciones.`;
    cmd += `${tool.flag ? ' ' + tool.flag : ''} ${shellQuote(prompt)}`;
  }
  return cmd;
}

// opts.dryRun (tests): abre la pestaña pero no ejecuta nada.
async function openWithAI(toolId, targetPath, opts) {
  const tool = AI_TOOLS.find((t) => t.id === toolId);
  const isFolder = !!(opts && opts.isFolder);
  if (!tool || !targetPath) return null;
  // Si es el archivo abierto y tiene cambios, guardarlo antes: la IA lee el disco.
  const info = window.mdTabs && window.mdTabs.getActiveTabInfo();
  if (!isFolder && info && info.filePath === targetPath && info.modified) await window.mdTabs.saveActive();
  const command = aiCommand(toolId, targetPath, isFolder);
  const session = await newTerminal(isFolder ? targetPath : window.mdEditor.dirName(targetPath));
  if (!session || session.exited) return command;
  session.title = tool.label;
  renderTabs();
  if (!(opts && opts.dryRun)) window.mdEditor.terminal.write(session.id, command + '\r');
  return command;
}

// Botón "IA ▾" de la toolbar: sobre el archivo abierto.
async function openActiveWithAI(toolId) {
  const info = window.mdTabs && window.mdTabs.getActiveTabInfo();
  if (!info || !info.filePath) {
    const root = window.mdState.rootFolder;
    if (root) return openWithAI(toolId, root, { isFolder: true });
    alert('Guardá el archivo (o abrí una carpeta) para abrir la IA sobre él.');
    return null;
  }
  return openWithAI(toolId, info.filePath);
}

window.initDropdown('btn-ai', 'ai-menu');
document.querySelectorAll('#ai-menu button[data-ai]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('ai-menu').hidden = true;
    openActiveWithAI(btn.dataset.ai);
  });
});

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
  } else if (isSplitKey(e) && !panel.hidden) {
    e.preventDefault();
    splitTerminal();
  } else if (e.key === 'F5' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    runActiveFile();
  }
});

document.getElementById('terminal-new').addEventListener('click', () => newTerminal());

// Menú ▾ junto al +: abrir una terminal con otro shell sin cambiar el
// predeterminado. Y el selector de ⚙ Ajustes elige el predeterminado.
const shellMenu = document.getElementById('terminal-shell-menu');
const shellSelect = document.getElementById('terminal-shell-select');

async function fillShellMenu() {
  const { shells, defaultName } = await listShells();
  shellMenu.innerHTML = '';
  shells.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = s.name + (s.name === defaultName ? ' (del sistema)' : '') + (s.path === preferredShell ? ' ✓' : '');
    b.title = s.path;
    b.addEventListener('click', () => {
      shellMenu.hidden = true;
      newTerminal(null, s.path);
    });
    shellMenu.appendChild(b);
  });
}

window.initDropdown('terminal-new-menu', 'terminal-shell-menu');
document.getElementById('terminal-new-menu').addEventListener('click', fillShellMenu);

(async () => {
  const config = await window.mdEditor.getConfig();
  preferredShell = typeof config.terminalShell === 'string' ? config.terminalShell : '';
  if (!shellSelect) return;
  const { shells, defaultName } = await listShells();
  shellSelect.innerHTML = '';
  const def = document.createElement('option');
  def.value = '';
  def.textContent = `Del sistema (${defaultName})`;
  shellSelect.appendChild(def);
  shells.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.path;
    o.textContent = s.name;
    shellSelect.appendChild(o);
  });
  // Si el guardado ya no está instalado, vuelve al del sistema.
  if (preferredShell && !shells.some((s) => s.path === preferredShell)) preferredShell = '';
  shellSelect.value = preferredShell;
  shellSelect.addEventListener('change', () => {
    preferredShell = shellSelect.value;
    window.mdEditor.setConfig({ terminalShell: preferredShell });
  });
})();
document.getElementById('terminal-split').addEventListener('click', () => splitTerminal());
document.getElementById('terminal-hide').addEventListener('click', hide);
document.getElementById('btn-terminal').addEventListener('click', toggle);
document.getElementById('btn-run-file').addEventListener('click', runActiveFile);

// Pantalla completa conserva el tamaño del panel al volver (Escape o botón).
const fullscreenButton = document.getElementById('terminal-fullscreen');
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === panel) await document.exitFullscreen();
    else await panel.requestFullscreen();
  } catch {
    window.mdErrorToast.show({ message: 'No se pudo abrir la terminal en pantalla completa.' });
  }
}
fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const full = document.fullscreenElement === panel;
  const label = full ? 'Salir de pantalla completa (Escape)' : 'Terminal en pantalla completa';
  fullscreenButton.title = label;
  fullscreenButton.setAttribute('aria-label', label);
  fullscreenButton.setAttribute('aria-pressed', String(full));
  window.mdIcons.button(fullscreenButton, full ? 'minimize' : 'maximize');
  requestAnimationFrame(() => {
    fitActive();
    if (activeSession() && !panel.hidden) activeSession().term.focus();
    if (window.mdCodeMirror) window.mdCodeMirror.refresh();
  });
});

// Captura del puntero: el arrastre continúa al pasar sobre el editor o PDF.
function maxPanelHeight() { return Math.max(MIN_HEIGHT, window.innerHeight - 120); }
function setPanelHeight(height) {
  const value = Math.max(MIN_HEIGHT, Math.min(maxPanelHeight(), height));
  panel.style.height = `${value}px`;
  resizer.setAttribute('aria-valuemin', String(MIN_HEIGHT));
  resizer.setAttribute('aria-valuemax', String(maxPanelHeight()));
  resizer.setAttribute('aria-valuenow', String(Math.round(value)));
}
function savePanelHeight() {
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
  window.mdEditor.setConfig({ terminalHeight: Math.round(panel.getBoundingClientRect().height) });
}
let drag = null;
resizer.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || drag || document.fullscreenElement === panel) return;
  e.preventDefault();
  resizer.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, y: e.clientY, height: panel.getBoundingClientRect().height };
  resizer.classList.add('active');
  document.body.classList.add('terminal-resizing');
});
resizer.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  setPanelHeight(drag.height + drag.y - e.clientY);
});
function finishResize(e) {
  if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
  const id = drag.id;
  drag = null;
  if (resizer.hasPointerCapture(id)) resizer.releasePointerCapture(id);
  resizer.classList.remove('active');
  document.body.classList.remove('terminal-resizing');
  savePanelHeight();
}
resizer.addEventListener('pointerup', finishResize);
resizer.addEventListener('pointercancel', finishResize);
resizer.addEventListener('lostpointercapture', finishResize);
window.addEventListener('blur', finishResize);
resizer.addEventListener('keydown', (e) => {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const height = panel.getBoundingClientRect().height;
  const step = e.shiftKey ? 50 : 20;
  setPanelHeight(e.key === 'Home' ? MIN_HEIGHT : e.key === 'End' ? maxPanelHeight() : height + (e.key === 'ArrowUp' ? step : -step));
  savePanelHeight();
});
window.addEventListener('resize', () => {
  if (document.fullscreenElement !== panel) setPanelHeight(parseFloat(panel.style.height) || 260);
});

new ResizeObserver(() => fitActive()).observe(body);

// Cambio de tema (data-theme o tema personalizado vía style inline): repintar.
new MutationObserver(() => {
  const theme = currentTheme();
  sessions.forEach((s) => { s.term.options.theme = theme; });
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });

(async () => {
  const config = await window.mdEditor.getConfig();
  setPanelHeight(Number(config.terminalHeight) || 260);
})();

window.mdTerminal = { shellQuote, RUNNERS, RUNNER_PROGRAMS, AI_TOOLS, aiCommand, openWithAI, openActiveWithAI, show, hide, toggle, newTerminal, splitTerminal, listShells, getPreferredShell: () => preferredShell, renameTab, runCommand, openSearch, runSearch, runActiveFile, commandForFile, getSessions: () => sessions.slice() };

})();
