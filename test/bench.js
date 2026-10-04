#!/usr/bin/env node
// npm run bench: mide arranque, apertura y búsqueda en una carpeta grande,
// y preview / escritura en una nota grande, con la app real (como npm test,
// con un perfil aislado). Compara con test/bench-baseline.json y marca lo
// que empeoró más de un 30 %.
//
//   npm run bench             medir y comparar
//   npm run bench -- --save   guardar estas medidas como referencia
//   npm run bench -- --strict salir con código 1 si algo empeoró
//
// Los tiempos dependen de la máquina: la referencia sirve para comparar
// en la MISMA computadora antes y después de un cambio.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const electronBin = path.join(root, 'node_modules', '.bin', 'electron');
const baselineFile = path.join(__dirname, 'bench-baseline.json');
const args = process.argv.slice(2);
const SLOWER = 1.3;

const runId = `mk-bench-${Date.now()}`;
const profileDir = path.join(os.tmpdir(), `${runId}-profile`);
const fixturesDir = path.join(os.tmpdir(), `${runId}-fixtures`);
const notes = path.join(fixturesDir, 'notas');

function makeFixtures() {
  fs.mkdirSync(profileDir, { recursive: true });
  // 3000 notas en 30 carpetas, con etiquetas y enlaces.
  for (let d = 0; d < 30; d++) {
    const dir = path.join(notes, `carpeta-${d}`);
    fs.mkdirSync(dir, { recursive: true });
    for (let n = 0; n < 100; n++) {
      const body = [`# Nota ${d}-${n}`, '', `Texto de relleno con término${n % 7} y #tema${n % 13}.`, `Ver [[Nota ${d}-${(n + 1) % 100}]].`, '', '- [ ] algo pendiente', '- [x] algo hecho', ''].join('\n');
      fs.writeFileSync(path.join(dir, `nota-${n}.md`), body.repeat(4));
    }
  }
  // Una nota de ~5000 líneas con de todo.
  const block = [
    '## Sección', '', 'Un párrafo con **negrita**, _cursiva_, `código` y un [enlace](https://example.com).', '',
    '- uno', '- dos', '  - anidado', '', '| a | b | c |', '|---|---|---|', '| 1 | 2 | 3 |', '',
    '```js', 'const x = 1;', 'console.log(x);', '```', '', '> una cita', '', '- [ ] tarea', ''
  ].join('\n');
  fs.writeFileSync(path.join(notes, 'grande.md'), `# Nota grande\n\n${block.repeat(250)}`);
}

function cleanup() {
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.rmSync(fixturesDir, { recursive: true, force: true });
}

function run() {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    let startup = null;
    const child = spawn(electronBin, [root, `--user-data-dir=${profileDir}`], {
      env: { ...process.env, MK_TEST: '1', MK_TEST_SCRIPT: 'bench', MK_TEST_FIXTURES: fixturesDir },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const onData = (d) => {
      out += d;
      if (startup === null && out.includes('MK_BENCH_LOADED')) startup = Date.now() - t0;
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => child.kill('SIGKILL'), 180000);
    child.on('close', () => {
      clearTimeout(timer);
      const line = out.split('\n').find((l) => l.startsWith('MK_TEST_RESULTS_JSON:'));
      if (!line) return reject(new Error(`sin resultados\n${out}`));
      const results = JSON.parse(line.slice('MK_TEST_RESULTS_JSON:'.length));
      if (results.some((r) => r.name === 'harness')) return reject(new Error(results[0].detail));
      if (startup !== null) results.unshift({ name: 'Arranque (hasta la ventana cargada)', ms: startup });
      resolve(results);
    });
  });
}

(async () => {
  makeFixtures();
  let results;
  try {
    results = await run();
  } catch (e) {
    cleanup();
    console.error('npm run bench falló:', e.message);
    process.exit(1);
  }
  cleanup();

  let baseline = {};
  try {
    baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf-8')).results || {};
  } catch {
    // sin referencia todavía
  }
  let worse = 0;
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${pad('Medición', 44)} ${pad('ahora', 10)} ${pad('referencia', 12)} cambio`);
  for (const r of results) {
    const ref = baseline[r.name];
    let change = '';
    if (typeof ref === 'number' && ref > 0) {
      const ratio = r.ms / ref;
      change = `${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)} %`;
      if (ratio > SLOWER && r.ms - ref > 5) {
        change += '  ⚠ más lento';
        worse++;
      }
    }
    console.log(`${pad(r.name, 44)} ${pad(`${r.ms} ms`, 10)} ${pad(typeof ref === 'number' ? `${ref} ms` : '—', 12)} ${change}${r.detail ? ` · ${r.detail}` : ''}`);
  }
  if (args.includes('--save')) {
    const data = { saved: new Date().toISOString(), machine: `${os.cpus()[0].model} · ${os.platform()} ${os.release()}`, results: Object.fromEntries(results.map((r) => [r.name, r.ms])) };
    fs.writeFileSync(baselineFile, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nReferencia guardada en ${path.relative(root, baselineFile)}.`);
  } else if (!Object.keys(baseline).length) {
    console.log('\nSin referencia: `npm run bench -- --save` guarda estas medidas para comparar después.');
  }
  if (worse) console.log(`\n${worse} medición(es) más de un ${Math.round((SLOWER - 1) * 100)} % más lentas que la referencia.`);
  process.exit(worse && args.includes('--strict') ? 1 : 0);
})();
