'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildReport, redact } = require('../../src/problemreport');

test('informe: sin carpeta personal, usuario, correos, AppImage ni claves', () => {
  const log = [
    '2026-09-30T05:59:37Z [x] Error at /home/ana/Notas/diario.md',
    'correo ana.perez@gmail.com falló',
    'at file:///tmp/.mount_MK.Appd7Pcuw/resources/app.asar/src/database.js:470:37',
    'password=hunter2 token: abc123'
  ].join('\n');
  const r = buildReport({ version: '2.0.0', electron: '44', chrome: '140', node: '22', platform: 'linux', release: '7.2', arch: 'x64', desktop: 'KDE', modulesOff: ['pdf'], log, home: '/home/ana', user: 'ana' });
  assert.ok(r.includes('MK 2.0.0'));
  assert.ok(r.includes('~/Notas/diario.md'));
  assert.ok(!r.includes('/home/ana'));
  assert.ok(!r.includes('ana.perez'));
  assert.ok(r.includes('<AppImage>/resources/app.asar/src/database.js:470:37'));
  assert.ok(!r.includes('hunter2') && !r.includes('abc123'));
  assert.ok(r.includes('Módulos apagados: pdf'));
});

test('informe: log vacío y recorte a las últimas líneas', () => {
  assert.ok(buildReport({ version: '1', log: '' }).includes('(sin errores registrados)'));
  const many = Array.from({ length: 200 }, (_, i) => `línea ${i}`).join('\n');
  const r = buildReport({ version: '1', log: many });
  assert.ok(r.includes('línea 199') && !r.includes('línea 100\n'));
  assert.strictEqual(redact('usuario anabel y ana', { user: 'ana' }), 'usuario anabel y <usuario>');
});
