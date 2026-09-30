const { app, BrowserWindow, Menu, ipcMain, protocol, net, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Readable } = require('stream');
const { registerDatabaseIpc } = require('./dbengine');
const { registerTerminalIpc, killAllTerminals } = require('./ptyhost');
const trayMode = require('./traymode');
const ctx = require('./mainctx');
const errlog = require('./errlog');
const guard = require('./pathguard');

const APP_ICON = path.join(__dirname, '..', 'build', 'icon.png');
// Nombre visible "MK" (notificaciones, etc.). OJO: setName también cambia
// la carpeta de datos por defecto (~/.config/MK); los datos de siempre
// (tareas del Home, ajustes, sesión, backups) están en md-editor-local, así
// que se fija explícitamente — salvo que se pase --user-data-dir (tests).
app.setName('MK');
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'md-editor-local'));
}
// Identidad de la ventana para el escritorio (Linux): tiene que coincidir con
// mk-editor.desktop (StartupWMClass=mk-editor) para que la barra de tareas
// agrupe y fije MK, y no lo tome por "Electron". desktopName de package.json
// ya lo hace; esto lo deja explícito también para X11 (WM_CLASS).
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'mk-editor');
  app.setDesktopName('mk-editor.desktop');
}
// --hidden (lo usa "Iniciar con el sistema"): arrancar directo en la bandeja.
const startHidden = trayMode.isStartHidden(process.argv);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'md-local',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
]);

let mainWindow;

errlog.init(app.getPath('userData'));
ctx.logError = errlog.logError;
// Error que el usuario tiene que saber (no se guardó algo): al log y un
// aviso en la ventana (errortoast.js), sin repetir el mismo en 30 s.
const lastReported = new Map();
ctx.reportError = (where, err, userMessage) => {
  errlog.logError(where, err);
  const now = Date.now();
  if (now - (lastReported.get(userMessage) || 0) < 30000) return;
  lastReported.set(userMessage, now);
  const win = ctx.mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:error', { message: userMessage, detail: String((err && err.message) || err || ''), logFile: errlog.logFile() });
  }
};
const configPath = path.join(app.getPath('userData'), 'config.json');
const sessionPath = path.join(app.getPath('userData'), 'session.json');
const homePath = path.join(app.getPath('userData'), 'home.json');

// Filtrar por contenido (extensión + que exista) en vez de por posición del
// argumento: la posición cambia entre dev ("electron . archivo.md") y
// empaquetado ("MK archivo.md"), pero esto funciona igual en ambos casos.
function getFileArgFromArgv(argv) {
  return argv.find((arg) => /\.(md|markdown|tex|docx)$/i.test(arg) && fs.existsSync(arg)) || null;
}

let pendingFilePath = getFileArgFromArgv(process.argv);

function sendOpenExternalFile(filePath) {
  guard.grantFile(filePath); // lo pidió el usuario (argumento / "Abrir con")
  if (mainWindow) mainWindow.webContents.send('open-external-file', filePath);
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    if (!mainWindow) return;
    // Puede estar oculta en la bandeja: volver a mostrarla.
    trayMode.showWindow(mainWindow);
    const filePath = getFileArgFromArgv(argv);
    if (filePath) sendOpenExternalFile(filePath);
  });
}

// Config, sesión y Home: lectura que aparta un JSON dañado (en vez de que
// el próximo guardado lo pise con {}) y escritura atómica (ver errlog.js).
function loadConfig() {
  const config = errlog.readJsonSafe(configPath, {});
  return config && typeof config === 'object' ? config : {};
}

function saveConfig(config) {
  errlog.writeJsonAtomic(configPath, config);
}

ctx.loadConfig = loadConfig;
ctx.saveConfig = saveConfig;


// Modo test (npm test / test/run.js): corre la suite en test/renderer-checks.js
// dentro de la propia ventana vía executeJavaScript y sale con código 0/1.
const isTestMode = ctx.isTestMode;
const testFixturesDir = process.env.MK_TEST_FIXTURES || '';
guard.setOnDenied((what, p) => errlog.logError('ruta-no-autorizada', `${what}: ${p}`));
// Tests: los fixtures y los temporales cuentan como abiertos por el usuario.
if (isTestMode) {
  if (testFixturesDir) guard.grantDir(testFixturesDir);
  guard.grantDir(os.tmpdir());
}

function createWindow() {
  mainWindow = ctx.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !startHidden,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Sandbox de Chromium: el preload solo puede usar módulos de Electron
      // (las rutas y el resaltado de código se resolvieron sin Node).
      sandbox: true,
      // Oculta en la bandeja, Chromium frena los timers de la página: los
      // recordatorios (setInterval de home.js) sonarían tarde.
      backgroundThrottling: false
    }
  });
  trayMode.attachWindow(mainWindow, { loadConfig, saveConfig, isTestMode });

  const loadOptions = isTestMode ? { query: { mkTestFixtures: testFixturesDir } } : undefined;
  mainWindow.loadFile(path.join(__dirname, 'index.html'), loadOptions);
  // Terminales integradas (ptyhost.js): si la página se recarga o la ventana
  // se cierra, sus shells quedarían huérfanos sin nadie que los lea.
  mainWindow.webContents.on('did-navigate', killAllTerminals);
  mainWindow.on('closed', killAllTerminals);
  // Sin barra de menú nativa (Archivo/Editar/Ver): la toolbar de la app ya
  // cubre esas acciones, y sus atajos (Ctrl+N/O/S/Shift+S) están registrados
  // aparte en el renderer (editor.js), no dependen de accelerators de menú.
  Menu.setApplicationMenu(null);

  // Red de seguridad a nivel ventana: un link (http/mailto/etc.) clicado en
  // el preview antes navegaba la propia ventana de la app fuera de
  // index.html, dejándola en blanco. preview.js ya intercepta los clics,
  // pero esto cubre cualquier otro intento de navegación (target="_blank",
  // programático, etc.) mandándolo siempre al navegador del sistema.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === mainWindow.webContents.getURL()) return;
    event.preventDefault();
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // El menú propio del editor (contextmenu.js) reemplaza al menú nativo de
  // Chromium, pero este evento se dispara igual en el proceso principal en
  // cada clic derecho — es la única forma de obtener las sugerencias del
  // corrector ortográfico nativo (misspelledWord/dictionarySuggestions).
  // Se lo mandamos al renderer para que arme sus propios botones con esto.
  mainWindow.webContents.on('context-menu', (event, params) => {
    if (!params.misspelledWord) return;
    mainWindow.webContents.send('spellcheck:suggestions', {
      misspelledWord: params.misspelledWord,
      dictionarySuggestions: params.dictionarySuggestions
    });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFilePath) {
      sendOpenExternalFile(pendingFilePath);
      pendingFilePath = null;
    }
    if (isTestMode) runTests();
  });
}

async function runTests() {
  try {
    const checksPath = path.join(__dirname, '..', 'test', 'renderer-checks.js');
    const code = fs.readFileSync(checksPath, 'utf-8');
    // Si la suite revienta, executeJavaScript pierde el stack: capturarlo
    // adentro de la ventana para saber en qué línea fue.
    const wrapped = `Promise.resolve().then(() => ${code.trim().replace(/;\s*$/, '')}\n).catch((e) => [{ name: 'harness', pass: false, detail: String((e && e.stack) || e) }])`;
    const results = await mainWindow.webContents.executeJavaScript(wrapped);
    console.log('MK_TEST_RESULTS_JSON:' + JSON.stringify(results));
    const failed = Array.isArray(results) ? results.filter((r) => !r.pass) : [{ name: 'harness', pass: false }];
    app.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.log('MK_TEST_RESULTS_JSON:' + JSON.stringify([{ name: 'harness', pass: false, detail: String((e && e.stack) || e) }]));
    app.exit(1);
  }
}

ipcMain.handle('spellcheck:addWord', (event, word) => {
  if (typeof word === 'string' && word) mainWindow.webContents.session.addWordToSpellCheckerDictionary(word);
});

ipcMain.handle('clipboard:writeText', (event, text) => clipboard.writeText(String(text == null ? '' : text)));
ipcMain.handle('clipboard:readText', () => clipboard.readText());

// Traer la ventana al frente (clic en la notificación de un recordatorio).
ipcMain.handle('window:focus', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.handle('window:toggleFullscreen', () => {
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

// Solo http(s)/mailto — nunca abrir esquemas arbitrarios (file:, md-local:,
// etc.) que un .md ajeno podría meter en un link.
// "Abrir con la aplicación del sistema" (formatos que MK no muestra, o el
// usuario lo prefiere): solo archivos existentes; nunca ejecutables.
ipcMain.handle('shell:openPath', async (event, filePath) => {
  if (typeof filePath !== 'string' || isTestMode || !guard.check(filePath, 'shell:openPath')) return;
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile() || (st.mode & 0o111) !== 0) return; // no abrir binarios ejecutables
  } catch {
    return;
  }
  await shell.openPath(filePath);
});

ipcMain.handle('shell:openExternal', (event, url) => {
  if (typeof url === 'string' && /^https?:|^mailto:/i.test(url)) {
    // En modo test no se abre un navegador/cliente de mail real.
    if (!isTestMode) shell.openExternal(url);
  }
});

ipcMain.handle('session:save', (event, data) => {
  try {
    errlog.writeJsonAtomic(sessionPath, data);
  } catch (e) {
    errlog.logError('session:save', e); // no romper la app por la sesión
  }
});

// Home (ver home.js): tareas/objetivos personales, independientes de la
// carpeta abierta — por eso van en userData y no en <root>/.mk.
// root = null → la configuración de la app; root = carpeta → <carpeta>/.mk/home.json
// (opción "Guardar el Home en la carpeta abierta", viaja con git/backups).
function homeFileFor(root) {
  return root ? path.join(root, '.mk', 'home.json') : homePath;
}

ipcMain.handle('home:load', (event, root) => {
  if (root && !guard.check(root, 'home:load')) return null;
  return errlog.readJsonSafe(homeFileFor(root), null);
});

ipcMain.handle('home:save', (event, data, root) => {
  if (root && !guard.check(root, 'home:save')) return false;
  const file = homeFileFor(root);
  try {
    // Atómico: si se corta a mitad (apagón, cierre forzado) no queda un
    // home.json roto con todas las tareas.
    errlog.writeJsonAtomic(file, data);
    return true;
  } catch (e) {
    ctx.reportError('home:save', e, 'No se pudieron guardar las tareas del Home.');
    return false;
  }
});

// Las pestañas de la sesión anterior se vuelven a abrir: sus archivos
// cuentan como abiertos por el usuario.
ipcMain.handle('session:load', () => {
  const data = errlog.readJsonSafe(sessionPath, null);
  if (data && Array.isArray(data.tabs)) data.tabs.forEach((t) => { if (t && t.filePath) guard.grantFile(t.filePath); });
  return data;
});

// Archivo arrastrado desde el sistema (preload: getPathForFile solo da una
// ruta para un File real de un drop/selector, no se puede inventar desde la
// página). Síncrono para que la lectura que sigue ya esté autorizada.
ipcMain.on('pathguard:dropped', (event, filePath) => {
  if (typeof filePath === 'string' && filePath) guard.grantFile(filePath);
  event.returnValue = true;
});

// Errores del renderer que valen la pena (ver window.mdLogError en preload).
ipcMain.handle('log:error', (event, where, message) => errlog.logError(`renderer:${String(where).slice(0, 80)}`, String(message).slice(0, 4000)));

ipcMain.handle('config:get', () => loadConfig());

ipcMain.handle('config:set', (event, partial) => {
  const next = { ...loadConfig(), ...partial };
  saveConfig(next);
  return next;
});

// El resto del IPC, por tema (cada módulo registra sus ipcMain.handle al
// cargarse; van acá, después de fijar userData, porque ipc-files.js lo usa
// para la carpeta de backups).
require('./ipc-files'); // abrir/guardar, historial, árbol, vigilancia e índice, crear/mover/borrar
require('./ipc-notes'); // búsqueda, etiquetas, wikilinks, backlinks, grafo, Kanban de carpeta
require('./ipc-export'); // CSV, PDF, docx, HTML, EPUB, Anki
require('./ipc-system'); // git y reproductor del sistema (playerctl)
require('./ipc-mail'); // recordatorios por correo (Gmail)
require('./ipc-pet'); // imágenes propias de la mascota
registerDatabaseIpc(ipcMain, (root) => guard.check(root, 'db'), (channel, e) => ctx.reportError(channel, e, 'Error en la base de datos: el último cambio pudo no guardarse.'));
registerTerminalIpc(ipcMain, () => mainWindow);

const MEDIA_MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime', ogv: 'video/ogg',
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  m4a: 'audio/mp4', aac: 'audio/aac', weba: 'audio/webm'
};

function serveRange(filePath, rangeHeader) {
  let size;
  try {
    size = fs.statSync(filePath).size;
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; } // "bytes=-500": los últimos 500
  end = Math.min(end, size - 1);
  if (!(start <= end) || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end }));
  return new Response(stream, {
    status: 206,
    headers: {
      'Content-Type': MEDIA_MIME[ext] || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('md-local', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    // Solo archivos de lo que el usuario abrió (ver pathguard.js): antes un
    // .md podía pedir cualquier archivo del disco con md-local://.
    if (!guard.check(filePath, 'md-local')) return new Response('No autorizado', { status: 403 });
    // Video y audio piden el archivo "por rangos" (Range: bytes=…) para
    // poder adelantar/retroceder sin leerlo entero; net.fetch(file://) no
    // los respetaba, y en archivos largos no se podía saltar a otra parte.
    const range = request.headers.get('range');
    if (range) return serveRange(filePath, range);
    return net.fetch('file://' + filePath);
  });
  createWindow();
  trayMode.setupTray({ getWindow: () => mainWindow, iconPath: APP_ICON, ipcMain, isTestMode });
});

app.on('window-all-closed', () => {
  killAllTerminals();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
