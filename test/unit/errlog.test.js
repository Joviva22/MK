'use strict';

// JSON atómico, JSON dañado apartado y registro de errores.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../../src/errlog');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-unit-errlog-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('writeJsonAtomic + readJsonSafe: ida y vuelta, sin temporales sueltos', () => {
  const f = path.join(dir, 'sub', 'config.json');
  E.writeJsonAtomic(f, { a: 1, b: [1, 2] });
  assert.deepEqual(E.readJsonSafe(f, null), { a: 1, b: [1, 2] });
  assert.deepEqual(fs.readdirSync(path.dirname(f)), ['config.json']);
});

test('readJsonSafe: inexistente → valor por defecto; dañado → se aparta y se registra', () => {
  E.init(dir);
  assert.equal(E.readJsonSafe(path.join(dir, 'no-existe.json'), 'def'), 'def');
  const f = path.join(dir, 'home.json');
  fs.writeFileSync(f, '{ roto');
  assert.equal(E.readJsonSafe(f, null), null);
  assert.equal(fs.existsSync(f), false, 'el dañado ya no está en su lugar');
  assert.ok(fs.readdirSync(dir).some((n) => n.startsWith('home.json.corrupt-')), 'quedó apartado');
  assert.match(fs.readFileSync(E.logFile(), 'utf-8'), /JSON dañado/);
});
