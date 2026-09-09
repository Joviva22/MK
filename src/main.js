const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

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
  // Sin barra de menú nativa (Archivo/Editar/Ver): la toolbar de la app ya
  // cubre esas acciones, y sus atajos (Ctrl+N/O/S/Shift+S) están registrados
  // aparte en el renderer (editor.js), no dependen de accelerators de menú.
  Menu.setApplicationMenu(null);

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

ipcMain.handle('window:toggleFullscreen', () => {
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

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

// Historial local de versiones: antes de pisar un archivo, guarda una copia
// del contenido previo bajo userData/backups/<hash de la ruta>/. Así un
// autoguardado con contenido no deseado no borra el trabajo anterior sin
// dejar rastro. Se guardan como mucho las últimas MAX_BACKUPS_PER_FILE.
const backupsRoot = path.join(app.getPath('userData'), 'backups');
const MAX_BACKUPS_PER_FILE = 20;

function backupDirFor(filePath) {
  return path.join(backupsRoot, crypto.createHash('md5').update(filePath).digest('hex'));
}

function makeBackup(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const dir = backupDirFor(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(filePath, path.join(dir, `${stamp}__${path.basename(filePath)}`));
    const entries = fs.readdirSync(dir).sort();
    while (entries.length > MAX_BACKUPS_PER_FILE) {
      fs.unlinkSync(path.join(dir, entries.shift()));
    }
  } catch (e) {
    // un backup fallido no debe impedir guardar el archivo real
  }
}

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
  makeBackup(target);
  fs.writeFileSync(target, content, 'utf-8');
  return target;
});

ipcMain.handle('backups:list', (event, filePath) => {
  if (!filePath) return [];
  const dir = backupDirFor(filePath);
  try {
    return fs.readdirSync(dir)
      .sort()
      .reverse()
      .map((name) => {
        const backupPath = path.join(dir, name);
        return { path: backupPath, mtime: fs.statSync(backupPath).mtimeMs };
      });
  } catch (e) {
    return [];
  }
});

ipcMain.handle('backups:read', (event, backupPath) => {
  const rel = path.relative(backupsRoot, backupPath || '');
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null; // solo lee de backupsRoot
  try {
    return fs.readFileSync(backupPath, 'utf-8');
  } catch (e) {
    return null;
  }
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

// true si child es igual a parent o está adentro de parent (para no
// permitir mover una carpeta dentro de sí misma o de un hijo suyo).
function isInside(parent, child) {
  if (parent === child) return true;
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

ipcMain.handle('fs:move', (event, { sourcePath, destDir }) => {
  if (isInside(sourcePath, destDir)) {
    return { error: 'No se puede mover una carpeta dentro de sí misma.' };
  }
  const dest = path.join(destDir, path.basename(sourcePath));
  if (dest === sourcePath) return { path: sourcePath };
  if (fs.existsSync(dest)) return { error: 'Ya existe un archivo o carpeta con ese nombre ahí.' };
  try {
    fs.renameSync(sourcePath, dest);
    return { path: dest };
  } catch (e) {
    return { error: e.message };
  }
});

// Manda a la papelera del sistema (shell.trashItem) en vez de borrar directo
// con fs.rmSync — así "Eliminar" desde el sidebar se puede deshacer.
ipcMain.handle('fs:delete', async (event, { targetPath, isFolder }) => {
  try {
    await shell.trashItem(targetPath);
    return { ok: true };
  } catch (e) {
    // La papelera del sistema puede fallar (sin gio/kioclient/trash-cli, o
    // moviendo entre distintos sistemas de archivos/puntos de montaje) —
    // en ese caso, borrar directo en vez de dejar la operación a medias.
    try {
      fs.rmSync(targetPath, { recursive: !!isFolder, force: false });
      return { ok: true };
    } catch (e2) {
      return { error: e2.message };
    }
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
