'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sliceSheet } = require('../../src/khslice');

function sheet(w, h, rects) {
  const on = (x, y) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  return { width: w, height: h, alphaAt: (x, y) => (on(x, y) ? 255 : 0) };
}

test('recorta cada dibujo con su caja, tolerando huecos chicos', () => {
  const s = sheet(60, 40, [
    { x: 2, y: 5, w: 6, h: 30 },
    { x: 9, y: 10, w: 2, h: 3 }, // pegado con 1 px de hueco: mismo dibujo
    { x: 20, y: 1, w: 8, h: 38 },
    { x: 40, y: 12, w: 10, h: 20 },
    { x: 55, y: 0, w: 1, h: 2 } // mancha de 1 px: se ignora
  ]);
  assert.deepStrictEqual(sliceSheet(s), [
    { x: 2, y: 5, width: 9, height: 30 },
    { x: 20, y: 1, width: 8, height: 38 },
    { x: 40, y: 12, width: 10, height: 20 }
  ]);
});

test('hoja vacía o dibujo tocando el borde derecho', () => {
  assert.deepStrictEqual(sliceSheet(sheet(10, 10, [])), []);
  assert.deepStrictEqual(sliceSheet(sheet(10, 10, [{ x: 5, y: 0, w: 5, h: 10 }])), [{ x: 5, y: 0, width: 5, height: 10 }]);
});
