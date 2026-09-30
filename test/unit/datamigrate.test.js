'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { runMigrations, migrateConfig, migrateHome, CONFIG_VERSION } = require('../../src/datamigrate');

test('migraciones: pasos en orden desde la versión del archivo', () => {
  const steps = {
    1: (d) => d,
    2: (d) => ({ ...d, theme: d.tema, tema: undefined }),
    3: (d) => ({ ...d, list: [...(d.list || []), 'v3'] })
  };
  const r = runMigrations({ tema: 'nord' }, steps, 3);
  assert.deepStrictEqual([r.from, r.to, r.changed, r.data.schemaVersion, r.data.theme, r.data.list[0]], [0, 3, true, 3, 'nord', 'v3']);
  const r2 = runMigrations({ schemaVersion: 2, theme: 'x', list: [] }, steps, 3);
  assert.deepStrictEqual(r2.data.list, ['v3']);
  assert.strictEqual(r2.from, 2);
});

test('migraciones: al día no cambia; más nueva no se toca; falta un paso = error', () => {
  const cur = migrateConfig({ schemaVersion: CONFIG_VERSION, a: 1 });
  assert.strictEqual(cur.changed, false);
  const newer = migrateHome({ schemaVersion: 99, tasks: [1] });
  assert.ok(newer.tooNew && !newer.changed && newer.data.tasks.length === 1);
  assert.throws(() => runMigrations({}, { 1: (d) => d }, 2));
  assert.strictEqual(migrateConfig(null).data.schemaVersion, CONFIG_VERSION);
});
