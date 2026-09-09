(function () {
'use strict';

const cm = window.mdCodeMirror;

// Los dinámicos siempre están disponibles; los propios del usuario se
// cargan de config.json (ver settings.js, textarea "Snippets de texto").
const BUILTIN_SNIPPETS = {
  '/fecha': () => new Date().toLocaleDateString(),
  '/hora': () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

let userSnippets = {};

function allSnippets() {
  return Object.assign({}, BUILTIN_SNIPPETS, userSnippets);
}

// Se dispara al escribir espacio/Enter/Tab justo después de un "/abrev"
// conocido: lo reemplaza por su expansión.
function tryExpand() {
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  const before = line.slice(0, cursor.ch);
  const match = before.match(/(\/[a-záéíóúñA-ZÁÉÍÓÚÑ]+)$/);
  if (!match) return false;
  const trigger = match[1];
  const snippets = allSnippets();
  if (!(trigger in snippets)) return false;
  const value = snippets[trigger];
  const expansion = typeof value === 'function' ? value() : value;
  const from = { line: cursor.line, ch: cursor.ch - trigger.length };
  cm.replaceRange(expansion, from, cursor);
  return true;
}

cm.on('keydown', (instance, e) => {
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab') {
    if (tryExpand() && e.key === 'Tab') e.preventDefault();
  }
});

async function reloadUserSnippets() {
  const config = await window.mdEditor.getConfig();
  userSnippets = config.textSnippets || {};
}

reloadUserSnippets();

window.mdSnippets = { reload: reloadUserSnippets };

})();
