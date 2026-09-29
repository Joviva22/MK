'use strict';

// Vigila la carpeta abierta (proceso principal): cuando algo cambia afuera
// de MK — git, otra app, una IA en la terminal — avisa al renderer para que
// el árbol y las pestañas se actualicen solos, sin el botón 🔄.
//
// Un fs.watch por carpeta (no { recursive: true }: en Linux ese vigila
// también node_modules/.git sin poder filtrarlos). Se saltan las mismas
// entradas que el árbol del sidebar (las que empiezan con ".") y
// node_modules, con un tope de carpetas para no agotar los inotify del
// sistema en árboles enormes. Los eventos se juntan y se mandan como mucho
// cada DEBOUNCE_MS.

const fs = require('fs');
const path = require('path');

const SKIP_NAMES = new Set(['node_modules']);
const MAX_DIRS = 3000;
const DEBOUNCE_MS = 250;

function skipName(name) {
  return name.startsWith('.') || SKIP_NAMES.has(name);
}

function createFolderWatcher(onChange) {
  const watchers = new Map(); // carpeta -> FSWatcher
  const pending = new Map(); // ruta -> 'rename' | 'change'
  let root = null;
  let timer = null;

  function watchDir(dir) {
    if (watchers.has(dir) || watchers.size >= MAX_DIRS) return;
    let watcher;
    try {
      watcher = fs.watch(dir, (type, name) => onEvent(dir, type, name));
    } catch {
      return; // sin permiso, o se borró justo
    }
    watcher.on('error', () => unwatchUnder(dir));
    watchers.set(dir, watcher);
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !skipName(entry.name)) watchDir(path.join(dir, entry.name));
    }
  }

  function unwatchUnder(dir) {
    for (const [d, w] of watchers) {
      if (d === dir || d.startsWith(dir + path.sep)) {
        w.close();
        watchers.delete(d);
      }
    }
  }

  function onEvent(dir, type, name) {
    if (!root) return;
    if (!name) {
      schedule(dir, 'rename');
      return;
    }
    const base = String(name);
    if (skipName(base)) return; // .swp, .git, .mk (el Home), node_modules...
    const full = path.join(dir, base);
    if (type === 'rename') {
      // Apareció o desapareció algo: si es una carpeta nueva, vigilarla;
      // si ya no existe, soltar sus watchers.
      let stat = null;
      try {
        stat = fs.statSync(full);
      } catch {
        stat = null;
      }
      if (stat && stat.isDirectory()) watchDir(full);
      else if (!stat) unwatchUnder(full);
    }
    schedule(full, type);
  }

  function schedule(p, type) {
    pending.set(p, pending.get(p) === 'rename' ? 'rename' : type);
    // Sin reiniciar el timer: con escrituras continuas (un build) igual
    // avisa cada DEBOUNCE_MS en vez de nunca.
    if (!timer) timer = setTimeout(flush, DEBOUNCE_MS);
  }

  function flush() {
    timer = null;
    if (!root || !pending.size) return;
    const changes = Array.from(pending, ([p, type]) => ({ path: p, type }));
    pending.clear();
    onChange({ root, changes, structural: changes.some((c) => c.type === 'rename') });
  }

  function start(newRoot) {
    stop();
    if (!newRoot) return { dirs: 0, limited: false };
    root = newRoot;
    watchDir(newRoot);
    return { dirs: watchers.size, limited: watchers.size >= MAX_DIRS };
  }

  function stop() {
    for (const w of watchers.values()) w.close();
    watchers.clear();
    pending.clear();
    clearTimeout(timer);
    timer = null;
    root = null;
  }

  return { start, stop, currentRoot: () => root };
}

module.exports = { createFolderWatcher, MAX_DIRS };
