'use strict';

// Corrector ortográfico en español, offline: diccionario Hunspell de
// dictionary-es (LibreOffice) cargado con nspell. Nada de spellchecker
// nativo de Chromium (necesita idioma configurado y no se ve en CodeMirror,
// que dibuja su propio texto encima de un textarea invisible).

const fs = require('fs');
const path = require('path');

let speller = null;

// forTests: instancia de nspell ya armada, para no cargar el diccionario real
// (pesado) en la suite unitaria — ver test/unit/spellchecker.test.js.
function loadSpeller(forTests) {
  if (forTests) { speller = forTests; return speller; }
  if (speller) return speller;
  const nspell = require('nspell');
  const dir = path.dirname(require.resolve('dictionary-es'));
  const aff = fs.readFileSync(path.join(dir, 'index.aff'));
  const dic = fs.readFileSync(path.join(dir, 'index.dic'));
  speller = nspell({ aff, dic });
  return speller;
}

function addWords(words) {
  const s = loadSpeller();
  (Array.isArray(words) ? words : []).forEach((w) => {
    if (typeof w === 'string' && w) s.add(w);
  });
}

// Devuelve, de una lista de palabras, cuáles no están en el diccionario.
// Una palabra en minúscula válida hace correcta cualquier variante de
// mayúsculas (nombre propio, inicio de oración).
function checkWords(words) {
  const s = loadSpeller();
  const out = [];
  const seen = new Set();
  (Array.isArray(words) ? words : []).forEach((w) => {
    if (typeof w !== 'string' || !w || seen.has(w)) return;
    seen.add(w);
    if (!s.correct(w) && !s.correct(w.toLowerCase())) out.push(w);
  });
  return out;
}

function suggest(word) {
  if (typeof word !== 'string' || !word) return [];
  const s = loadSpeller();
  return s.suggest(word).slice(0, 6);
}

module.exports = { loadSpeller, addWords, checkWords, suggest };
