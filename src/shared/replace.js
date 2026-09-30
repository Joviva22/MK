// Buscar y reemplazar en varios archivos (replacefolder.js / ipc-notes.js):
// arma la expresión según las opciones y calcula el resultado y una vista
// previa por archivo. Ventana: window.mdReplace. Node: proceso principal y
// pruebas unitarias.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mdReplace = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  const MAX_SAMPLES = 3;

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // opts: { caseSensitive, wholeWord, regex }. Devuelve { re } o { error }.
  function buildMatcher(find, opts) {
    const o = opts || {};
    if (!find) return { error: 'Escribí qué buscar.' };
    let source = o.regex ? find : escapeRegExp(find);
    if (o.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
    try {
      const re = new RegExp(source, `gu${o.caseSensitive ? '' : 'i'}`);
      if (re.test('')) return { error: 'La expresión coincide con texto vacío.' };
      re.lastIndex = 0;
      return { re };
    } catch (e) {
      return { error: `Expresión regular inválida: ${e.message}` };
    }
  }

  // Sin regex, el reemplazo es literal ("$1" no se interpreta).
  function replacementFn(replacement, opts) {
    if (opts && opts.regex) return replacement;
    return () => replacement;
  }

  // { count, output, samples: [{ line, before, after }] }
  function replaceIn(text, re, replacement, opts) {
    re.lastIndex = 0;
    let count = 0;
    const counter = new RegExp(re.source, re.flags);
    while (counter.exec(text)) count++;
    if (!count) return { count: 0, output: text, samples: [] };
    const output = text.replace(re, replacementFn(replacement, opts));
    const samples = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && samples.length < MAX_SAMPLES; i++) {
      const lineRe = new RegExp(re.source, re.flags);
      if (lineRe.test(lines[i])) {
        lineRe.lastIndex = 0;
        samples.push({ line: i + 1, before: lines[i].trim().slice(0, 200), after: lines[i].replace(lineRe, replacementFn(replacement, opts)).trim().slice(0, 200) });
      }
    }
    return { count, output, samples };
  }

  return { buildMatcher, replaceIn, escapeRegExp };
});
