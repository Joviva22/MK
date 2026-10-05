// Bandeja del sistema + "iniciar con el sistema", lado main-process. Sirve
// para que los recordatorios (home.js, en el renderer) sigan sonando con la
// ventana cerrada: cerrar la ventana la OCULTA (MK queda en la bandeja) en
// vez de salir, salvo que el usuario lo desactive en Ajustes. Para salir de
// verdad: "Salir" en el menú de la bandeja o Ctrl+Q.
//
// Iniciar con el sistema (Linux): archivo ~/.config/autostart/mk-editor.desktop
// que lanza MK con --hidden (arranca directo en la bandeja, sin ventana).
// app.setLoginItemSettings de Electron solo funciona en macOS/Windows.
'use strict';

const { app, Tray, Menu, Notification, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AUTOSTART_FILE = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart', 'mk-editor.desktop');

let tray = null;
let quitting = false;

function isStartHidden(argv) {
  return argv.includes('--hidden');
}

function showWindow(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Qué ejecutar al iniciar sesión: el AppImage si corre empaquetado, o el
// lanzador de desarrollo (bin/mk-editor) si corre desde el repo.
// Si está instalado con `npm run install-desktop`, siempre ese AppImage (no
// depende de la carpeta del proyecto).
const INSTALLED_APPIMAGE = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'mk', 'MK.AppImage');

function launchCommand() {
  if (process.env.APPIMAGE) return process.env.APPIMAGE;
  if (fs.existsSync(INSTALLED_APPIMAGE)) return INSTALLED_APPIMAGE;
  if (app.isPackaged) return process.execPath;
  return path.join(__dirname, '..', 'bin', 'mk-editor');
}

function isAutostartEnabled() {
  return fs.existsSync(AUTOSTART_FILE);
}

function setAutostart(enabled, iconPath) {
  if (!enabled) {
    fs.rmSync(AUTOSTART_FILE, { force: true });
    return false;
  }
  fs.mkdirSync(path.dirname(AUTOSTART_FILE), { recursive: true });
  const exec = launchCommand().replace(/(["\\`$])/g, '\\$1');
  fs.writeFileSync(AUTOSTART_FILE, [
    '[Desktop Entry]',
    'Type=Application',
    'Name=MK',
    'Comment=MK en la bandeja: recordatorios del Home y bases de datos',
    // --no-sandbox solo hace falta si es un AppImage (ver scripts/install-desktop.js).
    `Exec="${exec}"${/\.AppImage$/i.test(exec) ? ' --no-sandbox' : ''} --hidden`,
    `Icon=${iconPath}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n'), 'utf-8');
  return true;
}

function setupTray({ getWindow, iconPath, ipcMain, isTestMode }) {
  app.on('before-quit', () => { quitting = true; });

  ipcMain.handle('app:quit', () => {
    quitting = true;
    app.quit();
  });
  ipcMain.handle('app:getAutostart', () => isAutostartEnabled());
  ipcMain.handle('app:setAutostart', (event, enabled) => setAutostart(!!enabled, iconPath));

  // En los tests la ventana se cierra con app.exit(): nada de bandeja.
  if (isTestMode) return;

  try {
    const image = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
    tray = new Tray(image);
    tray.setToolTip('MK — los recordatorios siguen activos');
    const send = (channel) => {
      const win = getWindow();
      showWindow(win);
      if (win && !win.isDestroyed()) win.webContents.send(channel);
    };
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Abrir MK', click: () => showWindow(getWindow()) },
      { label: 'Home (planificador)', click: () => send('tray:openHome') },
      { type: 'separator' },
      { label: 'Salir de MK', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', () => showWindow(getWindow()));
  } catch {
    tray = null; // escritorio sin bandeja: igual se puede volver abriendo MK de nuevo
  }
}

// Llamar al crear la ventana: intercepta el cierre para ocultarla.
function attachWindow(win, { loadConfig, saveConfig, isTestMode }) {
  if (isTestMode) return;
  // Capturarlo antes del renderer: editores, terminales y diálogos pueden
  // detener keydown y evitar que llegue al listener de settings.js.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) ||
        input.shift || input.alt || String(input.key).toLowerCase() !== 'q') return;
    event.preventDefault();
    quitting = true;
    app.quit();
  });
  win.on('close', (event) => {
    if (quitting) return;
    const config = loadConfig();
    if (config.keepInTray === false) return;
    event.preventDefault();
    win.hide();
    if (!config.trayNoticeShown) {
      saveConfig({ ...config, trayNoticeShown: true });
      try {
        new Notification({
          title: 'MK sigue abierto en la bandeja',
          body: 'Así tus recordatorios siguen sonando. Para salir: menú de la bandeja → Salir, o Ctrl+Q. Se puede cambiar en Ajustes.'
        }).show();
      } catch {
        // sin servidor de notificaciones: no pasa nada
      }
    }
  });
}

module.exports = { setupTray, attachWindow, showWindow, isStartHidden };
