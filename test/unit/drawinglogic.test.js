'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../../src/shared/drawinglogic');
test('pizarra: valida escena e imágenes conservando su contenido', () => {
  const scene = { type: 'excalidraw', elements: [{ id: 'a', type: 'text', text: 'PCP' }], appState: {}, files: { image: { dataURL: 'data:image/png;base64,AA==' } } };
  assert.deepEqual(validate(JSON.stringify(scene)), scene);
});
test('pizarra: rechaza JSON inválido, notas, arrays y escenas enormes', () => {
  for (const value of ['# Apuntes', '{}', JSON.stringify({ type: 'excalidraw', elements: [], appState: [] }), ' '.repeat(25 * 1024 * 1024 + 1)]) assert.throws(() => validate(value));
});
