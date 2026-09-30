'use strict';

// Índice de la carpeta: relee solo lo que cambió.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFolderIndex } = require('../../src/folderindex');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-unit-index-'));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

async function collect(idx) {
  const out = {};
  await idx.walk(root, (f, c) => { out[path.relative(root, f)] = c; });
  return out;
}

test('lista .md/.txt/.tex, salta ocultos; con vigilancia no relee lo que no cambió', async () => {
  fs.mkdirSync(path.join(root, 'sub'));
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, 'a.md'), 'uno');
  fs.writeFileSync(path.join(root, 'sub', 'b.txt'), 'dos');
  fs.writeFileSync(path.join(root, '.git', 'c.md'), 'oculto');
  fs.writeFileSync(path.join(root, 'foto.png'), 'x');
  const idx = createFolderIndex();
  idx.setWatchedRoot(root);
  assert.deepEqual(await collect(idx), { 'a.md': 'uno', [path.join('sub', 'b.txt')]: 'dos' });
  const s1 = idx.stats();
  await collect(idx);
  const s2 = idx.stats();
  assert.equal(s2.reads, s1.reads, 'segunda pasada sin lecturas');
  assert.equal(s2.listBuilds, s1.listBuilds, 'ni volver a listar');

  // Aviso del vigilante: cambió a.md y apareció d.md.
  fs.writeFileSync(path.join(root, 'a.md'), 'uno bis');
  fs.writeFileSync(path.join(root, 'd.md'), 'nuevo');
  idx.onFolderChanged({ root, structural: true, changes: [{ path: path.join(root, 'a.md') }, { path: path.join(root, 'd.md') }] });
  const after = await collect(idx);
  assert.equal(after['a.md'], 'uno bis');
  assert.equal(after['d.md'], 'nuevo');
  assert.equal(idx.stats().reads - s2.reads, 2, 'solo relee los dos que cambiaron');
});

test('sin vigilancia compara fecha y tamaño', async () => {
  const idx = createFolderIndex();
  await collect(idx);
  const r1 = idx.stats().reads;
  await collect(idx);
  assert.equal(idx.stats().reads, r1, 'sin cambios: nada que releer');
  fs.writeFileSync(path.join(root, 'a.md'), 'contenido más largo que antes');
  const after = await collect(idx);
  assert.equal(after['a.md'], 'contenido más largo que antes');
});

test('índice guardado en disco: al reabrir solo verifica (sin releer) y lo borrado no se arrastra', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-unit-cache-'));
  const r2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-unit-r2-'));
  for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(r2, `n${i}.md`), `nota ${i}`);
  const a = createFolderIndex({ cacheDir });
  a.setWatchedRoot(r2);
  await a.walk(r2, () => {});
  assert.equal(a.stats().reads, 20);
  assert.equal(await a.saveCache(), true);

  // "Reabrir MK": otro índice, misma carpeta; cambió un archivo y se borró otro.
  fs.writeFileSync(path.join(r2, 'n0.md'), 'nota 0 editada afuera');
  fs.rmSync(path.join(r2, 'n1.md'));
  const b = createFolderIndex({ cacheDir });
  b.setWatchedRoot(r2);
  const seen = {};
  await b.walk(r2, (f, c) => { seen[path.basename(f)] = c; });
  const s = b.stats();
  assert.equal(s.loadedFromDisk, 20);
  assert.equal(s.reads, 1, 'solo relee el que cambió');
  assert.equal(seen['n0.md'], 'nota 0 editada afuera');
  assert.equal(Object.keys(seen).length, 19);
  // Al guardar de nuevo, n1 (borrado) ya no está.
  fs.writeFileSync(path.join(r2, 'n2.md'), 'forzar guardado');
  b.onFolderChanged({ root: r2, structural: false, changes: [{ path: path.join(r2, 'n2.md') }] });
  await b.walk(r2, () => {});
  await b.saveCache();
  const saved = JSON.parse(fs.readFileSync(path.join(cacheDir, fs.readdirSync(cacheDir)[0]), 'utf-8'));
  assert.equal(saved.files.some(([rel]) => rel === 'n1.md'), false);
  assert.equal(saved.files.length, 19);
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.rmSync(r2, { recursive: true, force: true });
});
