'use strict';

// Personajes de un juego de RPG Maker / Pokémon Essentials (ver ipc-pet.js):
// carpeta Graphics/Characters con hojas de caminata 4×4 y, si está,
// PBS/pokemon.txt con nombres, evoluciones y cuáles son legendarios.
// Sin Electron: lo prueban las pruebas unitarias (test/unit).

const path = require('path');
const fs = require('fs');
const os = require('os');

const ID_RE = /^[A-Za-z0-9_-]+$/;

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
  const dir = path.join(charDir, '..', '..', 'PBS');
  let files;
  try { files = fs.readdirSync(dir).filter((f) => /^(?:pokemon(?:_[A-Za-z0-9_-]+)?|pokemonforms)\.txt$/i.test(f)).sort((a, b) => Number(/forms/i.test(a)) - Number(/forms/i.test(b)) || a.localeCompare(b)); }
  catch { return species; }
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(path.join(dir, file), 'utf-8'); } catch { continue; }
    let cur = null;
    text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw) => {
      const line = raw.replace(/#.*/, '').trim();
      const h = line.match(/^\[([A-Za-z0-9_-]+)(?:\s*,\s*(\d+))?\]$/);
      if (h) {
        const base = h[1].toUpperCase();
        const form = Number(h[2]) || 0;
        const id = form ? `${base}_${form}` : base;
        cur = { id, base, form, name: '', formName: '', evos: null, legendary: null };
        species.set(id, cur);
        return;
      }
      if (!cur) return;
      const property = line.match(/^([A-Za-z]+)\s*=\s*(.*)$/);
      if (!property) return;
      const [, key, value] = property;
      if (key === 'InternalName' && ID_RE.test(value)) {
        species.delete(cur.id);
        cur.id = cur.base = value.toUpperCase();
        species.set(cur.id, cur);
      }
      if (key === 'Name') cur.name = value;
      if (key === 'FormName') cur.formName = value;
      if (/^Evolutions?$/.test(key)) {
        cur.evos = [];
        const parts = value.split(',').map((x) => x.trim());
        for (let i = 0; i < parts.length; i += 3) if (ID_RE.test(parts[i])) cur.evos.push(parts[i].toUpperCase());
      }
      if (key === 'Flags') cur.legendary = /\b(Legendary|Mythical)\b/i.test(value);
    });
  }
  const rawNames = new Map([...species].map(([id, s]) => [id, s.name]));
  species.forEach((s) => {
    const base = s.form ? species.get(s.base) : null;
    s.name = s.name || rawNames.get(s.base) || s.base;
    if (s.formName) s.name += ` (${s.formName})`;
    s.evos = s.evos ?? base?.evos ?? [];
    s.legendary = s.legendary ?? base?.legendary ?? false;
  });
  return species;
}

// Conserva el nombre real del archivo (incluida extensión/mayúsculas).
function charSpritePath(charDir, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const filename = fs.readdirSync(charDir).find((f) => f.toLowerCase() === `${id}.png`.toLowerCase());
  return filename ? path.join(charDir, filename) : null;
}

// Líneas evolutivas (todas las ramas, hasta 3 etapas) de las formas base
// con sprite. legendary: la forma base es legendaria o singular.
function charCatalog(charDir) {
  if (!isDir(charDir)) return { error: 'Esa carpeta no existe.' };
  const files = new Map();
  fs.readdirSync(charDir, { withFileTypes: true }).forEach((f) => {
    const m = f.name.match(/^([A-Za-z0-9_-]+)\.png$/i);
    if (f.isFile() && m && !files.has(m[1].toUpperCase())) files.set(m[1].toUpperCase(), m[1]);
  });
  const species = readPbs(charDir);
  const lines = [];
  if (species.size) {
    const nextIds = (id) => {
      const s = species.get(id);
      return (s?.evos || []).map((target) => {
        if (s.form && s.formName) {
          const sameForm = [...species.values()].find((candidate) => candidate.form && candidate.base === target && candidate.formName.toLowerCase() === s.formName.toLowerCase());
          if (sameForm) return sameForm.id;
        }
        return target;
      }).filter((target) => files.has(target));
    };
    const targets = new Set();
    files.forEach((_, id) => nextIds(id).forEach((e) => targets.add(e)));
    files.forEach((_, id) => {
      if (targets.has(id)) return;
      const s = species.get(id);
      const chains = [];
      const walk = (chain) => {
        const nexts = chain.length < 3 ? nextIds(chain[chain.length - 1]).filter((e) => !chain.includes(e)) : [];
        if (!nexts.length) chains.push(chain);
        else nexts.forEach((e) => walk([...chain, e]));
      };
      walk([id]);
      const seen = new Set();
      chains.forEach((chain) => {
        if (chain.length < 2) return;
        const key = chain.join('>');
        if (seen.has(key)) return;
        seen.add(key);
        lines.push({ ids: chain.map((c) => files.get(c)), names: chain.map((c) => species.get(c)?.name || files.get(c)), legendary: !!s?.legendary, single: false });
      });
    });
  }
  // Cada sprite se puede elegir directamente, aunque sea una evolución,
  // forma regional, especie futura o personaje ausente del PBS.
  files.forEach((actualId, id) => lines.push({ ids: [actualId], names: [species.get(id)?.name || actualId], legendary: !!species.get(id)?.legendary, single: true }));
  lines.sort((a, b) => a.names[0].localeCompare(b.names[0]));
  return { dir: charDir, lines, total: files.size, withEvolutions: species.size > 0, legendaries: lines.filter((l) => l.legendary).length };
}

module.exports = { isDir, findCharDirs, readPbs, charCatalog, charSpritePath, ID_RE };
