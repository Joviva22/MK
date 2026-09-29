#!/usr/bin/env node
// Instala MK para el usuario a partir del AppImage de `npm run dist`, así el
// lanzador del menú, el doble clic en un .md y "Iniciar con el sistema" dejan
// de depender de la carpeta del proyecto (bin/mk-editor + node_modules).
//
//   npm run dist && npm run install-desktop
//
// Qué hace (todo dentro de ~/.local, sin sudo):
//   - copia dist/MK-*.AppImage a ~/.local/share/mk/MK.AppImage
//   - copia el ícono a ~/.local/share/icons/hicolor/512x512/apps/mk-editor.png
//   - escribe ~/.local/share/applications/mk-editor.desktop apuntando al
//     AppImage (si ya había uno, lo guarda antes como mk-editor.desktop.bak)
//   - si "Iniciar con el sistema" está activado, reescribe también
//     ~/.config/autostart/mk-editor.desktop
// El AppImage usa la misma carpeta de datos que la versión de desarrollo
// (~/.config/md-editor-local): tareas, ajustes y sesión se conservan.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOME = os.homedir();
const DATA = process.env.XDG_DATA_HOME || path.join(HOME, '.local', 'share');
const CONFIG = process.env.XDG_CONFIG_HOME || path.join(HOME, '.config');

const target = path.join(DATA, 'mk', 'MK.AppImage');
const iconTarget = path.join(DATA, 'icons', 'hicolor', '512x512', 'apps', 'mk-editor.png');
const desktopFile = path.join(DATA, 'applications', 'mk-editor.desktop');
const autostartFile = path.join(CONFIG, 'autostart', 'mk-editor.desktop');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const distDir = path.join(ROOT, 'dist');
const appImages = fs.existsSync(distDir) ? fs.readdirSync(distDir).filter((f) => /^MK-.*\.AppImage$/.test(f)) : [];
if (!appImages.length) fail('No hay ningún AppImage en dist/. Corré primero: npm run dist');
const newest = appImages
  .map((f) => path.join(distDir, f))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

// Comillas de la especificación .desktop para Exec.
const q = (p) => `"${p.replace(/(["\\`$])/g, '\\$1')}"`;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(newest, target + '.tmp');
fs.chmodSync(target + '.tmp', 0o755);
fs.renameSync(target + '.tmp', target); // reemplazo atómico: no pisa un AppImage en uso a medias
console.log(`✓ AppImage: ${target}`);

fs.mkdirSync(path.dirname(iconTarget), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'build', 'icon.png'), iconTarget);
console.log(`✓ Ícono: ${iconTarget}`);

fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
if (fs.existsSync(desktopFile) && !fs.existsSync(desktopFile + '.bak')) {
  fs.copyFileSync(desktopFile, desktopFile + '.bak');
  console.log(`✓ Copia del lanzador anterior: ${desktopFile}.bak`);
}
fs.writeFileSync(desktopFile, [
  '[Desktop Entry]',
  'Type=Application',
  'Name=MK',
  'Comment=Editor de Markdown local: notas, Home, bases de datos y terminal',
  // --no-sandbox: igual que el lanzador que genera electron-builder dentro
  // del AppImage (el sandbox SUID de Chromium no funciona desde un AppImage).
  `Exec=${q(target)} --no-sandbox %f`,
  'Icon=mk-editor',
  'Terminal=false',
  'StartupWMClass=mk-editor',
  'MimeType=text/markdown;text/x-markdown;',
  'Categories=Office;TextEditor;Utility;',
  ''
].join('\n'), 'utf-8');
console.log(`✓ Lanzador del menú: ${desktopFile}`);

if (fs.existsSync(autostartFile)) {
  const text = fs.readFileSync(autostartFile, 'utf-8').replace(/^Exec=.*$/m, `Exec=${q(target)} --no-sandbox --hidden`);
  fs.writeFileSync(autostartFile, text, 'utf-8');
  console.log(`✓ Inicio con el sistema actualizado: ${autostartFile}`);
}

for (const [cmd, args] of [['update-desktop-database', [path.dirname(desktopFile)]], ['gtk-update-icon-cache', ['-f', '-t', path.join(DATA, 'icons', 'hicolor')]]]) {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
  } catch (e) {
    // opcional: sin estas herramientas el escritorio igual lo encuentra al rato
  }
}
console.log('\nListo. MK ya abre desde el menú de aplicaciones sin depender de esta carpeta.');
