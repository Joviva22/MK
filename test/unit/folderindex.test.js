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
