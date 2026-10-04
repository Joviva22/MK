'use strict';

// Corrector ortográfico (ver spellchecker.js): el renderer manda palabras
// sueltas (ya separadas del código, enlaces, etc. — ver spellcheck.js) y acá
// se decide cuáles están mal y qué sugerir, con un diccionario propio que
// aprende las que el usuario agrega ("Agregar al diccionario" del menú).

const { ipcMain } = require('electron');
const ctx = require('./mainctx');
const sp = require('./spellchecker');

let ready = false;
let broken = false;

function ensureReady() {
  if (ready || broken) return;
  try {
    sp.loadSpeller();
    const config = ctx.loadConfig();
    sp.addWords(Array.isArray(config.spellWords) ? config.spellWords : []);
    ready = true;
  } catch (e) {
    broken = true;
    ctx.logError('spellcheck:init', e);
  }
}

ipcMain.handle('spellcheck:check', (event, words) => {
  ensureReady();
  if (!ready) return [];
  try {
    return sp.checkWords(Array.isArray(words) ? words.slice(0, 5000) : []);
  } catch (e) {
    ctx.logError('spellcheck:check', e);
    return [];
  }
});

ipcMain.handle('spellcheck:suggest', (event, word) => {
  ensureReady();
  if (!ready) return [];
  try {
    return sp.suggest(word);
  } catch (e) {
    ctx.logError('spellcheck:suggest', e);
    return [];
  }
});

ipcMain.handle('spellcheck:learn', (event, word) => {
  const w = typeof word === 'string' ? word.trim() : '';
  if (!w) return { ok: false };
  ensureReady();
  try {
    sp.addWords([w]);
    const config = ctx.loadConfig();
    const words = Array.isArray(config.spellWords) ? config.spellWords.slice() : [];
    if (!words.includes(w)) {
      words.push(w);
      ctx.saveConfig({ ...config, spellWords: words });
    }
    return { ok: true };
  } catch (e) {
    ctx.logError('spellcheck:learn', e);
    return { ok: false };
  }
});
