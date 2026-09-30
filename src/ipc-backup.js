'use strict';

// Exportar / importar todo (Ajustes → Sistema y paleta). Ver backupbundle.js
// para qué entra en el respaldo. Antes de importar se guarda automáticamente
// un respaldo del estado actual en userData/backups/, por si acaso.

const { app, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const ctx = require('./mainctx');
const { buildBundle, validateBundle, restoreBundle } = require('./backupbundle');

const USER_DATA = app.getPath('userData');
const MAX_BYTES = 300 * 1024 * 1024;

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function readBundle(file) {
  const st = fs.statSync(file);
  if (st.size > MAX_BYTES) return { error: 'El archivo es demasiado grande para ser un respaldo de MK.' };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return { error: 'No es un respaldo de MK (no se pudo leer).' };
  }
  const check = validateBundle(data);
  return check.ok ? { data, summary: check.summary } : { error: check.error };
}

// testPath: solo la suite de tests (sin diálogo).
ipcMain.handle('backup:export', async (event, testPath) => {
  let file = null;
  if (ctx.isTestMode) {
    file = typeof testPath === 'string' ? testPath : null;
  } else {
    const result = await dialog.showSaveDialog(ctx.mainWindow, {
      title: 'Exportar respaldo de MK',
      defaultPath: path.join(app.getPath('documents'), `MK-respaldo-${new Date().toISOString().slice(0, 10)}.mkbackup`),
      filters: [{ name: 'Respaldo de MK', extensions: ['mkbackup'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    file = result.filePath;
  }
  if (!file) return { canceled: true };
  try {
    const bundle = buildBundle(USER_DATA, app.getVersion());
    fs.writeFileSync(file, JSON.stringify(bundle), 'utf-8');
    return { ok: true, file, summary: validateBundle(bundle).summary };
  } catch (e) {
    ctx.reportError('backup:export', e, 'No se pudo exportar el respaldo.');
    return { error: 'No se pudo exportar el respaldo.' };
  }
});

// Elige y revisa el archivo; todavía no cambia nada. backup:import solo
// acepta el último archivo elegido acá.
let lastPicked = null;
ipcMain.handle('backup:pick', async (event, testPath) => {
  let file = null;
  if (ctx.isTestMode) {
    file = typeof testPath === 'string' ? testPath : null;
  } else {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
      title: 'Importar respaldo de MK',
      filters: [{ name: 'Respaldo de MK', extensions: ['mkbackup', 'json'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    file = result.filePaths[0];
  }
  if (!file) return { canceled: true };
  try {
    const r = readBundle(file);
    if (r.error) return r;
    lastPicked = file;
    return { ok: true, file, summary: r.summary };
  } catch (e) {
    ctx.logError('backup:pick', e);
    return { error: 'No se pudo leer ese archivo.' };
  }
});

ipcMain.handle('backup:import', async (event, file) => {
  if (typeof file !== 'string' || file !== lastPicked) return { error: 'Elegí el respaldo de nuevo.' };
  try {
    const r = readBundle(file);
    if (r.error) return r;
    // Primero, una copia de lo que hay ahora.
    const safetyDir = path.join(USER_DATA, 'backups');
    fs.mkdirSync(safetyDir, { recursive: true });
    const safety = path.join(safetyDir, `antes-de-importar-${stamp()}.mkbackup`);
    fs.writeFileSync(safety, JSON.stringify(buildBundle(USER_DATA, app.getVersion())), 'utf-8');
    // Lo que la ventana tenga pendiente de guardar (Home, mascota) no debe
    // pisar lo importado: se ignora hasta que la página se recargue (main.js
    // lo vuelve a permitir en did-navigate).
    ctx.writesFrozen = !ctx.isTestMode;
    const summary = restoreBundle(USER_DATA, r.data);
    lastPicked = null;
    const win = ctx.mainWindow;
    if (!ctx.isTestMode && win && !win.isDestroyed()) setTimeout(() => win.webContents.reload(), 50);
    return { ok: true, summary, safety };
  } catch (e) {
    ctx.writesFrozen = false;
    ctx.reportError('backup:import', e, 'No se pudo importar el respaldo.');
    return { error: 'No se pudo importar el respaldo.' };
  }
});
