(function () {
'use strict';

// Carga bajo demanda de librerías grandes que la mayoría de las sesiones no
// usan: antes iban como <script> en index.html y se descargaban/compilaban
// en CADA arranque (~6 MB de JS: Mermaid 3,5 MB, docx 1,1 MB, mammoth
// 620 KB, xterm 550 KB). Ahora se cargan la primera vez que hacen falta.
//
//   await window.mdLoadLib('mermaid')  →  window.mermaid listo
//
// Cada archivo se pide una sola vez (las llamadas simultáneas comparten la
// misma promesa); si falla, se puede reintentar.

const LIBS = {
  drawing: ['drawing-bundle.js'],
  mermaid: ['../node_modules/mermaid/dist/mermaid.min.js'],
  docx: ['../node_modules/docx/dist/index.iife.js'],
  mammoth: ['../node_modules/mammoth/mammoth.browser.min.js'],
  xterm: [
    '../node_modules/@xterm/xterm/lib/xterm.js',
    '../node_modules/@xterm/addon-fit/lib/addon-fit.js',
    '../node_modules/@xterm/addon-search/lib/addon-search.js'
  ]
};

const pending = new Map(); // src → Promise

function loadScript(src) {
  if (!pending.has(src)) {
    pending.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => {
        pending.delete(src);
        reject(new Error(`No se pudo cargar ${src}`));
      };
      document.head.appendChild(s);
    }));
  }
  return pending.get(src);
}

async function mdLoadLib(name) {
  const files = LIBS[name];
  if (!files) throw new Error(`Librería desconocida: ${name}`);
  // En orden: los addons de xterm necesitan xterm cargado antes.
  for (const src of files) await loadScript(src);
}

window.mdLoadLib = mdLoadLib;

// Modos de resaltado de CodeMirror que no vienen precargados (ver tabs.js,
// MODE_BY_EXT): se cargan la primera vez que se abre un archivo de ese
// lenguaje. Algunos dependen de otros (PHP va dentro de HTML, Rust usa el
// "simple mode").
const CM = '../node_modules/codemirror/';
const CM_MODE_FILES = {
  rust: ['addon/mode/simple.js', 'mode/rust/rust.js'],
  htmlmixed: ['mode/xml/xml.js', 'mode/javascript/javascript.js', 'mode/css/css.js', 'mode/htmlmixed/htmlmixed.js'],
  php: ['mode/xml/xml.js', 'mode/javascript/javascript.js', 'mode/css/css.js', 'mode/htmlmixed/htmlmixed.js', 'mode/php/php.js']
};

async function mdLoadCmMode(name) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Modo inválido: ${name}`);
  if (window.mdCM6) return; // CM6 incluye sus lenguajes; no cargar addons de CM5
  const files = CM_MODE_FILES[name] || [`mode/${name}/${name}.js`];
  for (const f of files) await loadScript(CM + f);
}

window.mdLoadCmMode = mdLoadCmMode;

})();
