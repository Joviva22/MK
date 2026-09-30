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
const META_FILE = path.join(PET_DIR, 'meta.json'); // { "1": { "sheet": true }, ... }
const os = require('os');
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

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeMeta(meta) {
  fs.mkdirSync(PET_DIR, { recursive: true });
  fs.writeFileSync(META_FILE, JSON.stringify(meta), 'utf-8');
}

// { 1: { path, sheet }, ... } — sheet: hoja de caminata 4×4 de RPG Maker.
function list() {
  const meta = readMeta();
  const out = {};
  [1, 2, 3].forEach((n) => {
    const p = spriteFor(n);
    out[n] = p ? { path: p, sheet: !!(meta[n] && meta[n].sheet), label: (meta[n] && meta[n].label) || '' } : null;
  });
  return out;
}

function install(stage, src, opts) {
  const ext = path.extname(src).slice(1).toLowerCase();
  if (!EXTS.includes(ext)) return { error: 'Formato no admitido (PNG, GIF, WebP, JPG o SVG).' };
  if (fs.statSync(src).size > MAX_BYTES) return { error: 'La imagen pesa más de 5 MB.' };
  fs.mkdirSync(PET_DIR, { recursive: true });
  const old = spriteFor(stage);
  if (old) fs.rmSync(old, { force: true });
  fs.copyFileSync(src, path.join(PET_DIR, `etapa${stage}.${ext}`));
  const meta = readMeta();
  meta[stage] = { sheet: !!(opts && opts.sheet), label: (opts && opts.label) || '' };
  writeMeta(meta);
  return { ok: true, sprites: list() };
}

// ---------- personajes de un juego de RPG Maker (Pokémon Essentials) ----------
// Carpeta Graphics/Characters: hojas de 4×4 (abajo, izquierda, derecha,
// arriba × 4 pasos). Si al lado está PBS/pokemon.txt, se leen nombres y
// evoluciones para armar las líneas (Charmander → Charmeleon → Charizard).

const ID_RE = /^[A-Za-z0-9_]+$/;

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Carpetas típicas que ya están en el disco: ~/Descargas/*/Graphics/Characters.
function findCharDirs() {
  const found = [];
  ['Descargas', 'Downloads', 'Documentos', 'Documents', 'Juegos', 'Games'].forEach((d) => {
    const base = path.join(os.homedir(), d);
    let entries = [];
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      return;
    }
    entries.forEach((e) => {
      if (!e.isDirectory()) return;
      const c = path.join(base, e.name, 'Graphics', 'Characters');
      if (isDir(c)) found.push(c);
    });
  });
  return found;
}

// PBS/pokemon.txt → Map(ID → { name, evos: [ID...] })
function readPbs(charDir) {
  const pbs = path.join(charDir, '..', '..', 'PBS', 'pokemon.txt');
  const species = new Map();
  let text;
  try {
    text = fs.readFileSync(pbs, 'utf-8');
  } catch {
    return species;
  }
  let cur = null;
  text.split(/\r?\n/).forEach((line) => {
    const h = line.match(/^\[([A-Z0-9_]+)\]\s*$/);
    if (h) {
      cur = { name: h[1], evos: [] };
      species.set(h[1], cur);
      return;
    }
    if (!cur) return;
    const name = line.match(/^Name\s*=\s*(.+)$/);
    if (name) cur.name = name[1].trim();
    const evo = line.match(/^Evolutions?\s*=\s*(.+)$/);
    if (evo) {
      const parts = evo[1].split(',').map((x) => x.trim());
      for (let i = 0; i < parts.length; i += 3) if (ID_RE.test(parts[i])) cur.evos.push(parts[i]);
    }
  });
  return species;
}

function charCatalog(charDir) {
  if (!isDir(charDir)) return { error: 'Esa carpeta no existe.' };
  const files = new Set();
  fs.readdirSync(charDir).forEach((f) => {
    const m = f.match(/^([A-Za-z0-9_]+)\.png$/i);
    if (m) files.add(m[1]);
  });
  const species = readPbs(charDir);
  const lines = [];
  if (species.size) {
    const targets = new Set();
    species.forEach((s) => s.evos.forEach((e) => targets.add(e)));
    species.forEach((s, id) => {
      if (targets.has(id) || !files.has(id)) return; // solo formas base con sprite
      // Todas las ramas (Eevee → Vaporeon, Eevee → Jolteon…), hasta 3 etapas.
      const chains = [];
      const walk = (chain) => {
        const last = species.get(chain[chain.length - 1]);
        const nexts = chain.length < 3 && last ? last.evos.filter((e) => files.has(e) && !chain.includes(e)) : [];
        if (!nexts.length) chains.push(chain);
        else nexts.forEach((e) => walk([...chain, e]));
      };
      walk([id]);
      const seen = new Set();
      chains.forEach((chain) => {
        const key = chain.join('>');
        if (seen.has(key)) return;
        seen.add(key);
        lines.push({ ids: chain, names: chain.map((c) => (species.get(c) || {}).name || c) });
      });
    });
  } else {
    files.forEach((id) => lines.push({ ids: [id], names: [id] }));
  }
  lines.sort((a, b) => a.names[0].localeCompare(b.names[0]));
  return { dir: charDir, lines, total: files.size, withEvolutions: species.size > 0 };
}

ipcMain.handle('pet:findCharDirs', () => findCharDirs());

ipcMain.handle('pet:pickCharDir', async () => {
  if (ctx.isTestMode) return null;
  const suggested = findCharDirs()[0];
  const result = await dialog.showOpenDialog(ctx.mainWindow, {
    title: 'Carpeta de personajes (Graphics/Characters)',
    defaultPath: suggested,
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('pet:charCatalog', (event, charDir) => {
  try {
    return charCatalog(String(charDir || ''));
  } catch (e) {
    ctx.logError('pet:charCatalog', e);
    return { error: 'No se pudo leer esa carpeta.' };
  }
});

// Copia los sprites de la línea elegida a userData/pet como etapas 1–3
// (si la línea tiene menos de 3, la última se repite).
ipcMain.handle('pet:useChars', (event, charDir, ids, names) => {
  if (!isDir(charDir) || !Array.isArray(ids) || !ids.length || ids.some((i) => !ID_RE.test(String(i)))) return { error: 'Selección inválida.' };
  try {
    for (let n = 1; n <= 3; n++) {
      const id = ids[Math.min(n, ids.length) - 1];
      const src = path.join(charDir, `${id}.png`);
      if (!fs.existsSync(src)) return { error: `Falta ${id}.png en esa carpeta.` };
      const name = Array.isArray(names) ? String(names[Math.min(n, ids.length) - 1] || id).slice(0, 40) : id;
      const res = install(n, src, { sheet: true, label: name });
      if (res.error) return res;
    }
    return { ok: true, sprites: list() };
  } catch (e) {
    ctx.reportError('pet:useChars', e, 'No se pudieron copiar los personajes.');
    return { error: 'No se pudieron copiar los personajes.' };
  }
});

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
    return install(n, src, { sheet: false });
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
