'use strict';

// Recorta una hoja de sprites (varias keyblades una al lado de la otra,
// fondo transparente) en rectángulos: columnas con algún píxel visible,
// agrupadas (con tolerancia a huecos de 1-2 px dentro de un dibujo) y
// ajustadas arriba/abajo. Lógica pura (pruebas en test/unit): el proceso
// principal le pasa el alfa de cada píxel (ver ipc-kh.js).

const ALPHA_MIN = 16;
const MAX_GAP = 2;
const MIN_WIDTH = 4;

function sliceSheet({ width, height, alphaAt }) {
  const colHas = [];
  for (let x = 0; x < width; x++) {
    let any = false;
    for (let y = 0; y < height && !any; y++) any = alphaAt(x, y) >= ALPHA_MIN;
    colHas.push(any);
  }
  const segments = [];
  let start = -1;
  let gap = 0;
  for (let x = 0; x <= width; x++) {
    const on = x < width && colHas[x];
    if (on) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > MAX_GAP || x === width) {
        const end = x - gap; // última columna con algo
        if (end - start + 1 >= MIN_WIDTH) segments.push([start, end]);
        start = -1;
        gap = 0;
      }
    }
  }
  return segments.map(([x0, x1]) => {
    let y0 = height;
    let y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = x0; x <= x1; x++) {
        if (alphaAt(x, y) >= ALPHA_MIN) {
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          break;
        }
      }
    }
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }).filter((r) => r.height > 0);
}

module.exports = { sliceSheet };
