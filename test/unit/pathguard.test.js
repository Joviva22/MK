'use strict';

// Rutas autorizadas del proceso principal.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../../src/pathguard');

test('solo lo que está dentro de lo autorizado', () => {
  G.grantDir('/home/ana/notas');
  assert.equal(G.isAllowed('/home/ana/notas'), true);
  assert.equal(G.isAllowed('/home/ana/notas/sub/a.md'), true);
  assert.equal(G.isAllowed('/home/ana/notas2/a.md'), false, 'prefijo parecido no cuenta');
  assert.equal(G.isAllowed('/home/ana/notas/../.ssh/id_rsa'), false, '".." no escapa');
  assert.equal(G.isAllowed('/etc/passwd'), false);
  assert.equal(G.isAllowed('notas/a.md'), false, 'rutas relativas no');
  assert.equal(G.isAllowed(''), false);
  assert.equal(G.isAllowed(null), false);
});

test('archivo abierto: autoriza su carpeta; subir con ".." a un ancestro', () => {
  G.grantFile('/tmp/descargas/informe.md');
  assert.equal(G.isAllowed('/tmp/descargas/img.png'), true);
  assert.equal(G.isAncestorOfGranted('/home/ana'), true);
  assert.equal(G.isAncestorOfGranted('/opt'), false);
});

test('check registra los rechazos', () => {
  const denied = [];
  G.setOnDenied((what, p) => denied.push([what, p]));
  assert.equal(G.check('/etc/shadow', 'file:read'), false);
  assert.equal(G.check('/home/ana/notas/x.md', 'file:read'), true);
  assert.deepEqual(denied, [['file:read', '/etc/shadow']]);
});
