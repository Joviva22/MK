'use strict';

// Índice en memoria de los archivos de texto de la carpeta (proceso
// principal). Búsqueda, etiquetas, backlinks, grafo, Kanban de carpeta y
// las tareas 📅 del Home recorrían y releían TODOS los archivos en cada
// consulta; ahora:
//
// - la lista de archivos se guarda y solo se rehace cuando el vigilante
//   (folderwatch.js) avisa que algo se creó/borró/movió;
// - el contenido se guarda por archivo y solo se relee el que cambió (aviso
//   del vigilante) — o, si la carpeta no está vigilada, el que tiene otra
//   fecha de modificación o tamaño;
// - tope de memoria: archivos de más de MAX_FILE_BYTES no se guardan (se
//   leen cada vez), y pasado MAX_TOTAL_BYTES se vacía el caché.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const TEXT_EXT = /\.(md|markdown|txt|tex)$/i;
const READ_BATCH = 16;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
// Índice guardado en disco (opts.cacheDir, en userData — NO en la carpeta de
// notas, para no meter una copia del texto en git/respaldos): al abrir MK,
// la primera consulta solo verifica fecha y tamaño de cada archivo en vez de
// leerlos todos. Solo archivos chicos, con tope total.
const CACHE_VERSION = 1;
const CACHE_MAX_FILE = 512 * 1024;
const CACHE_MAX_TOTAL = 64 * 1024 * 1024;
const SAVE_DELAY_MS = 3000;

function createFolderIndex(opts) {
  const cacheDir = opts && opts.cacheDir;
  const contents = new Map(); // ruta -> { mtimeMs, size, content, unverified? }
  let totalBytes = 0;
  let watchedRoot = null; // carpeta que folderwatch.js está vigilando
  let listCache = null; // { root, files } — válido mientras nada estructural cambie
  const dirty = new Set(); // rutas con cambios avisados por el vigilante
  const stats = { reads: 0, hits: 0, listBuilds: 0 };

  async function listTextFiles(root) {
    const out = [];
    async function walk(dirPath) {
      let entries;
      try {
        entries = await fsp.readdir(dirPath, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) await walk(fullPath);
        else if (TEXT_EXT.test(entry.name)) out.push(fullPath);
      }
    }
    await walk(root);
    stats.listBuilds++;
    return out;
  }

  async function files(root) {
    const trusted = root === watchedRoot;
    if (trusted && listCache && listCache.root === root) return listCache.files;
    const list = await listTextFiles(root);
    if (trusted) listCache = { root, files: list };
    return list;
  }

  function remember(filePath, stat, content) {
    const prev = contents.get(filePath);
    if (prev) totalBytes -= prev.size;
    if (stat.size > MAX_FILE_BYTES) {
      contents.delete(filePath);
      return;
    }
    if (totalBytes + stat.size > MAX_TOTAL_BYTES) {
      contents.clear();
      totalBytes = 0;
    }
    contents.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, content });
    totalBytes += stat.size;
  }

  async function read(filePath, trusted) {
    const cached = contents.get(filePath);
    // Lo que vino del índice guardado se verifica una vez (fecha y tamaño).
    if (cached && trusted && !dirty.has(filePath) && !cached.unverified) {
      stats.hits++;
      return cached.content;
    }
    let stat;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      contents.delete(filePath);
      return null;
    }
    dirty.delete(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      stats.hits++;
      if (cached.unverified) { cached.unverified = false; stats.verified = (stats.verified || 0) + 1; }
      return cached.content;
    }
    let content;
    try {
      content = await fsp.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
    stats.reads++;
    remember(filePath, stat, content);
    changedSinceSave = true;
    return content;
  }

  // ---- índice en disco ----
  let changedSinceSave = false;
  let saveTimer = null;

  function cacheFileFor(root) {
    if (!cacheDir || !root) return null;
    const h = crypto.createHash('md5').update(root).digest('hex');
    return path.join(cacheDir, `index-${h}.json`);
  }

  async function loadCache(root) {
    const file = cacheFileFor(root);
    if (!file) return 0;
    let data;
    try {
      data = JSON.parse(await fsp.readFile(file, 'utf-8'));
    } catch {
      return 0; // no hay (o está dañado): se arma de cero
    }
    if (!data || data.v !== CACHE_VERSION || data.root !== root || !Array.isArray(data.files)) return 0;
    let n = 0;
    for (const [rel, mtimeMs, size, content] of data.files) {
      if (typeof rel !== 'string' || typeof content !== 'string') continue;
      const full = path.join(root, rel);
      if (contents.has(full)) continue;
      if (totalBytes + size > MAX_TOTAL_BYTES) break;
      contents.set(full, { mtimeMs, size, content, unverified: true });
      totalBytes += size;
      n++;
    }
    stats.loadedFromDisk = n;
    return n;
  }

  async function saveCache() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const root = watchedRoot;
    const file = cacheFileFor(root);
    if (!file || !changedSinceSave) return false;
    changedSinceSave = false;
    const files = [];
    let total = 0;
    for (const [full, e] of contents) {
      // Solo lo confirmado en esta sesión: un archivo borrado con MK cerrado
      // no se arrastra para siempre.
      if (e.unverified || !full.startsWith(root + path.sep) || e.size > CACHE_MAX_FILE) continue;
      if (total + e.size > CACHE_MAX_TOTAL) break;
      files.push([path.relative(root, full), e.mtimeMs, e.size, e.content]);
      total += e.size;
    }
    try {
      await fsp.mkdir(cacheDir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify({ v: CACHE_VERSION, root, saved: Date.now(), files }), 'utf-8');
      await fsp.rename(tmp, file);
      stats.saves = (stats.saves || 0) + 1;
      return true;
    } catch {
      return false; // el índice en disco es opcional: sin él, solo arranca más lento
    }
  }

  function scheduleSave() {
    if (!cacheDir || !watchedRoot || !changedSinceSave || saveTimer) return;
    saveTimer = setTimeout(saveCache, SAVE_DELAY_MS);
  }

  // Llama onFile(ruta, contenido) para cada archivo de texto de root, en
  // orden (en profundidad, como siempre). Si onFile devuelve false, corta.
  async function walk(root, onFile) {
    if (root === watchedRoot && cacheReady) await cacheReady;
    const trusted = root === watchedRoot;
    const list = await files(root);
    for (let i = 0; i < list.length; i += READ_BATCH) {
      const batch = list.slice(i, i + READ_BATCH);
      const texts = await Promise.all(batch.map((f) => read(f, trusted)));
      for (let j = 0; j < batch.length; j++) {
        if (texts[j] === null) continue;
        if (onFile(batch[j], texts[j]) === false) { scheduleSave(); return; }
      }
    }
    scheduleSave();
  }

  // Aviso del vigilante (mismo payload que 'folder:changed').
  function onFolderChanged(payload) {
    if (payload.root !== watchedRoot) return;
    if (payload.structural) listCache = null;
    payload.changes.forEach((c) => dirty.add(c.path));
  }

  let cacheReady = null;

  function setWatchedRoot(root) {
    if (root === watchedRoot) return;
    if (watchedRoot && changedSinceSave) saveCache(); // guardar lo de la carpeta anterior
    watchedRoot = root || null;
    cacheReady = watchedRoot ? loadCache(watchedRoot) : null;
    listCache = null;
    dirty.clear();
    // Lo de otras carpetas no sirve más: liberar memoria.
    for (const p of Array.from(contents.keys())) {
      if (!watchedRoot || !p.startsWith(watchedRoot + path.sep)) {
        totalBytes -= contents.get(p).size;
        contents.delete(p);
      }
    }
  }

  return { walk, files, onFolderChanged, setWatchedRoot, saveCache, stats: () => ({ ...stats, cached: contents.size, bytes: totalBytes }) };
}

module.exports = { createFolderIndex, TEXT_EXT };
