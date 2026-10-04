'use strict';
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const source = path.join(root, 'node_modules/@excalidraw/excalidraw/dist/prod');
const assets = path.join(root, 'src/drawing-assets');
fs.mkdirSync(assets, { recursive: true });
fs.cpSync(path.join(source, 'fonts'), path.join(assets, 'fonts'), { recursive: true });
fs.copyFileSync(path.join(source, 'index.css'), path.join(assets, 'index.css'));
// 0.18.1 adds a CDN URL to every font source even when a local asset path
// is supplied. Chromium checks that source against CSP before loading it.
// Remove only that fallback at build time: MK ships the fonts offline.
// Fail closed if the pinned upstream implementation changes.
const offlineFonts = {
  name: 'mk-offline-fonts',
  setup(build) {
    build.onLoad({ filter: /excalidraw\/dist\/prod\/chunk-K2UTITRG\.js$/ }, ({ path: file }) => {
      const original = fs.readFileSync(file, 'utf8');
      const needle = 'return r.push(new URL(n,jn.ASSETS_FALLBACK_URL)),r';
      if (original.split(needle).length !== 2) throw new Error('Revisar fallback de fuentes al actualizar Excalidraw.');
      return { contents: original.replace(needle, 'return r'), loader: 'js' };
    });
  }
};
esbuild.build({ entryPoints: [path.join(root, 'src/drawing-entry.js')], outfile: path.join(root, 'src/drawing-bundle.js'), bundle: true, format: 'iife', minify: true, target: 'es2020', plugins: [offlineFonts], define: { 'process.env.NODE_ENV': '"production"' } }).catch((error) => { console.error(error); process.exitCode = 1; });
