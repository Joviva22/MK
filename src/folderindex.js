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

const TEXT_EXT = /\.(md|markdown|txt|tex)$/i;
const READ_BATCH = 16;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

function createFolderIndex() {
  const contents = new Map(); // ruta -> { mtimeMs, size, content }
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
    if (cached && trusted && !dirty.has(filePath)) {
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
    return content;
  }

  // Llama onFile(ruta, contenido) para cada archivo de texto de root, en
  // orden (en profundidad, como siempre). Si onFile devuelve false, corta.
  async function walk(root, onFile) {
    const trusted = root === watchedRoot;
    const list = await files(root);
    for (let i = 0; i < list.length; i += READ_BATCH) {
      const batch = list.slice(i, i + READ_BATCH);
      const texts = await Promise.all(batch.map((f) => read(f, trusted)));
      for (let j = 0; j < batch.length; j++) {
        if (texts[j] === null) continue;
        if (onFile(batch[j], texts[j]) === false) return;
      }
    }
  }

  // Aviso del vigilante (mismo payload que 'folder:changed').
  function onFolderChanged(payload) {
    if (payload.root !== watchedRoot) return;
    if (payload.structural) listCache = null;
    payload.changes.forEach((c) => dirty.add(c.path));
  }

  function setWatchedRoot(root) {
    if (root === watchedRoot) return;
    watchedRoot = root || null;
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

  return { walk, files, onFolderChanged, setWatchedRoot, stats: () => ({ ...stats, cached: contents.size, bytes: totalBytes }) };
}

module.exports = { createFolderIndex, TEXT_EXT };
