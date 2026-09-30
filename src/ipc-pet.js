'use strict';

// Imágenes de las mascotas (ver pet.js), una carpeta por mascota:
// userData/pet/<id>/etapa1.png … + meta.json ({ "1": { sheet, label } }).
// Vienen de dos lados:
// - imágenes propias que elige el usuario (PNG/GIF/WebP/JPG/SVG);
// - personajes de un juego de RPG Maker / Pokémon Essentials: carpeta
//   Graphics/Characters (hojas de caminata 4×4) y, si está, PBS/pokemon.txt
//   para nombres, evoluciones y cuáles son legendarios.
// Nunca se copian al repositorio ni a la carpeta de notas: son de uso local.

const { app, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ctx = require('./mainctx');
const guard = require('./pathguard');

const PET_DIR = path.join(app.getPath('userData'), 'pet');
const EXTS = ['png', 'gif', 'webp', 'jpg', 'jpeg', 'svg'];
const MAX_BYTES = 5 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_]+$/;
const PET_ID_RE = /^[a-z0-9-]{1,40}$/;

guard.grantDir(PET_DIR); // para mostrarlas con md-local://

function petDir(petId) {
  if (!PET_ID_RE.test(String(petId))) throw new Error('Id de mascota inválido');
  return path.join(PET_DIR, petId);
}

// Versión anterior: una sola mascota con sus imágenes sueltas en pet/.
// Se mueven a la carpeta de la primera mascota (id "p1").
function migrateLegacy() {
  try {
    const loose = fs.readdirSync(PET_DIR).filter((f) => /^etapa[123]\./.test(f) || f === 'meta.json');
    if (!loose.length) return;
    const dest = petDir('p1');
    fs.mkdirSync(dest, { recursive: true });
    loose.forEach((f) => fs.renameSync(path.join(PET_DIR, f), path.join(dest, f)));
  } catch {
    // sin carpeta todavía: nada que migrar
  }
}
migrateLegacy();

function readMeta(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf-8'));
  } catch {
    return {};
  }
}

function spriteFor(dir, stage) {
  try {
    const f = fs.readdirSync(dir).find((n) => n.startsWith(`etapa${stage}.`));
    return f ? path.join(dir, f) : null;
  } catch {
    return null;
  }
}

// { 1: { path, sheet, label } | null, 2: …, 3: … }
function list(petId) {
  const dir = petDir(petId);
  const meta = readMeta(dir);
  const out = {};
  [1, 2, 3].forEach((n) => {
    const p = spriteFor(dir, n);
    out[n] = p ? { path: p, sheet: !!(meta[n] && meta[n].sheet), label: (meta[n] && meta[n].label) || '' } : null;
  });
  return out;
}

function install(petId, stage, src, opts) {
  const ext = path.extname(src).slice(1).toLowerCase();
  if (!EXTS.includes(ext)) return { error: 'Formato no admitido (PNG, GIF, WebP, JPG o SVG).' };
  if (fs.statSync(src).size > MAX_BYTES) return { error: 'La imagen pesa más de 5 MB.' };
  const dir = petDir(petId);
  fs.mkdirSync(dir, { recursive: true });
  const old = spriteFor(dir, stage);
  if (old) fs.rmSync(old, { force: true });
  fs.copyFileSync(src, path.join(dir, `etapa${stage}.${ext}`));
  const meta = readMeta(dir);
  meta[stage] = { sheet: !!(opts && opts.sheet), label: (opts && opts.label) || '' };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta), 'utf-8');
  return { ok: true, sprites: list(petId) };
}

// ---------- juego de RPG Maker ----------

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

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

// PBS/pokemon.txt → Map(ID → { name, evos: [ID…], legendary })
function readPbs(charDir) {
  const species = new Map();
  let text;
  try {
    text = fs.readFileSync(path.join(charDir, '..', '..', 'PBS', 'pokemon.txt'), 'utf-8');
  } catch {
    return species;
  }
  let cur = null;
  text.split(/\r?\n/).forEach((line) => {
    const h = line.match(/^\[([A-Z0-9_]+)\]\s*$/);
    if (h) {
      cur = { name: h[1], evos: [], legendary: false };
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
    if (/^Flags\s*=.*\b(Legendary|Mythical)\b/.test(line)) cur.legendary = true;
  });
  return species;
}

// Líneas evolutivas (todas las ramas, hasta 3 etapas) de las formas base
// con sprite. legendary: la forma base es legendaria o singular.
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
      if (targets.has(id) || !files.has(id)) return;
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
        lines.push({ ids: chain, names: chain.map((c) => (species.get(c) || {}).name || c), legendary: !!s.legendary });
      });
    });
  } else {
    files.forEach((id) => lines.push({ ids: [id], names: [id], legendary: false }));
  }
  lines.sort((a, b) => a.names[0].localeCompare(b.names[0]));
  return { dir: charDir, lines, total: files.size, withEvolutions: species.size > 0, legendaries: lines.filter((l) => l.legendary).length };
}

// ---------- IPC ----------

ipcMain.handle('pet:sprites', (event, petId) => {
  try {
    return list(petId);
  } catch {
    return { 1: null, 2: null, 3: null };
  }
});

// testPath: solo la suite de tests (sin diálogo).
ipcMain.handle('pet:pickSprite', async (event, petId, stage, testPath) => {
  const n = Number(stage);
  if (![1, 2, 3].includes(n) || !PET_ID_RE.test(String(petId))) return { error: 'Selección inválida.' };
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
    return install(petId, n, src, { sheet: false });
  } catch (e) {
    ctx.reportError('pet:pickSprite', e, 'No se pudo copiar la imagen de la mascota.');
    return { error: 'No se pudo copiar la imagen.' };
  }
});

ipcMain.handle('pet:clearSprites', (event, petId) => {
  try {
    fs.rmSync(petDir(petId), { recursive: true, force: true });
    return list(petId);
  } catch (e) {
    ctx.logError('pet:clearSprites', e);
    return { 1: null, 2: null, 3: null };
  }
});

ipcMain.handle('pet:findCharDirs', () => findCharDirs());

ipcMain.handle('pet:pickCharDir', async () => {
  if (ctx.isTestMode) return null;
  const result = await dialog.showOpenDialog(ctx.mainWindow, {
    title: 'Carpeta de personajes (Graphics/Characters)',
    defaultPath: findCharDirs()[0],
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

// Copia los sprites de una línea del juego a la carpeta de una mascota
// (si la línea tiene menos de 3 etapas, la última se repite).
ipcMain.handle('pet:useChars', (event, petId, charDir, ids, names) => {
  if (!PET_ID_RE.test(String(petId)) || !isDir(charDir) || !Array.isArray(ids) || !ids.length || ids.some((i) => !ID_RE.test(String(i)))) return { error: 'Selección inválida.' };
  try {
    for (let n = 1; n <= 3; n++) {
      const k = Math.min(n, ids.length) - 1;
      const src = path.join(charDir, `${ids[k]}.png`);
      if (!fs.existsSync(src)) return { error: `Falta ${ids[k]}.png en esa carpeta.` };
      const name = Array.isArray(names) ? String(names[k] || ids[k]).slice(0, 40) : ids[k];
      const res = install(petId, n, src, { sheet: true, label: name });
      if (res.error) return res;
    }
    return { ok: true, sprites: list(petId) };
  } catch (e) {
    ctx.reportError('pet:useChars', e, 'No se pudieron copiar los personajes.');
    return { error: 'No se pudieron copiar los personajes.' };
  }
});
