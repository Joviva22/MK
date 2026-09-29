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

// En la suite de tests (MK_TEST=1): bash sin configuración del usuario, para
// que un prompt/asistente del shell (ej. el de Powerlevel10k) no se coma los
// comandos que escribe el test.
function shellCommand() {
  if (process.env.MK_TEST === '1' && process.platform !== 'win32') return ['/bin/bash', ['--norc', '--noprofile']];
  return [defaultShell(), []];
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
  } catch (e) {
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

  ipcMain.handle('term:create', (event, { cwd, cols, rows }) => {
    if (!fromMainFrame(event)) return { error: 'No permitido.' };
    const lib = loadPty();
    if (!lib) return { error: `No se pudo cargar node-pty (${ptyLoadError}). Probá "npm install" de nuevo.` };
    const [shell, shellArgs] = shellCommand();
    let dir = os.homedir();
    try {
      if (cwd && fs.statSync(cwd).isDirectory()) dir = cwd;
    } catch (e) {
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
    return { id, shell: path.basename(shell), cwd: dir };
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
    } catch (e) {
      // el proceso pudo haber terminado entre medio
    }
  });

  ipcMain.handle('term:kill', (event, { id }) => {
    if (!fromMainFrame(event)) return;
    killTerm(id);
  });
}

module.exports = { registerTerminalIpc, killAllTerminals: killAll };
