const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'md-local',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
]);

let mainWindow;

const configPath = path.join(app.getPath('userData'), 'config.json');
const sessionPath = path.join(app.getPath('userData'), 'session.json');

// Filtrar por contenido (extensión + que exista) en vez de por posición del
// argumento: la posición cambia entre dev ("electron . archivo.md") y
// empaquetado ("MK archivo.md"), pero esto funciona igual en ambos casos.
function getFileArgFromArgv(argv) {
  return argv.find((arg) => /\.(md|markdown|tex)$/i.test(arg) && fs.existsSync(arg)) || null;
}

let pendingFilePath = getFileArgFromArgv(process.argv);

function sendOpenExternalFile(filePath) {
  if (mainWindow) mainWindow.webContents.send('open-external-file', filePath);
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const filePath = getFileArgFromArgv(argv);
    if (filePath) sendOpenExternalFile(filePath);
  });
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8');
}

function readTree(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      return {
        nombre: entry.name,
        esCarpeta: entry.isDirectory(),
        ruta: fullPath,
        hijos: entry.isDirectory() ? readTree(fullPath) : null
      };
    });
}

// Modo test (npm test / test/run.js): corre la suite en test/renderer-checks.js
// dentro de la propia ventana vía executeJavaScript y sale con código 0/1.
const isTestMode = process.env.MK_TEST === '1';
const testFixturesDir = process.env.MK_TEST_FIXTURES || '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const loadOptions = isTestMode ? { query: { mkTestFixtures: testFixturesDir } } : undefined;
  mainWindow.loadFile(path.join(__dirname, 'index.html'), loadOptions);
  buildMenu();

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
    const results = await mainWindow.webContents.executeJavaScript(code);
    console.log('MK_TEST_RESULTS_JSON:' + JSON.stringify(results));
    const failed = Array.isArray(results) ? results.filter((r) => !r.pass) : [{ name: 'harness', pass: false }];
    app.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.log('MK_TEST_RESULTS_JSON:' + JSON.stringify([{ name: 'harness', pass: false, detail: String((e && e.stack) || e) }]));
    app.exit(1);
  }
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nuevo', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:new') },
        { label: 'Abrir...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu:open') },
        { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save') },
        { label: 'Guardar como...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu:save-as') },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { role: 'reload', label: 'Recargar' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Markdown y LaTeX', extensions: ['md', 'markdown', 'txt', 'tex'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content };
});

ipcMain.handle('file:save', async (event, { content, filePath, forceDialog }) => {
  let target = filePath;
  if (!target || forceDialog) {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: target || undefined,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'LaTeX', extensions: ['tex'] }
      ]
    });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
  }
  fs.writeFileSync(target, content, 'utf-8');
  return target;
});

ipcMain.handle('file:read', (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('session:save', (event, data) => {
  try {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, JSON.stringify(data), 'utf-8');
  } catch (e) {
    // no romper la app si falla el guardado de sesión
  }
});

ipcMain.handle('session:load', () => {
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  } catch (e) {
    return null;
  }
});

ipcMain.handle('folder:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  const rootPath = result.filePaths[0];
  saveConfig({ ...loadConfig(), lastFolder: rootPath });
  return { rootPath, tree: readTree(rootPath) };
});

ipcMain.handle('folder:getLast', () => {
  const { lastFolder } = loadConfig();
  if (!lastFolder) return null;
  try {
    return { rootPath: lastFolder, tree: readTree(lastFolder) };
  } catch (e) {
    return null;
  }
});

ipcMain.handle('folder:read', (event, rootPath) => {
  try {
    return { rootPath, tree: readTree(rootPath) };
  } catch (e) {
    return null;
  }
});

// Nombre de archivo/carpeta nuevo: sin separadores de ruta ni ".."
// (evita que "Nuevo archivo" con un nombre tipo "../../fuera" escriba fuera
// de la carpeta indicada).
function isSafeEntryName(name) {
  return typeof name === 'string' && name.trim().length > 0 &&
    !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..';
}

ipcMain.handle('fs:createFile', (event, { dirPath, name }) => {
  if (!isSafeEntryName(name)) return { error: 'Nombre inválido.' };
  const target = path.join(dirPath, name.trim());
  if (fs.existsSync(target)) return { error: 'Ya existe un archivo o carpeta con ese nombre.' };
  try {
    fs.writeFileSync(target, '', 'utf-8');
    return { path: target };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('fs:createFolder', (event, { dirPath, name }) => {
  if (!isSafeEntryName(name)) return { error: 'Nombre inválido.' };
  const target = path.join(dirPath, name.trim());
  if (fs.existsSync(target)) return { error: 'Ya existe un archivo o carpeta con ese nombre.' };
  try {
    fs.mkdirSync(target);
    return { path: target };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('fs:rename', (event, { targetPath, newName }) => {
  if (!isSafeEntryName(newName)) return { error: 'Nombre inválido.' };
  const dest = path.join(path.dirname(targetPath), newName.trim());
  if (fs.existsSync(dest)) return { error: 'Ya existe un archivo o carpeta con ese nombre.' };
  try {
    fs.renameSync(targetPath, dest);
    return { path: dest };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('fs:delete', (event, { targetPath, isFolder }) => {
  try {
    fs.rmSync(targetPath, { recursive: !!isFolder, force: false });
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('config:get', () => loadConfig());

ipcMain.handle('config:set', (event, partial) => {
  const next = { ...loadConfig(), ...partial };
  saveConfig(next);
  return next;
});

ipcMain.handle('asset:copy', (event, { srcPath, targetDir }) => {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const ext = path.extname(srcPath);
    const base = path.basename(srcPath, ext);
    let destPath = path.join(targetDir, base + ext);
    let i = 1;
    while (fs.existsSync(destPath)) {
      destPath = path.join(targetDir, `${base}-${i++}${ext}`);
    }
    fs.copyFileSync(srcPath, destPath);
    return destPath;
  } catch (e) {
    return null;
  }
});

const SEARCH_TEXT_EXT = /\.(md|markdown|txt|tex)$/i;
const SEARCH_MAX_RESULTS = 200;

// Recorre los archivos "de texto" (md/markdown/txt/tex) de una carpeta,
// saltando ocultos, y llama onFile(fullPath, content) para cada uno.
// Compartido por búsqueda global, etiquetas y backlinks para no repetir el
// recorrido del árbol tres veces.
function walkTextFiles(root, onFile) {
  function walk(dirPath) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (SEARCH_TEXT_EXT.test(entry.name)) {
        let content;
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch (e) {
          continue;
        }
        onFile(fullPath, content);
      }
    }
  }
  walk(root);
}

ipcMain.handle('search:inFolder', (event, { root, query }) => {
  if (!root || !query || query.trim().length < 2) return [];
  const q = query.toLowerCase();
  const results = [];

  walkTextFiles(root, (fullPath, content) => {
    if (results.length >= SEARCH_MAX_RESULTS) return;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (results.length >= SEARCH_MAX_RESULTS) break;
      if (lines[i].toLowerCase().includes(q)) {
        results.push({
          filePath: fullPath,
          relPath: path.relative(root, fullPath),
          line: i + 1,
          snippet: lines[i].trim().slice(0, 160)
        });
      }
    }
  });

  return results;
});

// Deja afuera del escaneo de #tag / [[wikilink]] el contenido de bloques
// ```fence``` y `código inline` (blanquea los caracteres sin tocar los
// saltos de línea, así los números de línea de backlinks:list no se mueven).
function stripCodeForScan(text) {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]+`/g, (m) => m.replace(/[^\n]/g, ' '));
}

// Debe coincidir con el regex de preview.js (embedTagSyntax): #tag no
// precedido por otro "#" (para no confundir con encabezados "## Título").
const TAG_RE = /(^|[\s(])#([a-zA-Z][\w-]*)/g;

ipcMain.handle('tags:list', (event, root) => {
  if (!root) return [];
  const counts = new Map();
  walkTextFiles(root, (fullPath, content) => {
    const scanText = stripCodeForScan(content);
    TAG_RE.lastIndex = 0;
    let m;
    while ((m = TAG_RE.exec(scanText))) {
      const tag = m[2].toLowerCase();
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
});

ipcMain.handle('wikilink:resolve', (event, { root, target }) => {
  if (!root || !target) return null;
  const wanted = target.trim().toLowerCase();
  let found = null;
  function walk(dirPath) {
    if (found) return;
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      if (found) return;
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (SEARCH_TEXT_EXT.test(entry.name)) {
        const base = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
        if (base === wanted) {
          found = fullPath;
          return;
        }
      }
    }
  }
  walk(root);
  return found;
});

const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;

ipcMain.handle('backlinks:list', (event, { root, target }) => {
  if (!root || !target) return [];
  const wanted = target.trim().toLowerCase();
  const results = [];
  walkTextFiles(root, (fullPath, content) => {
    const originalLines = content.split('\n');
    const scanLines = stripCodeForScan(content).split('\n');
    scanLines.forEach((line, i) => {
      WIKILINK_RE.lastIndex = 0;
      let m;
      while ((m = WIKILINK_RE.exec(line))) {
        if (m[1].trim().toLowerCase() === wanted) {
          results.push({
            filePath: fullPath,
            relPath: path.relative(root, fullPath),
            line: i + 1,
            snippet: (originalLines[i] || '').trim().slice(0, 160)
          });
        }
      }
    });
  });
  return results;
});

ipcMain.handle('export:html', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'documento.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, html, 'utf-8');
  return result.filePath;
});

ipcMain.handle('export:pdf', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'documento.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const tmpPath = path.join(os.tmpdir(), `mk-export-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html, 'utf-8');
  const pdfWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
  try {
    await pdfWindow.loadFile(tmpPath);
    const buffer = await pdfWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(result.filePath, buffer);
  } finally {
    pdfWindow.destroy();
    fs.unlinkSync(tmpPath);
  }
  return result.filePath;
});

app.whenReady().then(() => {
  protocol.handle('md-local', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    return net.fetch('file://' + filePath);
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
