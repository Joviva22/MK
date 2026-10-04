'use strict';

// Arnés aparte para probar src/cm6-shim.js (ver OBJETIVOS.md, "Migrar el
// editor a CodeMirror 6") SIN tocar index.html: carga src/cm6-test.html (una
// página mínima con el bundle + el shim, nada más) y corre las aserciones de
// cm6-shim-checks.js adentro, con Electron de verdad (no jsdom). Se corre a
// mano con `npm run test:cm6` mientras la capa de compatibilidad no está
// conectada a la app real.

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const timeout = setTimeout(() => {
  console.error('CM6: tiempo de prueba agotado');
  app.exit(1);
}, 30000);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false, sandbox: false }
  });
  win.loadFile(path.join(__dirname, '..', 'src', 'cm6-test.html'));
  win.webContents.on('console-message', (event) => console.log(event.message));
  win.webContents.on('did-finish-load', async () => {
    const code = fs.readFileSync(path.join(__dirname, 'cm6-shim-checks.js'), 'utf-8');
    try {
      const results = await win.webContents.executeJavaScript(code);
      const failed = results.filter((r) => !r.pass);
      results.forEach((r) => console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`));
      console.log(`\n${results.length - failed.length}/${results.length} checks OK`);
      clearTimeout(timeout);
      app.exit(failed.length ? 1 : 0);
    } catch (e) {
      console.error('HARNESS_ERROR:', (e && e.stack) || e);
      app.exit(1);
    }
  });
});
