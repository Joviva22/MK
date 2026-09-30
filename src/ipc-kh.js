'use strict';

// Guiño a Kingdom Hearts (keyblades.js): una hoja de sprites con keyblades
// que elige el usuario. Como las imágenes de mascotas de un juego, se copia
// SOLO a la configuración local (userData/kh/), nunca al repositorio ni a la
// carpeta de notas: es arte de otros, para uso personal.
// El recorte (una imagen por keyblade) se hace acá con nativeImage.

const { app, dialog, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ctx = require('./mainctx');
const { sliceSheet } = require('./khslice');

const KH_DIR = path.join(app.getPath('userData'), 'kh');
const SHEET = path.join(KH_DIR, 'keyblades.png');
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 2048;

function candidates() {
  const names = ['keyblades.png', 'Keyblades.png', 'keyblade.png'];
  const dirs = [app.getPath('downloads'), path.join(os.homedir(), 'Descargas'), path.join(os.homedir(), 'Downloads'), app.getPath('pictures')];
  const out = [];
  for (const d of dirs) {
    for (const n of names) {
      const p = path.join(d, n);
      if (!out.includes(p) && fs.existsSync(p)) out.push(p);
    }
  }
  return out;
}

// [{ dataUrl, width, height }] — una por keyblade, de izquierda a derecha.
function slices() {
  if (!fs.existsSync(SHEET)) return [];
  const img = nativeImage.createFromPath(SHEET);
  if (img.isEmpty()) return [];
  const { width, height } = img.getSize();
  if (width > MAX_SIDE || height > MAX_SIDE) return [];
  const bmp = img.toBitmap(); // BGRA
  const rects = sliceSheet({ width, height, alphaAt: (x, y) => bmp[(y * width + x) * 4 + 3] });
  return rects.slice(0, 24).map((r) => ({ dataUrl: img.crop(r).toDataURL(), width: r.width, height: r.height }));
}

function install(src) {
  if (!/\.png$/i.test(src)) return { error: 'Tiene que ser un PNG con fondo transparente.' };
  if (fs.statSync(src).size > MAX_BYTES) return { error: 'La imagen pesa más de 5 MB.' };
  fs.mkdirSync(KH_DIR, { recursive: true });
  fs.copyFileSync(src, SHEET);
  const list = slices();
  if (!list.length) return { error: 'No encontré keyblades en esa imagen (¿tiene fondo transparente?).' };
  return { ok: true, keyblades: list };
}

ipcMain.handle('kh:keyblades', () => {
  try {
    return slices();
  } catch (e) {
    ctx.logError('kh:keyblades', e);
    return [];
  }
});

ipcMain.handle('kh:candidates', () => candidates());

// testPath: solo la suite de tests (sin diálogo). fromPath: una de
// kh:candidates (encontrada en Descargas).
ipcMain.handle('kh:import', async (event, fromPath, testPath) => {
  let src = null;
  if (ctx.isTestMode) src = typeof testPath === 'string' ? testPath : null;
  else if (typeof fromPath === 'string' && candidates().includes(fromPath)) src = fromPath;
  else {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
      title: 'Hoja de keyblades (PNG con fondo transparente)',
      defaultPath: candidates()[0] || app.getPath('downloads'),
      filters: [{ name: 'PNG', extensions: ['png'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    src = result.filePaths[0];
  }
  if (!src) return { canceled: true };
  try {
    return install(src);
  } catch (e) {
    ctx.reportError('kh:import', e, 'No se pudo copiar la imagen de keyblades.');
    return { error: 'No se pudo copiar la imagen.' };
  }
});

ipcMain.handle('kh:clear', () => {
  fs.rmSync(KH_DIR, { recursive: true, force: true });
  return true;
});
