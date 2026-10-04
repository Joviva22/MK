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
const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');

const root = path.join(__dirname, '..');
const electronBin = path.join(root, 'node_modules', '.bin', 'electron');

const runId = `mk-test-${Date.now()}`;
const profileDir = path.join(os.tmpdir(), `${runId}-profile`);
const fixturesDir = path.join(os.tmpdir(), `${runId}-fixtures`);

fs.mkdirSync(profileDir, { recursive: true });
fs.mkdirSync(fixturesDir, { recursive: true });
// Notas reales del repo (Ejemplos, Guías, manual) para comparar el preview
// por bloques con el completo. Aparte de los fixtures: no cambian las
// cuentas de archivos/etiquetas de los otros tests.
const corpusDir = path.join(os.tmpdir(), `${runId}-corpus`);
// Hoja de keyblades de prueba (3 figuras sobre fondo transparente), hecha
// acá: el arte de verdad no está en el repo.
(function writeKeybladeSheet() {
  const zlib = require('zlib');
  const w = 40;
  const h = 24;
  const figs = [[2, 2, 6, 20], [14, 4, 8, 18], [30, 1, 5, 22]];
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const on = figs.some(([fx, fy, fw, fh]) => x >= fx && x < fx + fw && y >= fy && y < fy + fh);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = 230; raw[o + 1] = 190; raw[o + 2] = 80; raw[o + 3] = on ? 255 : 0;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  fs.mkdirSync(`${fixturesDir}-kh`, { recursive: true });
  fs.writeFileSync(path.join(`${fixturesDir}-kh`, 'keyblades.png'), png);
  // Hoja "de Sora" (mismo tamaño que la real, así se reconoce): fondo
  // blanco con un bloque oscuro en cada cuadro que recorta ipc-kh.js.
  const { CHARS } = { CHARS: { sora: { size: [1024, 2917], rects: [[360, 15, 25, 50], [392, 15, 25, 50], [2, 156, 23, 49], [34, 156, 27, 49], [67, 156, 26, 49], [98, 155, 24, 50], [128, 157, 24, 48], [3, 726, 28, 52], [36, 709, 34, 69], [76, 743, 56, 35], [139, 740, 55, 38], [500, 5, 70, 95], [570, 575, 70, 95], [500, 198, 70, 95], [500, 295, 70, 95], [780, 5, 70, 95]] } } };
  const [sw, sh] = CHARS.sora.size;
  const sraw = Buffer.alloc((sw * 4 + 1) * sh, 255);
  for (let y = 0; y < sh; y++) sraw[y * (sw * 4 + 1)] = 0;
  for (const [rx, ry, rw, rh] of CHARS.sora.rects) {
    for (let y = ry + 3; y < ry + rh - 3; y++) {
      for (let x = rx + 3; x < rx + rw - 3; x++) {
        const o = y * (sw * 4 + 1) + 1 + x * 4;
        sraw[o] = 40; sraw[o + 1] = 40; sraw[o + 2] = 90;
      }
    }
  }
  const ihdr2 = Buffer.alloc(13);
  ihdr2.writeUInt32BE(sw, 0); ihdr2.writeUInt32BE(sh, 4); ihdr2[8] = 8; ihdr2[9] = 6;
  fs.writeFileSync(path.join(`${fixturesDir}-kh`, 'sora.png'), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr2), chunk('IDAT', zlib.deflateSync(sraw)), chunk('IEND', Buffer.alloc(0))]));
})();
// Catálogo de mascotas separado de las notas: regionales y especies futuras.
const pokemonGame = `${fixturesDir}-pokemon`;
const pokemonChars = path.join(pokemonGame, 'Graphics', 'Characters');
fs.mkdirSync(pokemonChars, { recursive: true });
fs.mkdirSync(path.join(pokemonGame, 'PBS'));
for (const id of ['VULPIX', 'NINETALES', 'vulpix_1', 'NINETALES_1', 'FUTURE_MON', ...Array.from({ length: 90 }, (_, i) => `EXTRA_${i}`)]) {
  fs.copyFileSync(path.join(`${fixturesDir}-kh`, 'keyblades.png'), path.join(pokemonChars, `${id}.${id === 'vulpix_1' ? 'PNG' : 'png'}`));
}
fs.writeFileSync(path.join(pokemonGame, 'PBS', 'pokemon.txt'), '[VULPIX]\nName = Vulpix\nEvolution = NINETALES,Item,FIRESTONE\n[NINETALES]\nName = Ninetales\n');
fs.writeFileSync(path.join(pokemonGame, 'PBS', 'pokemon_forms.txt'), '[VULPIX,1]\nFormName = Alolan\n[NINETALES,1]\nFormName = Alolan\n');

fs.mkdirSync(corpusDir, { recursive: true });
let corpusN = 0;
for (const dir of ['Ejemplos', path.join('Ejemplos', 'Plantillas'), 'Guias', '.']) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (f.endsWith('.md')) fs.copyFileSync(path.join(abs, f), path.join(corpusDir, `${corpusN++}-${f}`));
  }
}
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
} catch {
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
  const selectionPdf = await PDFDocument.create();
  const selectionFont = await selectionPdf.embedFont(StandardFonts.Helvetica);
  selectionPdf.addPage([400, 300]).drawText('Selección para una nota', { x: 40, y: 200, size: 14, font: selectionFont });
  const rotated = selectionPdf.addPage([400, 300]);
  rotated.setRotation(degrees(90));
  rotated.drawText('Texto girado página dos', { x: 40, y: 200, size: 14, font: selectionFont });
  selectionPdf.addPage([400, 300]);
  fs.writeFileSync(path.join(fixturesDir, 'selección (PDF)#.pdf'), await selectionPdf.save());

  // Audio WAV de 2 s (tono de 440 Hz, 8 kHz, 8 bits mono) generado a mano,
  // para probar el visor y el adelantar/retroceder (pedidos por rango).
  const rate = 8000;
  const samples = rate * 2;
  const wav = Buffer.alloc(44 + samples);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples, 40);
  for (let i = 0; i < samples; i++) wav[44 + i] = 128 + Math.round(40 * Math.sin((2 * Math.PI * 440 * i) / rate));
  fs.writeFileSync(path.join(fixturesDir, 'tono.wav'), wav);
  // Un "TIFF" que Chromium no puede mostrar: el visor tiene que ofrecer la app del sistema.
  fs.writeFileSync(path.join(fixturesDir, 'escaneo.tiff'), Buffer.from('II*\0no-es-una-imagen-real'));

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
  fs.rmSync(corpusDir, { recursive: true, force: true });
  fs.rmSync(`${fixturesDir}-kh`, { recursive: true, force: true });
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

  // Límite de toda la suite. Eran 30 s y con ~100 checks la corrida normal
  // rondaba ese número: a veces se cortaba justo después de imprimir los
  // resultados (todo OK pero código de salida 1).
  const startedAt = Date.now();
  const timeout = setTimeout(() => {
    console.error('Timeout: la app no terminó los tests a tiempo, matando proceso.');
    child.kill('SIGKILL');
  }, 120000);

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

    console.log(`\n${results.length - failCount}/${results.length} checks OK (${Math.round((Date.now() - startedAt) / 1000)} s)`);
    if (results.some((r) => r.name === 'harness' && !r.pass)) console.error(stdout);
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
