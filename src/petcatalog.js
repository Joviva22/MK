'use strict';

// Personajes de un juego de RPG Maker / Pokémon Essentials (ver ipc-pet.js):
// carpeta Graphics/Characters con hojas de caminata 4×4 y, si está,
// PBS/pokemon.txt con nombres, evoluciones y cuáles son legendarios.
// Sin Electron: lo prueban las pruebas unitarias (test/unit).

const path = require('path');
const fs = require('fs');
const os = require('os');

const ID_RE = /^[A-Za-z0-9_]+$/;

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findCharDirs(home) {
  const found = [];
  ['Descargas', 'Downloads', 'Documentos', 'Documents', 'Juegos', 'Games'].forEach((d) => {
    const base = path.join(home || os.homedir(), d);
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

module.exports = { isDir, findCharDirs, readPbs, charCatalog, ID_RE };
