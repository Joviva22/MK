#!/usr/bin/env node
// Corredor de la suite de humo de MK. Lanza la app real de Electron con
// MK_TEST=1 y un --user-data-dir aislado (para no tocar la config/sesión
// real del usuario ni chocar con una instancia de MK ya abierta), la app
// corre test/renderer-checks.js dentro de su propia ventana y sale sola
// con código 0 (todo OK) o 1 (algo falló).
//
// Uso: npm test

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const electronBin = path.join(root, 'node_modules', '.bin', 'electron');

const runId = `mk-test-${Date.now()}`;
const profileDir = path.join(os.tmpdir(), `${runId}-profile`);
const fixturesDir = path.join(os.tmpdir(), `${runId}-fixtures`);

fs.mkdirSync(profileDir, { recursive: true });
fs.mkdirSync(fixturesDir, { recursive: true });
fs.writeFileSync(
  path.join(fixturesDir, 'note.md'),
  '# Hola MK\n\nFormula: $x^2 + y^2 = z^2$ #proyecto\n',
  'utf-8'
);
fs.writeFileSync(
  path.join(fixturesDir, 'other.md'),
  'Ver [[note]] para más info. #proyecto\n',
  'utf-8'
);
// Estructura para probar "subir a la carpeta superior" y "mover entre
// carpetas": fixturesDir/nested/child-root/ (root inicial) y dos carpetas
// hermanas (moveA/moveB) con un archivo para arrastrar entre ellas.
fs.mkdirSync(path.join(fixturesDir, 'nested', 'child-root'), { recursive: true });
fs.mkdirSync(path.join(fixturesDir, 'moveA'), { recursive: true });
fs.mkdirSync(path.join(fixturesDir, 'moveB'), { recursive: true });
fs.writeFileSync(path.join(fixturesDir, 'moveA', 'move-me.md'), '# Muevanme\n', 'utf-8');
// Un binario con byte NUL (antes colgaba la app al abrirlo como si fuera
// texto) y un ".png" (no hace falta que decodifique, el test solo mira el
// <img> del DOM, no que la imagen sea válida).
fs.writeFileSync(path.join(fixturesDir, 'binary.dat'), Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x00, 0x41, 0x42]));
fs.writeFileSync(path.join(fixturesDir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]));

function cleanup() {
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.rmSync(fixturesDir, { recursive: true, force: true });
}

const child = spawn(
  electronBin,
  [root, `--user-data-dir=${profileDir}`],
  {
    env: { ...process.env, MK_TEST: '1', MK_TEST_FIXTURES: fixturesDir },
    stdio: ['ignore', 'pipe', 'pipe']
  }
);

let stdout = '';
child.stdout.on('data', (d) => { stdout += d; });
child.stderr.on('data', (d) => { stdout += d; });

const timeout = setTimeout(() => {
  console.error('Timeout: la app no terminó los tests a tiempo, matando proceso.');
  child.kill('SIGKILL');
}, 30000);

child.on('close', (code) => {
  clearTimeout(timeout);
  cleanup();

  const line = stdout.split('\n').find((l) => l.startsWith('MK_TEST_RESULTS_JSON:'));
  if (!line) {
    console.error('No se encontró el resultado de los tests en la salida de Electron.');
    console.error('--- salida completa ---');
    console.error(stdout);
    process.exit(1);
  }

  let results;
  try {
    results = JSON.parse(line.slice('MK_TEST_RESULTS_JSON:'.length));
  } catch (e) {
    console.error('No se pudo parsear el resultado de los tests:', e.message);
    console.error(line);
    process.exit(1);
  }

  let failCount = 0;
  for (const r of results) {
    const mark = r.pass ? '✓' : '✗';
    console.log(`${mark} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    if (!r.pass) failCount++;
  }

  console.log(`\n${results.length - failCount}/${results.length} checks OK`);
  process.exit(failCount === 0 && code === 0 ? 0 : 1);
});

child.on('error', (err) => {
  clearTimeout(timeout);
  cleanup();
  console.error('No se pudo lanzar Electron:', err.message);
  process.exit(1);
});
