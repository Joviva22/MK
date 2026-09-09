const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const JSZip = require('jszip');
const { execFile } = require('child_process');

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
  return argv.find((arg) => /\.(md|markdown|tex|docx)$/i.test(arg) && fs.existsSync(arg)) || null;
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
    const results = await mainWindow.webContents.executeJavaScript(code);
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

ipcMain.handle('window:toggleFullscreen', () => {
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

// Solo http(s)/mailto — nunca abrir esquemas arbitrarios (file:, md-local:,
// etc.) que un .md ajeno podría meter en un link.
ipcMain.handle('shell:openExternal', (event, url) => {
  if (typeof url === 'string' && /^https?:|^mailto:/i.test(url)) {
    // En modo test no se abre un navegador/cliente de mail real.
    if (!isTestMode) shell.openExternal(url);
  }
});

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Markdown y LaTeX', extensions: ['md', 'markdown', 'txt', 'tex'] },
      { name: 'Word', extensions: ['docx'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Historial local de versiones: antes de pisar un archivo, guarda una copia
// del contenido previo bajo userData/backups/<hash de la ruta>/. Así un
// autoguardado con contenido no deseado no borra el trabajo anterior sin
// dejar rastro. Se guardan como mucho las últimas MAX_BACKUPS_PER_FILE por
// archivo, y aparte hay un tope de espacio total (MAX_TOTAL_BACKUPS_BYTES)
// que poda los backups más viejos de TODOS los archivos si se pasa — antes
// solo existía el límite por archivo, así que un proyecto con muchos
// archivos grandes podía acumular espacio sin límite real en userData.
const backupsRoot = path.join(app.getPath('userData'), 'backups');
const MAX_BACKUPS_PER_FILE = 20;
// Overridable por test/run.js (MK_TEST_MAX_BACKUP_BYTES) para poder probar
// la poda real sin tener que escribir 200 MB de backups en la suite.
const MAX_TOTAL_BACKUPS_BYTES = Number(process.env.MK_TEST_MAX_BACKUP_BYTES) || 200 * 1024 * 1024; // 200 MB

function backupDirFor(filePath) {
  return path.join(backupsRoot, crypto.createHash('md5').update(filePath).digest('hex'));
}

function pruneGlobalBackups() {
  try {
    const entries = [];
    for (const dirName of fs.readdirSync(backupsRoot)) {
      const dirPath = path.join(backupsRoot, dirName);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      for (const fileName of fs.readdirSync(dirPath)) {
        const filePath = path.join(dirPath, fileName);
        const stat = fs.statSync(filePath);
        entries.push({ filePath, size: stat.size, mtime: stat.mtimeMs });
      }
    }
    let total = entries.reduce((sum, e) => sum + e.size, 0);
    if (total <= MAX_TOTAL_BACKUPS_BYTES) return;
    entries.sort((a, b) => a.mtime - b.mtime); // más viejo primero, sin importar de qué archivo es
    for (const e of entries) {
      if (total <= MAX_TOTAL_BACKUPS_BYTES) break;
      fs.unlinkSync(e.filePath);
      total -= e.size;
    }
  } catch (e) {
    // una poda fallida no debe impedir guardar el archivo real
  }
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
    pruneGlobalBackups();
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

// Antes esto decodificaba cualquier archivo como utf-8 a ciegas: abrir un
// binario (imagen sin pasar por el visor, un .zip, etc.) generaba una
// "línea" de miles de caracteres basura que colgaba a CodeMirror al
// renderizarla. Ahora se olfatea si el contenido es binario (heurística
// estándar: byte NUL en los primeros bytes, la misma que usa git) antes de
// devolverlo como texto.
function looksBinary(buffer) {
  const sample = buffer.subarray(0, 8000);
  return sample.includes(0);
}

ipcMain.handle('file:read', (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    if (looksBinary(buffer)) return { content: null, binary: true };
    return { content: buffer.toString('utf-8'), binary: false };
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

// Tablero Kanban en modo "carpeta completa" (ver kanban.js): junta el
// contenido crudo de todos los archivos de texto para que el renderer arme
// las columnas con el mismo parseColumns que ya usa en modo archivo activo
// — la lógica de "## Columna" + lista queda en un solo lugar.
ipcMain.handle('kanban:readFolderFiles', (event, root) => {
  if (!root) return [];
  const files = [];
  walkTextFiles(root, (fullPath, content) => {
    files.push({ path: fullPath, content });
  });
  return files;
});

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

// Nodos = archivos de texto de la carpeta; aristas = wikilinks resueltos
// entre ellos (mismo criterio que wikilink:resolve, por nombre de archivo).
ipcMain.handle('graph:build', (event, root) => {
  if (!root) return { nodes: [], edges: [] };

  const files = [];
  walkTextFiles(root, (fullPath, content) => {
    files.push({ path: fullPath, name: path.basename(fullPath, path.extname(fullPath)), content });
  });

  const byNameLower = new Map(files.map((f) => [f.name.toLowerCase(), f]));
  const edgeKeys = new Set();
  const edges = [];

  files.forEach((f) => {
    const scanText = stripCodeForScan(f.content);
    WIKILINK_RE.lastIndex = 0;
    let m;
    while ((m = WIKILINK_RE.exec(scanText))) {
      const target = byNameLower.get(m[1].trim().toLowerCase());
      if (!target || target.name === f.name) continue;
      const key = `${f.name}->${target.name}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ source: f.name, target: target.name });
    }
  });

  return {
    nodes: files.map((f) => ({ id: f.name, path: f.path })),
    edges
  };
});

// Herramientas de PDF (unir/separar/rotar/reordenar/marca de agua/firma y
// subrayado): la lógica de edición corre en el renderer con pdf-lib (no
// necesita Node), acá solo se resuelven diálogos nativos y lectura/escritura
// de bytes — igual separación que el resto de exportadores de este archivo.
ipcMain.handle('pdf:pickFiles', async (event, { multi }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: multi ? ['openFile', 'multiSelections'] : ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths;
});

ipcMain.handle('pdf:readBytes', (event, filePath) => {
  try {
    return fs.readFileSync(filePath).toString('base64');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('pdf:saveBytes', async (event, { base64, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'documento.pdf', [{ name: 'PDF', extensions: ['pdf'] }]);
  if (!targetPath) return null;
  fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
  return targetPath;
});

// Abrir .docx (ver docximport.js): mammoth+turndown corren en el renderer,
// acá solo se leen los bytes crudos, igual separación que pdf:readBytes.
ipcMain.handle('docx:readBytes', (event, filePath) => {
  try {
    return fs.readFileSync(filePath).toString('base64');
  } catch (e) {
    return null;
  }
});

// Genérico, para leer los bytes de cualquier archivo local (usado por
// docxexport.js para embeber imágenes locales al exportar a .docx) — la
// restricción de ruta (no salir de la carpeta abierta) la valida el
// renderer antes de llamar esto, igual que con las imágenes normales.
ipcMain.handle('asset:readBytes', (event, filePath) => {
  try {
    return fs.readFileSync(filePath).toString('base64');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('export:docx', async (event, { base64, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'documento.docx', [{ name: 'Word', extensions: ['docx'] }]);
  if (!targetPath) return null;
  fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
  return targetPath;
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

// data:image/... -> <img>/<br>/<hr>/<embed>/<link>/<meta>/<input> sin cerrar
// (marked/DOMPurify no producen XHTML estricto) se cierran solos para que
// el .xhtml del EPUB sea válido.
function toXhtmlVoidElements(html) {
  return html.replace(/<(img|br|hr|input|meta|link|embed)\b([^>]*?)\/?>/gi, (match, tag, attrs) => `<${tag}${attrs}/>`);
}

// En modo test evita el diálogo nativo (bloquearía la suite esperando un
// clic que nunca llega) y escribe directo a un archivo temporal.
async function resolveSavePath(defaultName, filters) {
  if (isTestMode) {
    return path.join(os.tmpdir(), `mk-test-export-${Date.now()}-${defaultName}`);
  }
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName, filters });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

ipcMain.handle('export:epub', async (event, { html, title, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'documento.epub', [{ name: 'EPUB', extensions: ['epub'] }]);
  if (!targetPath) return null;

  const safeTitle = (title || 'Documento').replace(/[<>&]/g, '');
  const uid = 'urn:uuid:' + crypto.randomUUID();
  const xhtmlBody = toXhtmlVoidElements(html);

  const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8" /><title>${safeTitle}</title></head>
<body>
${xhtmlBody}
</body>
</html>`;

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${safeTitle}</dc:title>
    <dc:language>es</dc:language>
    <dc:identifier id="BookId">${uid}</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1"/>
  </spine>
</package>`;

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uid}"/></head>
  <docTitle><text>${safeTitle}</text></docTitle>
  <navMap>
    <navPoint id="chapter1" playOrder="1">
      <navLabel><text>${safeTitle}</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.folder('META-INF').file('container.xml', containerXml);
  const oebps = zip.folder('OEBPS');
  oebps.file('content.opf', contentOpf);
  oebps.file('toc.ncx', tocNcx);
  oebps.file('chapter1.xhtml', chapterXhtml);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(targetPath, buffer);
  return targetPath;
});

ipcMain.handle('export:anki', async (event, { cards, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'tarjetas.txt', [{ name: 'Texto (importable en Anki)', extensions: ['txt'] }]);
  if (!targetPath) return null;
  // Formato de importación simple de Anki: una tarjeta por línea, campos
  // separados por tabulador (Frente\tDorso). Ver Archivo > Importar en Anki.
  const lines = cards.map(({ front, back }) =>
    `${front.replace(/\t/g, ' ')}\t${back.replace(/\t/g, ' ').replace(/\n/g, '<br>')}`
  );
  fs.writeFileSync(targetPath, lines.join('\n'), 'utf-8');
  return targetPath;
});

// Sincronización con git al guardar (opt-in, ver settings.js): solo actúa
// si la carpeta ya es un repo git existente — nunca corre "git init" por
// cuenta propia. Nada bloqueante ni ruidoso: si no hay nada para commitear,
// no es un error.
function runGit(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

ipcMain.handle('git:isRepo', async (event, root) => {
  const { error } = await runGit(['rev-parse', '--is-inside-work-tree'], root);
  return !error;
});

ipcMain.handle('git:sync', async (event, root) => {
  const check = await runGit(['rev-parse', '--is-inside-work-tree'], root);
  if (check.error) return { ok: false, reason: 'not-a-repo' };
  await runGit(['add', '-A'], root);
  const commit = await runGit(['commit', '-m', 'MK: guardado automático'], root);
  if (commit.error) return { ok: false, reason: 'nothing-to-commit' };
  return { ok: true };
});

// Control fino aparte del sync automático de arriba: lista qué cambió
// (git status --porcelain) para elegir a mano qué archivos entran en el
// commit y escribir el mensaje — ver gitpanel.js.
ipcMain.handle('git:status', async (event, root) => {
  const result = await runGit(['status', '--porcelain'], root);
  if (result.error) return null;
  return result.stdout.split('\n').filter(Boolean).map((line) => ({
    status: line.slice(0, 2),
    file: line.slice(3)
  }));
});

ipcMain.handle('git:commitSelected', async (event, { root, files, message }) => {
  if (!files || !files.length) return { ok: false, reason: 'no-files' };
  if (!message || !message.trim()) return { ok: false, reason: 'no-message' };
  const add = await runGit(['add', '--', ...files], root);
  if (add.error) return { ok: false, reason: 'add-failed' };
  const commit = await runGit(['commit', '-m', message], root);
  if (commit.error) return { ok: false, reason: 'commit-failed' };
  return { ok: true };
});

// Control del reproductor multimedia del sistema vía playerctl (D-Bus/MPRIS,
// solo Linux) — mismo patrón execFile que git arriba. playerctl no viene
// con MK (hay que instalarlo aparte); si no está, o si no hay ningún player
// con soporte MPRIS corriendo, se devuelve un error legible en vez de
// romper — ver mediaplayer.js, que le muestra el motivo al usuario.
function runPlayerctl(args) {
  return new Promise((resolve) => {
    execFile('playerctl', args, (error, stdout) => {
      if (error) {
        resolve({ ok: false, reason: error.code === 'ENOENT' ? 'not-installed' : 'no-player', detail: error.message });
      } else {
        resolve({ ok: true, output: stdout.trim() });
      }
    });
  });
}

ipcMain.handle('media:playPause', () => runPlayerctl(['play-pause']));
ipcMain.handle('media:next', () => runPlayerctl(['next']));
ipcMain.handle('media:previous', () => runPlayerctl(['previous']));

ipcMain.handle('media:status', async () => {
  const status = await runPlayerctl(['status']);
  if (!status.ok) return status;
  const meta = await runPlayerctl(['metadata', '--format', '{{ artist }} - {{ title }}']);
  return { ok: true, status: status.output, title: meta.ok ? meta.output : '' };
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
