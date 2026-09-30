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
const { cutFrame, alignFrames, trimFrame } = require('./khsprites');

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

// ---- Sora y Roxas como mascotas (pet.js, kind 'kh') ----
// Hojas de fans (sin transparencia, distribución irregular): se reconocen
// por su tamaño exacto y se recortan con las posiciones medidas a mano.
// Los cuadros miran a la derecha salvo los marcados con flip.
const CHARS = {
  sora: {
    name: 'Sora',
    size: [1024, 2917],
    bg: [255, 255, 255],
    anims: {
      // De frente (se le ve la cara). La fila de y≈414 camina de espaldas.
      idle: [[360, 15, 25, 50], [392, 15, 25, 50]],
      walk: [[2, 156, 23, 49], [34, 156, 27, 49], [67, 156, 26, 49], [98, 155, 24, 50], [128, 157, 24, 48]],
      attack: [[3, 726, 28, 52], [36, 709, 34, 69], [76, 743, 56, 35], [139, 740, 55, 38]]
    },
    flip: { idle: true, walk: true, attack: true }, // en la hoja miran a la izquierda
    // Celdas de la cuadrícula de retratos (se recortan al dibujo).
    portraits: { normal: [500, 5, 70, 95], feliz: [570, 575, 70, 95], decidido: [500, 198, 70, 95], preocupado: [500, 295, 70, 95], dormido: [780, 5, 70, 95] }
  },
  roxas: {
    name: 'Roxas',
    size: [608, 2872],
    bg: [181, 165, 213],
    anims: {
      idle: [[19, 145, 36, 52], [66, 146, 35, 51], [111, 149, 35, 50], [157, 149, 35, 52]],
      walk: [[6, 231, 54, 44], [68, 235, 50, 44], [127, 236, 50, 42], [183, 231, 51, 45], [244, 235, 55, 44], [306, 237, 66, 46], [383, 241, 63, 42], [469, 239, 52, 42]],
      attack: [[6, 603, 44, 49], [57, 606, 41, 44], [104, 605, 67, 46], [176, 607, 77, 45], [258, 608, 78, 45], [340, 601, 46, 49]]
    },
    flip: {},
    portraits: { normal: [11, 6, 69, 104], feliz: [93, 10, 69, 98] }
  }
};

const charFile = (id) => path.join(KH_DIR, `${id}.png`);

function toDataUrl(f) {
  return nativeImage.createFromBitmap(f.data, { width: f.width, height: f.height }).toDataURL();
}

const rect = ([x, y, width, height]) => ({ x, y, width, height });

function buildChar(id) {
  const def = CHARS[id];
  const file = charFile(id);
  if (!def || !fs.existsSync(file)) return null;
  const img = nativeImage.createFromPath(file);
  const { width, height } = img.getSize();
  if (width !== def.size[0] || height !== def.size[1]) return null;
  const bmp = img.toBitmap(); // BGRA
  const anims = {};
  for (const [name, rects] of Object.entries(def.anims)) {
    const frames = alignFrames(rects.map((r) => trimFrame(cutFrame(bmp, width, rect(r), def.bg, 'bgra'))));
    anims[name] = { frames: frames.map(toDataUrl), width: frames[0].width, height: frames[0].height, flip: !!def.flip[name] };
  }
  const portraits = {};
  for (const [mood, r] of Object.entries(def.portraits)) portraits[mood] = toDataUrl(trimFrame(cutFrame(bmp, width, rect(r), def.bg, 'bgra')));
  return { id, name: def.name, anims, portraits };
}

// Qué personajes se reconocen en una imagen (por tamaño).
function charForImage(file) {
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) return null;
  const { width, height } = img.getSize();
  return Object.keys(CHARS).find((id) => CHARS[id].size[0] === width && CHARS[id].size[1] === height) || null;
}

function charCandidates() {
  const dirs = [app.getPath('downloads'), path.join(os.homedir(), 'Descargas'), path.join(os.homedir(), 'Downloads')];
  const out = [];
  for (const d of dirs) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) {
      if (!/\.png$/i.test(n)) continue;
      const p = path.join(d, n);
      try {
        if (fs.statSync(p).size > MAX_BYTES * 4) continue;
        const id = charForImage(p);
        if (id && !out.some((c) => c.id === id)) out.push({ id, path: p });
      } catch {
        // ilegible: se ignora
      }
    }
  }
  return out;
}

ipcMain.handle('kh:chars', () => {
  try {
    return Object.keys(CHARS).map(buildChar).filter(Boolean);
  } catch (e) {
    ctx.logError('kh:chars', e);
    return [];
  }
});

ipcMain.handle('kh:charCandidates', () => charCandidates());

// Copia las hojas de personajes reconocidas (de Descargas, o las que elija
// el usuario) a userData/kh/<id>.png. testPaths: solo la suite.
ipcMain.handle('kh:charImport', async (event, testPaths) => {
  let files = [];
  if (ctx.isTestMode) files = Array.isArray(testPaths) ? testPaths : [];
  else {
    const found = charCandidates();
    if (found.length) files = found.map((c) => c.path);
    else {
      const result = await dialog.showOpenDialog(ctx.mainWindow, {
        title: 'Hojas de sprites de Sora / Roxas',
        defaultPath: app.getPath('downloads'),
        filters: [{ name: 'PNG', extensions: ['png'] }],
        properties: ['openFile', 'multiSelections']
      });
      if (result.canceled) return { canceled: true };
      files = result.filePaths;
    }
  }
  const imported = [];
  for (const f of files) {
    const id = charForImage(f);
    if (!id) continue;
    fs.mkdirSync(KH_DIR, { recursive: true });
    fs.copyFileSync(f, charFile(id));
    imported.push(id);
  }
  if (!imported.length) return { error: 'No reconocí ninguna hoja: MK conoce la de Sora de Chain of Memories (1024×2917) y la de Roxas (608×2872).' };
  return { ok: true, imported };
});

ipcMain.handle('kh:clear', () => {
  fs.rmSync(SHEET, { force: true }); // solo las keyblades (Sora y Roxas siguen)
  return true;
});

module.exports = { CHARS, buildChar };
