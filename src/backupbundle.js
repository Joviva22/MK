'use strict';

// Respaldo de todo lo de MK que NO está en la carpeta de notas (las notas ya
// son archivos tuyos): ajustes (config.json, incluye la mascota), tareas del
// Home (home.json) e imágenes de las mascotas (pet/). Un solo JSON legible,
// con las imágenes en base64.
//
// Lo que NO va: la contraseña del correo (está cifrada con el llavero de ESTE
// equipo; en otro no se podría descifrar), la sesión (pestañas abiertas),
// cachés y logs.

const fs = require('fs');
const path = require('path');

const FORMAT = 'mk-backup';
const VERSION = 1;
const MAX_PET_FILE = 5 * 1024 * 1024;
// Claves de config que son de este equipo y no tienen sentido en otro.
const LOCAL_KEYS = ['windowBounds', 'lastUpdateCheck'];
const PET_FILE_RE = /^[a-z0-9-]{1,40}\/(etapa[123]\.(png|gif|webp|jpe?g|svg)|meta\.json)$/;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function listPetFiles(petDir) {
  const out = [];
  let ids = [];
  try {
    ids = fs.readdirSync(petDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return out;
  }
  for (const id of ids) {
    let names = [];
    try {
      names = fs.readdirSync(path.join(petDir, id));
    } catch {
      continue;
    }
    for (const name of names) {
      const rel = `${id}/${name}`;
      if (PET_FILE_RE.test(rel)) out.push(rel);
    }
  }
  return out;
}

// dir = userData. Devuelve el objeto del respaldo.
function buildBundle(dir, appVersion) {
  const config = readJson(path.join(dir, 'config.json'), {}) || {};
  LOCAL_KEYS.forEach((k) => delete config[k]);
  const petDir = path.join(dir, 'pet');
  const pet = {};
  for (const rel of listPetFiles(petDir)) {
    const full = path.join(petDir, rel);
    try {
      if (fs.statSync(full).size > MAX_PET_FILE) continue;
      pet[rel] = fs.readFileSync(full).toString('base64');
    } catch {
      // desapareció mientras tanto
    }
  }
  return {
    format: FORMAT,
    version: VERSION,
    appVersion: appVersion || '',
    created: new Date().toISOString(),
    config,
    home: readJson(path.join(dir, 'home.json'), null),
    pet
  };
}

// Revisa un respaldo leído de disco. { ok, error?, summary? }
function validateBundle(data) {
  if (!data || typeof data !== 'object' || data.format !== FORMAT) return { ok: false, error: 'No es un respaldo de MK.' };
  if (typeof data.version !== 'number' || data.version > VERSION) return { ok: false, error: 'El respaldo es de una versión más nueva de MK: actualizá MK primero.' };
  if (!data.config || typeof data.config !== 'object' || Array.isArray(data.config)) return { ok: false, error: 'El respaldo está dañado (ajustes).' };
  if (data.home !== null && data.home !== undefined && typeof data.home !== 'object') return { ok: false, error: 'El respaldo está dañado (Home).' };
  const pet = data.pet && typeof data.pet === 'object' ? data.pet : {};
  for (const [rel, b64] of Object.entries(pet)) {
    if (!PET_FILE_RE.test(rel) || typeof b64 !== 'string') return { ok: false, error: 'El respaldo está dañado (mascotas).' };
  }
  const home = data.home || {};
  const tasks = Array.isArray(home.tasks) ? home.tasks.length : 0;
  const pets = data.config.pet && Array.isArray(data.config.pet.pets) ? data.config.pet.pets.length : 0;
  return {
    ok: true,
    summary: {
      created: String(data.created || ''),
      appVersion: String(data.appVersion || ''),
      tasks,
      pets,
      images: Object.keys(pet).length,
      settings: Object.keys(data.config).length
    }
  };
}

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// Reemplaza ajustes, Home e imágenes de mascotas de dir con los del respaldo.
// Las claves locales de este equipo (ventana) se conservan.
function restoreBundle(dir, data) {
  const check = validateBundle(data);
  if (!check.ok) throw new Error(check.error);
  const current = readJson(path.join(dir, 'config.json'), {}) || {};
  const config = { ...data.config };
  LOCAL_KEYS.forEach((k) => {
    if (k in current) config[k] = current[k];
    else delete config[k];
  });
  fs.mkdirSync(dir, { recursive: true });
  writeAtomic(path.join(dir, 'config.json'), JSON.stringify(config, null, 2));
  if (data.home) writeAtomic(path.join(dir, 'home.json'), JSON.stringify(data.home, null, 2));
  const petDir = path.join(dir, 'pet');
  fs.rmSync(petDir, { recursive: true, force: true });
  for (const [rel, b64] of Object.entries(data.pet || {})) {
    const full = path.join(petDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, Buffer.from(b64, 'base64'));
  }
  return check.summary;
}

module.exports = { buildBundle, validateBundle, restoreBundle, FORMAT, VERSION };
