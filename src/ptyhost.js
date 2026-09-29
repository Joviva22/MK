// Terminal integrada, lado main-process: cada terminal del panel (ver
// src/terminal.js) es un pseudo-terminal real (node-pty) corriendo el shell
// del usuario ($SHELL), así funcionan programas interactivos (vim, htop, git
// con paginador, colores) igual que en cualquier emulador de terminal.
//
// node-pty es nativo, pero usa N-API (node-addon-api): el binario compilado
// sirve para cualquier versión de Electron sin recompilar — distinto del
// problema de ABI que tuvo better-sqlite3 (ver dbengine.js). Se carga recién
// al abrir la primera terminal, así un fallo al cargarlo no rompe la app.
//
// Seguridad: el shell y sus argumentos los decide este módulo, nunca el
// renderer, y solo el frame principal de la ventana puede abrir/escribir
// terminales (no un iframe del preview).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let ptyLib = null;
let ptyLoadError = '';
const terms = new Map(); // id -> { proc, sender, buffer, flushTimer }
let nextId = 1;

function loadPty() {
  if (ptyLib === null) {
    try {
      ptyLib = require('node-pty');
    } catch (e) {
      ptyLib = false;
      ptyLoadError = e.message;
    }
  }
  return ptyLib;
}

function defaultShell() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'powershell.exe';
  return process.env.SHELL || '/bin/bash';
}

// Shells instalados que se pueden elegir (⚙ Ajustes o el menú ▾ del panel):
// los de /etc/shells más los conocidos que estén en el PATH, sin los que no
// son para uso interactivo. El renderer solo puede pedir uno de esta lista.
const EXTRA_SHELLS = ['bash', 'zsh', 'fish', 'nu', 'pwsh', 'xonsh', 'elvish', 'dash', 'ksh', 'tcsh', 'sh'];
const NOT_INTERACTIVE = new Set(['git-shell', 'rbash', 'systemd-home-fallback-shell', 'nologin', 'false']);

function isExecutable(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() && (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function listShells() {
  if (process.platform === 'win32') return [{ path: defaultShell(), name: path.basename(defaultShell()) }];
  const candidates = [];
  try {
    fs.readFileSync('/etc/shells', 'utf-8').split('\n').forEach((line) => {
      const p = line.trim();
      if (p && !p.startsWith('#')) candidates.push(p);
    });
  } catch {
    // sin /etc/shells: queda lo del PATH
  }
  const dirs = (process.env.PATH || '').split(':').filter(Boolean);
  EXTRA_SHELLS.forEach((name) => {
    const dir = dirs.find((d) => isExecutable(path.join(d, name)));
    if (dir) candidates.push(path.join(dir, name));
  });
  const byName = new Map();
  candidates.forEach((p) => {
    const name = path.basename(p);
    if (NOT_INTERACTIVE.has(name) || byName.has(name) || !isExecutable(p)) return;
    byName.set(name, p);
  });
  const def = defaultShell();
  if (!byName.has(path.basename(def)) && isExecutable(def)) byName.set(path.basename(def), def);
  return Array.from(byName, ([name, p]) => ({ name, path: p })).sort((a, b) => a.name.localeCompare(b.name));
}

// requested: ruta pedida por el renderer (vacía = $SHELL). Solo se acepta si
// está en listShells(); si no, el predeterminado.
// En la suite de tests (MK_TEST=1): bash sin configuración del usuario, para
// que un prompt/asistente del shell (ej. el de Powerlevel10k) no se coma los
// comandos que escribe el test (otro shell pedido a propósito sí se respeta).
function shellCommand(requested) {
  const allowed = requested && listShells().find((s) => s.path === requested);
  if (process.env.MK_TEST === '1' && process.platform !== 'win32' && (!allowed || allowed.name === 'bash')) {
    return ['/bin/bash', ['--norc', '--noprofile']];
  }
  return [allowed ? allowed.path : defaultShell(), []];
}

// Agrupa la salida en tandas de ~8 ms: un comando que escupe mucho texto
// (un `cat` grande, un build) manda miles de trozos chicos, y un mensaje IPC
// por trozo trabaría el renderer.
function queueData(id, data) {
  const t = terms.get(id);
  if (!t) return;
  t.buffer += data;
  if (t.flushTimer) return;
  t.flushTimer = setTimeout(() => {
    t.flushTimer = null;
    if (!t.buffer || t.sender.isDestroyed()) return;
    t.sender.send('term:data', { id, data: t.buffer });
    t.buffer = '';
  }, 8);
}

function killTerm(id) {
  const t = terms.get(id);
  if (!t) return;
  terms.delete(id);
  clearTimeout(t.flushTimer);
  try {
    t.proc.kill();
  } catch {
    // ya había terminado
  }
}

function killAll() {
  Array.from(terms.keys()).forEach(killTerm);
}

function registerTerminalIpc(ipcMain, getMainWindow) {
  const fromMainFrame = (event) => {
    const win = getMainWindow();
    return !!win && !win.isDestroyed() && event.senderFrame === win.webContents.mainFrame;
  };

  ipcMain.handle('term:listShells', () => ({ shells: listShells(), defaultName: path.basename(defaultShell()) }));

  ipcMain.handle('term:create', (event, { cwd, cols, rows, shell: requestedShell }) => {
    if (!fromMainFrame(event)) return { error: 'No permitido.' };
    const lib = loadPty();
    if (!lib) return { error: `No se pudo cargar node-pty (${ptyLoadError}). Probá "npm install" de nuevo.` };
    const [shell, shellArgs] = shellCommand(typeof requestedShell === 'string' ? requestedShell : '');
    let dir = os.homedir();
    try {
      if (cwd && fs.statSync(cwd).isDirectory()) dir = cwd;
    } catch {
      // carpeta inexistente: se usa home
    }
    let proc;
    try {
      proc = lib.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: Math.max(2, cols | 0) || 80,
        rows: Math.max(2, rows | 0) || 24,
        cwd: dir,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'MK' }
      });
    } catch (e) {
      return { error: `No se pudo abrir ${shell}: ${e.message}` };
    }
    const id = nextId++;
    terms.set(id, { proc, sender: event.sender, buffer: '', flushTimer: null });
    proc.onData((data) => queueData(id, data));
    proc.onExit(({ exitCode }) => {
      const t = terms.get(id);
      if (!t) return;
      clearTimeout(t.flushTimer);
      if (!t.sender.isDestroyed()) {
        if (t.buffer) t.sender.send('term:data', { id, data: t.buffer });
        t.sender.send('term:exit', { id, exitCode });
      }
      terms.delete(id);
    });
    return { id, shell: path.basename(shell), shellPath: shell, cwd: dir };
  });

  ipcMain.on('term:write', (event, { id, data }) => {
    if (!fromMainFrame(event)) return;
    const t = terms.get(id);
    if (t && typeof data === 'string') t.proc.write(data);
  });

  ipcMain.on('term:resize', (event, { id, cols, rows }) => {
    if (!fromMainFrame(event)) return;
    const t = terms.get(id);
    if (!t || !(cols > 1) || !(rows > 1)) return;
    try {
      t.proc.resize(cols | 0, rows | 0);
    } catch {
      // el proceso pudo haber terminado entre medio
    }
  });

  ipcMain.handle('term:kill', (event, { id }) => {
    if (!fromMainFrame(event)) return;
    killTerm(id);
  });
}

module.exports = { registerTerminalIpc, killAllTerminals: killAll };
