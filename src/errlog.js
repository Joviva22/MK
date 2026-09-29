'use strict';

// Registro local de errores (proceso principal): userData/logs/mk.log, una
// línea por error con fecha, dónde pasó y el mensaje. Rota a mk.log.1 al
// pasar MAX_BYTES. Nunca tira: si no se puede escribir el log, se sigue.
//
// Para los catch que antes se tragaban el error en silencio (guardar,
// bases de datos, importar...): el usuario igual ve un mensaje, y acá
// queda el detalle para diagnosticar.

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;
let logDir = null;

function init(userDataDir) {
  logDir = path.join(userDataDir, 'logs');
}

function logFile() {
  return logDir ? path.join(logDir, 'mk.log') : null;
}

function logError(where, err) {
  const file = logFile();
  if (!file) return;
  const msg = err && err.stack ? err.stack : String(err);
  const line = `${new Date().toISOString()} [${where}] ${msg.replace(/\n/g, '\n    ')}\n`;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    try {
      if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, file + '.1');
    } catch {
      // todavía no existe
    }
    fs.appendFileSync(file, line, 'utf-8');
  } catch {
    // sin log no se rompe nada más
  }
}

// JSON a disco sin riesgo de dejarlo a medias: temporal + rename.
function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, file);
}

// Lee JSON; si está dañado lo aparta (file.corrupt-<fecha>) y lo registra,
// en vez de que el próximo guardado lo pise con valores por defecto.
function readJsonSafe(file, fallback) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch {
    return fallback; // no existe todavía
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    const aside = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try {
      fs.renameSync(file, aside);
    } catch {
      // si no se puede apartar, al menos queda en el log
    }
    logError(`json:${path.basename(file)}`, `JSON dañado, apartado como ${path.basename(aside)}: ${e.message}`);
    return fallback;
  }
}

module.exports = { init, logError, logFile, writeJsonAtomic, readJsonSafe };
