(function () {
'use strict';

// Corrector ortográfico en español (ver spellchecker.js / ipc-spellcheck.js
// en el proceso principal, con nspell + diccionario Hunspell offline).
// Subraya con onda las palabras que no están en el diccionario; el menú
// contextual (contextmenu.js) ofrece sugerencias y "Agregar al diccionario".
// Solo corre en notas Markdown, no en archivos de código.

const cm = window.mdCodeMirror;
const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/g;
const MAX_CHARS = 200000; // notas enormes: no vale la pena, se saltea
const DEBOUNCE_MS = 700;

let marks = [];
let timer = null;
let runToken = 0;

function isProse() {
  return cm.getOption('mode') === 'markdown';
}

function clearMarks() {
  cm.operation(() => marks.forEach((m) => m.clear()));
  marks = [];
}

function isAcronym(word) {
  return word === word.toUpperCase() && word !== word.toLowerCase();
}

// Palabras con su rango {line, from, to}. Lo que no es prosa (bloques y
// tramos de código, enlaces, HTML, wikilinks) se pisa con espacios en vez de
// borrarse, para no correr las columnas del resto de la línea.
function collectOccurrences() {
  const occ = [];
  let inFence = false;
  const total = cm.lineCount();
  for (let ln = 0; ln < total; ln++) {
    let line = cm.getLine(ln);
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    line = line
      .replace(/`[^`]*`/g, (m) => ' '.repeat(m.length))
      .replace(/https?:\/\/\S+|www\.\S+/gi, (m) => ' '.repeat(m.length))
      .replace(/<[^>]+>/g, (m) => ' '.repeat(m.length))
      .replace(/\[\[[^\]]*\]\]/g, (m) => ' '.repeat(m.length))
      .replace(/\]\([^)]*\)/g, (m) => ' '.repeat(m.length));
    WORD_RE.lastIndex = 0;
    let match;
    while ((match = WORD_RE.exec(line))) {
      const word = match[0];
      if (isAcronym(word)) continue;
      occ.push({ line: ln, from: match.index, to: match.index + word.length, word });
    }
  }
  return occ;
}

async function check() {
  if (!isProse()) { clearMarks(); return; }
  if (cm.getValue().length > MAX_CHARS) { clearMarks(); return; }
  const occ = collectOccurrences();
  const unique = [...new Set(occ.map((o) => o.word))];
  const token = ++runToken;
  const owner = cm.getDoc();
  if (!unique.length) { clearMarks(); return; }
  let wrong;
  try {
    wrong = await window.mdEditor.spell.check(unique);
  } catch {
    return;
  }
  if (token !== runToken || owner !== cm.getDoc()) return;
  cm.operation(() => {
    clearMarks();
    if (!wrong || !wrong.length) return;
    const bad = new Set(wrong);
    occ.forEach((o) => {
      if (!bad.has(o.word)) return;
      marks.push(cm.markText({ line: o.line, ch: o.from }, { line: o.line, ch: o.to }, { className: 'cm-spell-error' }));
    });
  });
}

function schedule() {
  runToken++;
  clearTimeout(timer);
  timer = setTimeout(check, DEBOUNCE_MS);
}

cm.on('change', schedule);
cm.on('swapDoc', () => { clearMarks(); schedule(); });
schedule();

// contextmenu.js: sugerencias + "agregar al diccionario" para la palabra
// bajo el clic derecho, y volver a revisar después de aceptar una.
window.mdSpellcheck = {
  suggestionsFor: async (word) => {
    if (!word) return [];
    const wrong = await window.mdEditor.spell.check([word]);
    if (!wrong || !wrong.length) return null;
    const suggestions = await window.mdEditor.spell.suggest(word);
    return { word, suggestions: suggestions || [] };
  },
  learn: async (word) => {
    await window.mdEditor.spell.learn(word);
    schedule();
  },
  recheck: schedule
};

})();
