'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../../src/shared/embedlogic');
test('materiales incrustados: PDF con página, pizarra y leyenda', () => {
  assert.deepEqual(L.parse('apuntes.pdf#page=12|Tema 2'), { path: 'apuntes.pdf', page: 12, kind: 'pdf', label: 'Tema 2' });
  assert.equal(L.parse('dibujos/mapa.excalidraw').kind, 'excalidraw');
  for (const value of ['https://example.com/a.pdf', '//example.com/a.pdf', 'x.pdf#page=0', 'x.excalidraw#page=2', 'x.pdf\n', 'nota.md', 'data:a.pdf']) assert.equal(L.parse(value), null);
});
test('materiales incrustados: escapa atributos sin ejecutar contenido', () => {
  assert.equal(L.escape('a"<&'), 'a&quot;&lt;&amp;');
});
