'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { findBlobs, rowsOf, cutFrame, alignFrames, trimFrame } = require('../../src/khsprites');

// Hoja 12x6 RGBA, fondo blanco; figura con contorno negro y relleno BLANCO
// (como la ropa de Sora) en x 1..5; otra figura en x 8..10.
function sheet() {
  const w = 12;
  const h = 6;
  const buf = Buffer.alloc(w * h * 4, 255);
  const px = (x, y, v) => { const o = (y * w + x) * 4; buf[o] = v; buf[o + 1] = v; buf[o + 2] = v; buf[o + 3] = 255; };
  for (let x = 1; x <= 5; x++) { px(x, 1, 0); px(x, 4, 0); }
  for (let y = 1; y <= 4; y++) { px(1, y, 0); px(5, y, 0); }
  for (let y = 2; y <= 4; y++) for (let x = 8; x <= 10; x++) px(x, y, 60);
  return { w, h, buf };
}

test('figuras sueltas sobre fondo liso y filas', () => {
  const { w, h, buf } = sheet();
  const rgbAt = (x, y) => { const o = (y * w + x) * 4; return [buf[o], buf[o + 1], buf[o + 2]]; };
  const boxes = findBlobs({ width: w, height: h, rgbAt, bg: [255, 255, 255], minArea: 3, mergeGap: 0 });
  assert.deepStrictEqual(boxes, [{ x: 1, y: 1, width: 5, height: 4 }, { x: 8, y: 2, width: 3, height: 3 }]);
  assert.strictEqual(rowsOf(boxes).length, 1);
});

test('el fondo se vuelve transparente solo desde afuera (el blanco de adentro queda)', () => {
  const { w, buf } = sheet();
  const f = cutFrame(buf, w, { x: 0, y: 0, width: 7, height: 6 }, [255, 255, 255]);
  const alpha = (x, y) => f.data[(y * f.width + x) * 4 + 3];
  assert.strictEqual(alpha(0, 0), 0); // fondo
  assert.strictEqual(alpha(3, 2), 255); // relleno blanco dentro del contorno
  assert.strictEqual(alpha(1, 1), 255); // contorno
  const t = trimFrame(f);
  assert.deepStrictEqual([t.width, t.height], [5, 4]);
  const [a, b] = alignFrames([t, { width: 3, height: 2, data: Buffer.alloc(24, 255) }]);
  assert.deepStrictEqual([a.width, a.height, b.width, b.height], [5, 4, 5, 4]);
  assert.strictEqual(b.data[(0 * 5 + 1) * 4 + 3], 0); // arriba queda vacío: apoyado abajo
  assert.strictEqual(b.data[(3 * 5 + 1) * 4 + 3], 255);
});
