(function () {
'use strict';

// Modo máquina de escribir (Ajustes → Editor, Ctrl+Alt+M, paleta): la línea
// del cursor queda siempre en el centro vertical del editor, como en una
// máquina de escribir; y, aparte, "atenuar los otros párrafos": solo el
// párrafo del cursor (líneas seguidas sin una en blanco) con color pleno.
// Se combinan bien con el modo enfoque (Ctrl+Shift+E).

const cm = window.mdCodeMirror;
const typewriterToggle = document.getElementById('typewriter-toggle');
const dimToggle = document.getElementById('dimparagraphs-toggle');
let typewriter = false;
let dim = false;
let marked = null; // { doc, from, to } — líneas con la clase del párrafo actual
const CLASS = 'mk-current-para';

function center() {
  if (!typewriter || cm.somethingSelected()) return;
  const info = cm.getScrollInfo();
  const { top, bottom } = cm.charCoords(cm.getCursor(), 'local');
  cm.scrollTo(null, Math.max(0, (top + bottom) / 2 - info.clientHeight / 2));
}

// Por handle (no por número de línea): si se insertan líneas arriba, los
// números cambian pero el handle sigue siendo la misma línea.
function unmark() {
  if (!marked) return;
  const { doc, handles } = marked;
  handles.forEach((h) => doc.removeLineClass(h, 'wrap', CLASS));
  marked = null;
}

function paragraphAt(doc, line) {
  const blank = (n) => !doc.getLine(n).trim();
  if (blank(line)) return { from: line, to: line };
  let from = line;
  let to = line;
  while (from > 0 && !blank(from - 1)) from--;
  while (to < doc.lineCount() - 1 && !blank(to + 1)) to++;
  return { from, to };
}

function mark() {
  if (!dim) return;
  const doc = cm.getDoc();
  const { from, to } = paragraphAt(doc, doc.getCursor().line);
  const handles = [];
  for (let i = from; i <= to; i++) handles.push(doc.getLineHandle(i));
  if (marked && marked.doc === doc && marked.handles.length === handles.length && marked.handles.every((h, i) => h === handles[i])) return;
  cm.operation(() => {
    unmark();
    handles.forEach((h) => doc.addLineClass(h, 'wrap', CLASS));
  });
  marked = { doc, handles };
}

function apply() {
  document.body.classList.toggle('mk-typewriter', typewriter);
  document.body.classList.toggle('mk-dim-paragraphs', dim);
  if (typewriterToggle) typewriterToggle.checked = typewriter;
  if (dimToggle) dimToggle.checked = dim;
  if (dim) mark(); else unmark();
  cm.refresh(); // el relleno de arriba/abajo cambia el alto del contenido
  center();
}

async function set(partial) {
  if ('typewriter' in partial) typewriter = !!partial.typewriter;
  if ('dim' in partial) dim = !!partial.dim;
  apply();
  await window.mdEditor.setConfig({ typewriterMode: typewriter, dimParagraphs: dim });
}

cm.on('cursorActivity', () => {
  mark();
  // Después de que CodeMirror haga su propio scroll al cursor.
  if (typewriter) requestAnimationFrame(center);
});
// Otra pestaña: se limpian las marcas del documento anterior (marked.doc).
cm.on('swapDoc', () => {
  unmark();
  mark();
  center();
});
window.addEventListener('resize', center);

if (typewriterToggle) typewriterToggle.addEventListener('change', () => set({ typewriter: typewriterToggle.checked }));
if (dimToggle) dimToggle.addEventListener('change', () => set({ dim: dimToggle.checked }));

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    set({ typewriter: !typewriter });
  }
});

(async () => {
  const config = await window.mdEditor.getConfig();
  typewriter = !!config.typewriterMode;
  dim = !!config.dimParagraphs;
  if (typewriter || dim) apply();
})();

window.mdTypewriter = { set, isOn: () => typewriter, isDim: () => dim, paragraphAt };

})();
