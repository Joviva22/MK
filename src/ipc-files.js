'use strict';

// IPC de archivos: abrir/guardar (con historial local de versiones), leer,
// árbol de la carpeta, vigilancia (folderwatch.js) e índice (folderindex.js),
// crear/renombrar/mover/borrar y copiar assets.
// Se carga desde main.js (require) después de fijar userData; lo compartido
// con main.js (ventana, config, modo test) está en mainctx.js.

const { app, dialog, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const os = require('os');
const ctx = require('./mainctx');
const guard = require('./pathguard');
const { createFolderWatcher } = require('./folderwatch');
const { createFolderIndex } = require('./folderindex');

// Asíncrono (fs.promises) y con las subcarpetas en paralelo: con miles de
// archivos, la versión ...Sync congelaba toda la ventana mientras leía.
// Una subcarpeta ilegible (permisos) queda vacía en vez de romper el árbol.
async function readTree(dirPath, isRoot = true) {
  let entries;
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch (e) {
    if (isRoot) throw e;
    return [];
  }
  const visible = entries
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  return Promise.all(visible.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);
    return {
      nombre: entry.name,
      esCarpeta: entry.isDirectory(),
      ruta: fullPath,
      hijos: entry.isDirectory() ? await readTree(fullPath, false) : null
    };
  }));
}

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(ctx.mainWindow, {
    filters: [
      { name: 'Markdown y LaTeX', extensions: ['md', 'markdown', 'txt', 'tex'] },
      { name: 'Word', extensions: ['docx'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  guard.grantFile(result.filePaths[0]); // elegido por el usuario
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

// Recorre TODOS los backups (un stat por archivo): se hace en segundo plano
// y como mucho una vez por minuto, no en cada autoguardado.
const PRUNE_EVERY_MS = 60 * 1000;
let lastPrune = 0;
let pruning = false;

async function pruneGlobalBackups() {
  if (pruning || Date.now() - lastPrune < PRUNE_EVERY_MS) return;
  pruning = true;
  lastPrune = Date.now();
  try {
    const entries = [];
    for (const dirName of await fsp.readdir(backupsRoot)) {
      const dirPath = path.join(backupsRoot, dirName);
      if (!(await fsp.stat(dirPath)).isDirectory()) continue;
      for (const fileName of await fsp.readdir(dirPath)) {
        const filePath = path.join(dirPath, fileName);
        const stat = await fsp.stat(filePath);
        entries.push({ filePath, size: stat.size, mtime: stat.mtimeMs });
      }
    }
    let total = entries.reduce((sum, e) => sum + e.size, 0);
    if (total <= MAX_TOTAL_BACKUPS_BYTES) return;
    entries.sort((a, b) => a.mtime - b.mtime); // más viejo primero, sin importar de qué archivo es
    for (const e of entries) {
      if (total <= MAX_TOTAL_BACKUPS_BYTES) break;
      await fsp.unlink(e.filePath);
      total -= e.size;
    }
  } catch {
    // una poda fallida no debe impedir guardar el archivo real
  } finally {
    pruning = false;
  }
}

async function makeBackup(filePath) {
  try {
    try {
      await fsp.access(filePath);
    } catch {
      return; // archivo nuevo: no hay versión anterior
    }
    const dir = backupDirFor(filePath);
    await fsp.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fsp.copyFile(filePath, path.join(dir, `${stamp}__${path.basename(filePath)}`));
    const entries = (await fsp.readdir(dir)).sort();
    while (entries.length > MAX_BACKUPS_PER_FILE) {
      await fsp.unlink(path.join(dir, entries.shift()));
    }
    pruneGlobalBackups(); // en segundo plano
  } catch (e) {
    ctx.logError('backup', e); // un backup fallido no debe impedir guardar el archivo real
  }
}

ipcMain.handle('file:save', async (event, { content, filePath, forceDialog }) => {
  let target = filePath;
  if (!target || forceDialog) {
    const result = await dialog.showSaveDialog(ctx.mainWindow, {
      defaultPath: target || undefined,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'LaTeX', extensions: ['tex'] }
      ]
    });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
    guard.grantFile(target); // "Guardar como": elegido por el usuario
  } else if (!guard.check(target, 'file:save')) {
    return null;
  }
  const existed = await fsp.access(target).then(() => true, () => false);
  await makeBackup(target);
  try {
    await fsp.writeFile(target, content, 'utf-8');
  } catch (e) {
    // Disco lleno, sin permiso, carpeta borrada...: antes la promesa se
    // rechazaba y el autoguardado fallaba en silencio. null = no guardado
    // (la pestaña sigue con cambios y reintenta) + aviso visible.
    ctx.reportError('file:save', e, `No se pudo guardar ${path.basename(target)}.`);
    return null;
  }
  indexTouch(target, !existed);
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
  } catch {
    return [];
  }
});

ipcMain.handle('backups:read', (event, backupPath) => {
  const rel = path.relative(backupsRoot, backupPath || '');
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null; // solo lee de backupsRoot
  try {
    return fs.readFileSync(backupPath, 'utf-8');
  } catch {
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

ipcMain.handle('file:read', async (event, filePath) => {
  if (!guard.check(filePath, 'file:read')) return null;
  try {
    const buffer = await fsp.readFile(filePath);
    if (looksBinary(buffer)) return { content: null, binary: true };
    return { content: buffer.toString('utf-8'), binary: false };
  } catch {
    return null;
  }
});

ipcMain.handle('folder:open', async () => {
  const result = await dialog.showOpenDialog(ctx.mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  const rootPath = result.filePaths[0];
  guard.grantDir(rootPath);
  ctx.saveConfig({ ...ctx.loadConfig(), lastFolder: rootPath });
  return { rootPath, tree: await readTree(rootPath) };
});

// Bienvenida (welcome.js): crea ~/Documentos/Notas MK con una nota de
// inicio (si ya existe, la reusa sin pisar nada) y la abre como carpeta.
const STARTER_NOTE = `# Bienvenida a MK

Esta es tu carpeta de notas: cada nota es un archivo \`.md\` normal que podés abrir con cualquier programa, copiar o subir a git.

## Para empezar

- **Ctrl+N** crea un documento nuevo y **Ctrl+S** lo guarda (o clic derecho en la barra lateral → Nuevo archivo).
- Escribí en Markdown: \`# título\`, \`**negrita**\`, \`- lista\`, \`- [ ] tarea\`.
- **Ctrl+Shift+L** activa Live Preview (escribís viendo el resultado) y **Ctrl+Shift+R** el modo lectura.
- **[[Otra nota]]** enlaza notas entre sí.
- **Ctrl+Shift+P** abre la paleta: todo lo que hace MK, buscándolo por nombre.
- **Ctrl+,** abre los Ajustes (tema, barra, módulos que se usan…).

- [ ] Crear mi primera nota
- [ ] Probar Live Preview con Ctrl+Shift+L

Podés borrar esta nota cuando quieras.
`;

ipcMain.handle('folder:createStarter', async () => {
  let docs;
  try {
    docs = app.getPath('documents');
  } catch {
    docs = os.homedir();
  }
  const rootPath = path.join(docs, 'Notas MK');
  try {
    await fsp.mkdir(rootPath, { recursive: true });
    const note = path.join(rootPath, 'Bienvenida.md');
    await fsp.writeFile(note, STARTER_NOTE, { encoding: 'utf-8', flag: 'wx' }).catch((e) => {
      if (e.code !== 'EEXIST') throw e;
    });
    guard.grantDir(rootPath);
    ctx.saveConfig({ ...ctx.loadConfig(), lastFolder: rootPath });
    return { rootPath, tree: await readTree(rootPath), note };
  } catch (e) {
    ctx.reportError('folder:createStarter', e, 'No se pudo crear la carpeta de notas.');
    return null;
  }
});

ipcMain.handle('folder:getLast', async () => {
  const { lastFolder } = ctx.loadConfig();
  if (!lastFolder) return null;
  guard.grantDir(lastFolder);
  try {
    return { rootPath: lastFolder, tree: await readTree(lastFolder) };
  } catch {
    return null;
  }
});

// Abrir como raíz: una carpeta ya autorizada (o adentro), una que la
// contiene (".." para subir) o la última usada. Cualquier otra, no.
ipcMain.handle('folder:read', async (event, rootPath) => {
  const { lastFolder } = ctx.loadConfig();
  if (guard.isAllowed(rootPath) || guard.isAncestorOfGranted(rootPath) || (rootPath && rootPath === lastFolder)) {
    guard.grantDir(rootPath);
  } else {
    guard.check(rootPath, 'folder:read'); // registra el intento
    return null;
  }
  try {
    return { rootPath, tree: await readTree(rootPath) };
  } catch {
    return null;
  }
});

// Vigilar la carpeta abierta (ver folderwatch.js): el renderer pide vigilar
// la raíz cada vez que la cambia y recibe 'folder:changed'.
// El índice (folderindex.js) confía en su caché solo para la carpeta
// vigilada entera (si se llegó al tope de carpetas, compara fechas).
const folderIndex = createFolderIndex({ cacheDir: path.join(app.getPath('userData'), 'cache') });
app.on('before-quit', () => folderIndex.saveCache()); // lo pendiente (mejor esfuerzo)

const folderWatcher = createFolderWatcher((payload) => {
  folderIndex.onFolderChanged(payload);
  if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) ctx.mainWindow.webContents.send('folder:changed', payload);
});

ipcMain.handle('folder:watch', (event, rootPath) => {
  if (!rootPath) {
    folderWatcher.stop();
    folderIndex.setWatchedRoot(null);
    return { dirs: 0, limited: false };
  }
  if (folderWatcher.currentRoot() === rootPath) return { dirs: -1, limited: false }; // ya vigilada
  if (!guard.check(rootPath, 'folder:watch')) return { error: 'Carpeta no autorizada.' };
  try {
    if (!fs.statSync(rootPath).isDirectory()) return { error: 'No es una carpeta.' };
  } catch {
    return { error: 'La carpeta no existe.' };
  }
  const info = folderWatcher.start(rootPath);
  folderIndex.setWatchedRoot(info.limited ? null : rootPath);
  return info;
});

// Cambios hechos por el propio MK: marcarlos ya, sin esperar el aviso del
// vigilante (una búsqueda justo después de guardar vería el texto viejo).
function indexTouch(filePath, structural) {
  const root = folderWatcher.currentRoot();
  if (root) folderIndex.onFolderChanged({ root, structural: !!structural, changes: [{ path: filePath }] });
}

ipcMain.handle('index:stats', () => folderIndex.stats());

// Arrastrar un archivo del sidebar afuera de MK (a otra app: navegador,
// explorador de archivos, Claude en el navegador para adjuntarlo, etc.) —
// necesita el drag nativo del sistema operativo, no alcanza con el drag
// HTML5 normal (ese solo funciona adentro de la misma ventana). Se dispara
// desde el 'dragstart' de la fila en sidebar.js, junto con el drag interno
// normal (mover entre carpetas) — no se pisan entre sí, cada uno maneja un
// tipo de dato distinto (DataTransfer propio vs. archivo nativo del SO).
let dragIcon = null;
ipcMain.on('sidebar:startFileDrag', (event, filePath) => {
  if (!guard.check(filePath, 'sidebar:startFileDrag')) return;
  try {
    if (!dragIcon) {
      dragIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png')).resize({ width: 24, height: 24 });
    }
    event.sender.startDrag({ file: filePath, icon: dragIcon });
  } catch {
    // si falla (ej. el archivo ya no existe), no rompe nada más —
    // el drag interno (mover entre carpetas del sidebar) sigue andando igual
  }
});

// Nombre de archivo/carpeta nuevo: sin separadores de ruta ni ".."
// (evita que "Nuevo archivo" con un nombre tipo "../../fuera" escriba fuera
// de la carpeta indicada).
function isSafeEntryName(name) {
  return typeof name === 'string' && name.trim().length > 0 &&
    !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..';
}

const DENIED = { error: 'Esa ubicación está fuera de la carpeta abierta.' };

ipcMain.handle('fs:createFile', (event, { dirPath, name }) => {
  if (!isSafeEntryName(name)) return { error: 'Nombre inválido.' };
  if (!guard.check(dirPath, 'fs:createFile')) return DENIED;
  const target = path.join(dirPath, name.trim());
  if (fs.existsSync(target)) return { error: 'Ya existe un archivo o carpeta con ese nombre.' };
  try {
    fs.writeFileSync(target, '', 'utf-8');
    indexTouch(target, true);
    return { path: target };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('fs:createFolder', (event, { dirPath, name }) => {
  if (!isSafeEntryName(name)) return { error: 'Nombre inválido.' };
  if (!guard.check(dirPath, 'fs:createFolder')) return DENIED;
  const target = path.join(dirPath, name.trim());
  if (fs.existsSync(target)) return { error: 'Ya existe un archivo o carpeta con ese nombre.' };
  try {
    fs.mkdirSync(target);
    indexTouch(target, true);
    return { path: target };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('fs:rename', (event, { targetPath, newName }) => {
  if (!isSafeEntryName(newName)) return { error: 'Nombre inválido.' };
  if (!guard.check(targetPath, 'fs:rename')) return DENIED;
  const dest = path.join(path.dirname(targetPath), newName.trim());
  if (fs.existsSync(dest)) return { error: 'Ya existe un archivo o carpeta con ese nombre.' };
  try {
    fs.renameSync(targetPath, dest);
    indexTouch(dest, true);
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
  if (!guard.check(sourcePath, 'fs:move') || !guard.check(destDir, 'fs:move')) return DENIED;
  if (isInside(sourcePath, destDir)) {
    return { error: 'No se puede mover una carpeta dentro de sí misma.' };
  }
  const dest = path.join(destDir, path.basename(sourcePath));
  if (dest === sourcePath) return { path: sourcePath };
  if (fs.existsSync(dest)) return { error: 'Ya existe un archivo o carpeta con ese nombre ahí.' };
  try {
    fs.renameSync(sourcePath, dest);
    indexTouch(dest, true);
    return { path: dest };
  } catch (e) {
    return { error: e.message };
  }
});

// Manda a la papelera del sistema (shell.trashItem) en vez de borrar directo
// con fs.rmSync — así "Eliminar" desde el sidebar se puede deshacer.
ipcMain.handle('fs:delete', async (event, { targetPath, isFolder }) => {
  if (!guard.check(targetPath, 'fs:delete')) return DENIED;
  if (guard._dirs.has(path.resolve(targetPath))) return { error: 'No se puede eliminar la carpeta abierta desde MK.' };
  try {
    await shell.trashItem(targetPath);
    return { ok: true };
  } catch {
    // La papelera del sistema puede fallar (sin gio/kioclient/trash-cli, o
    // moviendo entre distintos sistemas de archivos/puntos de montaje) —
    // en ese caso, borrar directo en vez de dejar la operación a medias.
    try {
      fs.rmSync(targetPath, { recursive: !!isFolder, force: false });
      indexTouch(targetPath, true);
      return { ok: true };
    } catch (e2) {
      return { error: e2.message };
    }
  }
});

ipcMain.handle('asset:copy', (event, { srcPath, targetDir }) => {
  if (!guard.check(srcPath, 'asset:copy') || !guard.check(targetDir, 'asset:copy')) return null;
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
  } catch {
    return null;
  }
});

module.exports = { folderIndex };
