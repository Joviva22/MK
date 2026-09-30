'use strict';

// Versión de los archivos de datos y migraciones automáticas al cargarlos.
// Cada archivo guarda `schemaVersion`; al abrirlo con una versión vieja se
// aplican los pasos que faltan, en orden (1 → 2 → …). Así se puede cambiar
// un formato sin romper los datos de antes. SQLite usa PRAGMA user_version
// (ver dbengine.js) con la misma idea.
//
// Para cambiar un formato: subir CONFIG_VERSION (o HOME_VERSION) y agregar
// el paso `N: (data) => ({ ...data, … })` que lleva de N-1 a N. Si el
// archivo es de una versión MÁS NUEVA de MK (tooNew), no se toca: se usa
// como está (los campos desconocidos se conservan al guardar).

const CONFIG_VERSION = 1;
const HOME_VERSION = 1;

// 0 → 1: solo marca la versión (los archivos de antes no la tenían).
const CONFIG_STEPS = { 1: (c) => c };
const HOME_STEPS = { 1: (h) => h };

function runMigrations(data, steps, target) {
  const obj = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const from = Number.isInteger(obj.schemaVersion) ? obj.schemaVersion : 0;
  if (from > target) return { data: obj, from, to: from, changed: false, tooNew: true };
  let out = obj;
  for (let v = from + 1; v <= target; v++) {
    if (typeof steps[v] !== 'function') throw new Error(`Falta la migración a la versión ${v}`);
    out = steps[v]({ ...out });
    out.schemaVersion = v;
  }
  return { data: out, from, to: target, changed: from !== target, tooNew: false };
}

const migrateConfig = (data) => runMigrations(data, CONFIG_STEPS, CONFIG_VERSION);
const migrateHome = (data) => runMigrations(data, HOME_STEPS, HOME_VERSION);

module.exports = { runMigrations, migrateConfig, migrateHome, CONFIG_VERSION, HOME_VERSION };
