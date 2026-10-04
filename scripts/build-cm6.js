'use strict';

// Junta CodeMirror 6 (~15 paquetes que se importan entre sí por nombre) en
// un único src/cm6-bundle.js estático, committeado al repo. Se corre a mano
// con `npm run build:cm6` cuando cambia src/cm6-entry.js o se actualiza
// CodeMirror. Las pruebas y el empaquetado lo regeneran automáticamente;
// no es parte de `npm start`: en runtime la
// app sigue sin build, cm6-bundle.js se carga con un <script> normal (ver
// OBJETIVOS.md, "Migrar el editor a CodeMirror 6").

const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [path.join(__dirname, '..', 'src', 'cm6-entry.js')],
  outfile: path.join(__dirname, '..', 'src', 'cm6-bundle.js'),
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020'
}).then(() => {
  console.log('src/cm6-bundle.js listo.');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
