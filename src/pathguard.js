'use strict';

// Frontera de rutas del proceso principal: qué archivos puede leer, escribir
// o borrar la ventana. Antes cada IPC aceptaba cualquier ruta que mandara la
// interfaz (y md-local:// servía cualquier archivo del disco); ahora solo lo
// que está dentro de algo que el USUARIO abrió:
//
// - la carpeta abierta (diálogo "Carpeta", la última usada, o subir con "..");
// - archivos elegidos en un diálogo, pasados por argumento, arrastrados desde
//   el sistema o restaurados de la sesión (y la carpeta donde están, para
//   sus imágenes);
// - los backups de MK (userData).
//
// Límite honesto: la terminal integrada puede ejecutar lo que sea, así que
// esto NO frena a una ventana comprometida por completo — esa barrera es la
// CSP + sandbox + DOMPurify. Esto es la segunda capa: acota bugs propios y
// lo que un documento malicioso pueda pedir sin llegar a ejecutar código.

const path = require('path');

const dirs = new Set();

function norm(p) {
  return typeof p === 'string' && p && path.isAbsolute(p) ? path.resolve(p) : null;
}

function inside(dir, p) {
  const rel = path.relative(dir, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function grantDir(p) {
  const n = norm(p);
  if (n) dirs.add(n);
}

function grantFile(p) {
  const n = norm(p);
  if (n) dirs.add(path.dirname(n));
}

function isAllowed(p) {
  const n = norm(p);
  if (!n) return false;
  for (const d of dirs) if (inside(d, n)) return true;
  return false;
}

// "Subir a la carpeta superior": una carpeta que contiene a una autorizada.
function isAncestorOfGranted(p) {
  const n = norm(p);
  if (!n) return false;
  for (const d of dirs) if (inside(n, d)) return true;
  return false;
}

// Para los IPC: devuelve true o registra el intento y devuelve false.
let onDenied = null;
function check(p, what) {
  if (isAllowed(p)) return true;
  if (onDenied) onDenied(what, p);
  return false;
}

function setOnDenied(fn) {
  onDenied = fn;
}

module.exports = { grantDir, grantFile, isAllowed, isAncestorOfGranted, check, setOnDenied, _dirs: dirs };
