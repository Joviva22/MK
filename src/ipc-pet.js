'use strict';

// Mascota "personalizada" (ver pet.js): el usuario elige sus propias
// imágenes (PNG/GIF/WebP), una por etapa. Se copian a userData/pet/ — nunca
// al repositorio ni a la carpeta de notas — y se sirven por md-local://.

const { app, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const ctx = require('./mainctx');
const guard = require('./pathguard');

const PET_DIR = path.join(app.getPath('userData'), 'pet');
const EXTS = ['png', 'gif', 'webp', 'jpg', 'jpeg', 'svg'];
const MAX_BYTES = 5 * 1024 * 1024;

guard.grantDir(PET_DIR); // para poder mostrarlas con md-local://

function spriteFor(stage) {
  try {
    const f = fs.readdirSync(PET_DIR).find((n) => n.startsWith(`etapa${stage}.`));
    return f ? path.join(PET_DIR, f) : null;
  } catch {
    return null;
  }
}

function list() {
  return { 1: spriteFor(1), 2: spriteFor(2), 3: spriteFor(3) };
}

function install(stage, src) {
  const ext = path.extname(src).slice(1).toLowerCase();
  if (!EXTS.includes(ext)) return { error: 'Formato no admitido (PNG, GIF, WebP, JPG o SVG).' };
  if (fs.statSync(src).size > MAX_BYTES) return { error: 'La imagen pesa más de 5 MB.' };
  fs.mkdirSync(PET_DIR, { recursive: true });
  const old = spriteFor(stage);
  if (old) fs.rmSync(old, { force: true });
  fs.copyFileSync(src, path.join(PET_DIR, `etapa${stage}.${ext}`));
  return { ok: true, sprites: list() };
}

ipcMain.handle('pet:sprites', () => list());

// testPath: solo la suite de tests (no hay diálogo en modo test).
ipcMain.handle('pet:pickSprite', async (event, stage, testPath) => {
  const n = Number(stage);
  if (![1, 2, 3].includes(n)) return { error: 'Etapa inválida.' };
  let src = null;
  if (ctx.isTestMode) {
    src = typeof testPath === 'string' ? testPath : null;
  } else {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
      title: `Imagen de la mascota — etapa ${n}`,
      filters: [{ name: 'Imágenes', extensions: EXTS }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    src = result.filePaths[0];
  }
  if (!src) return { canceled: true };
  try {
    return install(n, src);
  } catch (e) {
    ctx.reportError('pet:pickSprite', e, 'No se pudo copiar la imagen de la mascota.');
    return { error: 'No se pudo copiar la imagen.' };
  }
});

ipcMain.handle('pet:clearSprites', () => {
  try {
    fs.rmSync(PET_DIR, { recursive: true, force: true });
  } catch (e) {
    ctx.logError('pet:clearSprites', e);
  }
  return list();
});
