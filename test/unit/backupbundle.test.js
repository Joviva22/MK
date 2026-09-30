'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildBundle, validateBundle, restoreBundle } = require('../../src/backupbundle');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mk-backup-'));
}

test('respaldo: ida y vuelta de ajustes, Home e imágenes; lo local se queda', () => {
  const a = tmp();
  fs.writeFileSync(path.join(a, 'config.json'), JSON.stringify({ theme: 'nord', windowBounds: { w: 1 }, pet: { pets: [{ id: 'p1' }, { id: 'p2' }] } }));
  fs.writeFileSync(path.join(a, 'home.json'), JSON.stringify({ tasks: [{ id: 1 }, { id: 2 }, { id: 3 }] }));
  fs.writeFileSync(path.join(a, 'mail-secret.bin'), 'secreto');
  fs.mkdirSync(path.join(a, 'pet', 'p1'), { recursive: true });
  fs.writeFileSync(path.join(a, 'pet', 'p1', 'etapa1.png'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(a, 'pet', 'p1', 'raro.exe'), 'x');

  const bundle = JSON.parse(JSON.stringify(buildBundle(a, '2.0.0')));
  assert.ok(!('windowBounds' in bundle.config));
  assert.ok(!JSON.stringify(bundle).includes('secreto'), 'la contraseña del correo no viaja');
  assert.deepStrictEqual(Object.keys(bundle.pet), ['p1/etapa1.png']);
  const v = validateBundle(bundle);
  assert.ok(v.ok);
  assert.deepStrictEqual([v.summary.tasks, v.summary.pets, v.summary.images], [3, 2, 1]);

  const b = tmp();
  fs.writeFileSync(path.join(b, 'config.json'), JSON.stringify({ theme: 'claro', windowBounds: { w: 9 } }));
  fs.mkdirSync(path.join(b, 'pet', 'vieja'), { recursive: true });
  fs.writeFileSync(path.join(b, 'pet', 'vieja', 'etapa1.png'), 'x');
  restoreBundle(b, bundle);
  const cfg = JSON.parse(fs.readFileSync(path.join(b, 'config.json'), 'utf-8'));
  assert.strictEqual(cfg.theme, 'nord');
  assert.deepStrictEqual(cfg.windowBounds, { w: 9 });
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(b, 'home.json'), 'utf-8')).tasks.length, 3);
  assert.deepStrictEqual([...fs.readFileSync(path.join(b, 'pet', 'p1', 'etapa1.png'))], [1, 2, 3]);
  assert.ok(!fs.existsSync(path.join(b, 'pet', 'vieja')));
});

test('respaldo: rechaza archivos ajenos, dañados o con rutas peligrosas', () => {
  assert.strictEqual(validateBundle({ hola: 1 }).ok, false);
  assert.strictEqual(validateBundle({ format: 'mk-backup', version: 99, config: {} }).ok, false);
  assert.strictEqual(validateBundle({ format: 'mk-backup', version: 1, config: [] }).ok, false);
  const evil = { format: 'mk-backup', version: 1, config: {}, pet: { '../../.bashrc': 'eA==' } };
  assert.strictEqual(validateBundle(evil).ok, false);
  assert.throws(() => restoreBundle(tmp(), evil));
  assert.strictEqual(validateBundle({ format: 'mk-backup', version: 1, config: {}, pet: { 'p1/etapa2.png': 'eA==' } }).ok, true);
});
