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
const { PDFDocument, StandardFonts } = require('pdf-lib');

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
// .docx real (de los propios fixtures de test de mammoth) para probar
// "abrir .docx" -> Markdown de verdad, no un .docx armado a mano.
fs.copyFileSync(
  path.join(root, 'node_modules', 'mammoth', 'test', 'test-data', 'single-paragraph.docx'),
  path.join(fixturesDir, 'prueba.docx')
);
// .docx con una imagen incrustada, para probar el plegado visual de los
// data: URI base64 en el editor (ver foldclutter.js).
fs.copyFileSync(
  path.join(root, 'node_modules', 'mammoth', 'test', 'test-data', 'tiny-picture.docx'),
  path.join(fixturesDir, 'prueba-imagen.docx')
);
// .docx con una tabla sin fila de encabezado (turndown la deja como HTML
// crudo, ver MANUAL.md), para probar el plegado de esa tabla en el editor.
fs.copyFileSync(
  path.join(root, 'node_modules', 'mammoth', 'test', 'test-data', 'tables.docx'),
  path.join(fixturesDir, 'prueba-tabla.docx')
);

// Repo git real para probar "sincronizar con git al guardar". Si el
// entorno no tiene git disponible, el check correspondiente se saltea solo.
const { execSync } = require('child_process');
const gitRepoDir = path.join(fixturesDir, 'gitrepo');
fs.mkdirSync(gitRepoDir, { recursive: true });
try {
  execSync('git init -q', { cwd: gitRepoDir });
  execSync('git config user.email "mk-test@example.com"', { cwd: gitRepoDir });
  execSync('git config user.name "MK Test"', { cwd: gitRepoDir });
  fs.writeFileSync(path.join(gitRepoDir, 'seed.md'), '# seed\n', 'utf-8');
  execSync('git add -A && git commit -q -m seed', { cwd: gitRepoDir });
} catch (e) {
  // sin git en PATH u otro problema de entorno: el check de git sync avisa y se saltea
}

// PDF de 2 páginas para las herramientas de PDF (unir/separar/rotar/marca de
// agua/firma y subrayado). pdf-lib es async, así que el spawn de Electron se
// mueve a runElectron() y se llama recién cuando este fixture ya está escrito.
async function writePdfFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([400, 300]);
    page.drawText(`Pagina ${i}`, { x: 40, y: 250, size: 20, font });
    page.drawText('Texto de prueba para subrayar.', { x: 40, y: 150, size: 12, font });
  }
  fs.writeFileSync(path.join(fixturesDir, 'prueba.pdf'), await doc.save());

  const other = await PDFDocument.create();
  const otherFont = await other.embedFont(StandardFonts.Helvetica);
  other.addPage([400, 300]).drawText('Otro PDF', { x: 40, y: 250, size: 20, font: otherFont });
  fs.writeFileSync(path.join(fixturesDir, 'otro.pdf'), await other.save());

  // PDF con formulario (AcroForm): texto, casilla y lista desplegable.
  const formDoc = await PDFDocument.create();
  const formPage = formDoc.addPage([400, 300]);
  const form = formDoc.getForm();
  const nombre = form.createTextField('nombre');
  nombre.addToPage(formPage, { x: 40, y: 220, width: 200, height: 24 });
  const acepto = form.createCheckBox('acepto');
  acepto.addToPage(formPage, { x: 40, y: 180, width: 16, height: 16 });
  const pais = form.createDropdown('pais');
  pais.addOptions(['Argentina', 'España', 'México']);
  pais.addToPage(formPage, { x: 40, y: 140, width: 150, height: 22 });
  fs.writeFileSync(path.join(fixturesDir, 'formulario.pdf'), await formDoc.save());
}

function cleanup() {
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.rmSync(fixturesDir, { recursive: true, force: true });
  // Los tests de exportar (EPUB, DOCX, PDF, Anki...) escriben en el tmp del
  // sistema como mk-test-export-*: sin esto se acumulaban en cada corrida.
  for (const name of fs.readdirSync(os.tmpdir())) {
    if (name.startsWith('mk-test-export-')) fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
  }
}

function runElectron() {
  const child = spawn(
    electronBin,
    [root, `--user-data-dir=${profileDir}`],
    {
      env: { ...process.env, MK_TEST: '1', MK_TEST_FIXTURES: fixturesDir, MK_TEST_MAX_BACKUP_BYTES: '2000' },
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
}

writePdfFixture().then(runElectron);
