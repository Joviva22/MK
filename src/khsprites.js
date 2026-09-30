'use strict';

// Figuras sueltas de una hoja de sprites SIN transparencia (fondo de un
// color liso, como las hojas de Sora y Roxas): máscara "distinto del fondo",
// componentes conexos (8 vecinos) y unión de piezas muy cercanas (una
// keyblade separada del cuerpo por 1-2 px sigue siendo la misma figura).
// Lógica pura: el proceso principal le pasa el color de cada píxel.

function findBlobs({ width, height, rgbAt, bg, tolerance = 40, minArea = 30, mergeGap = 2 }) {
  const isFg = (x, y) => {
    const [r, g, b] = rgbAt(x, y);
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > tolerance;
  };
  const labels = new Int32Array(width * height).fill(-1);
  const parent = [];
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFg(x, y)) continue;
      const idx = y * width + x;
      const neigh = [];
      if (x > 0 && labels[idx - 1] >= 0) neigh.push(labels[idx - 1]);
      if (y > 0) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width && labels[idx - width + dx] >= 0) neigh.push(labels[idx - width + dx]);
        }
      }
      if (!neigh.length) {
        labels[idx] = parent.length;
        parent.push(parent.length);
      } else {
        labels[idx] = neigh[0];
        for (let i = 1; i < neigh.length; i++) union(neigh[0], neigh[i]);
      }
    }
  }
  const boxes = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = labels[y * width + x];
      if (l < 0) continue;
      const r = find(l);
      const b = boxes.get(r);
      if (!b) boxes.set(r, { x0: x, y0: y, x1: x, y1: y, area: 1 });
      else {
        if (x < b.x0) b.x0 = x;
        if (x > b.x1) b.x1 = x;
        if (y > b.y1) b.y1 = y;
        b.area++;
      }
    }
  }
  let list = Array.from(boxes.values());
  // Unir cajas que se tocan (con un margen de mergeGap px).
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < list.length && !merged; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.x0 - mergeGap <= b.x1 && b.x0 - mergeGap <= a.x1 && a.y0 - mergeGap <= b.y1 && b.y0 - mergeGap <= a.y1) {
          list[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), area: a.area + b.area };
          list.splice(j, 1);
          merged = true;
          break;
        }
      }
    }
  }
  return list
    .filter((b) => b.area >= minArea)
    .map((b) => ({ x: b.x0, y: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

// Agrupa cajas en filas (se solapan en vertical), de izquierda a derecha.
function rowsOf(boxes) {
  const rows = [];
  boxes.slice().sort((a, b) => a.y - b.y).forEach((b) => {
    const mid = b.y + b.height / 2;
    const row = rows.find((r) => mid >= r.y0 && mid <= r.y1);
    if (row) {
      row.items.push(b);
      row.y0 = Math.min(row.y0, b.y);
      row.y1 = Math.max(row.y1, b.y + b.height);
    } else rows.push({ y0: b.y, y1: b.y + b.height, items: [b] });
  });
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  return rows;
}

// Recorta rect de una hoja RGBA (buf con 4 bytes por píxel, en el orden que
// diga `order`: 'rgba' o 'bgra') y vuelve transparente SOLO el fondo que
// toca los bordes del recorte (relleno desde afuera): el blanco de la ropa
// de Sora, rodeado de contorno, se conserva. Devuelve { width, height, data }
// con data en el mismo orden de canales.
function cutFrame(buf, sheetWidth, rect, bg, order = 'rgba', tolerance = 48) {
  const { x: rx, y: ry, width: w, height: h } = rect;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    buf.copy(data, y * w * 4, ((ry + y) * sheetWidth + rx) * 4, ((ry + y) * sheetWidth + rx + w) * 4);
  }
  const [ri, gi, bi] = order === 'bgra' ? [2, 1, 0] : [0, 1, 2];
  const isBg = (i) => Math.abs(data[i + ri] - bg[0]) + Math.abs(data[i + gi] - bg[1]) + Math.abs(data[i + bi] - bg[2]) <= tolerance;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!isBg(p * 4)) continue;
    data[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  return { width: w, height: h, data };
}

// Pone varios cuadros del mismo tamaño (el mayor), apoyados abajo y
// centrados: así la animación no "salta" entre cuadros de distinto alto.
function alignFrames(frames) {
  const W = Math.max(...frames.map((f) => f.width));
  const H = Math.max(...frames.map((f) => f.height));
  return frames.map((f) => {
    const data = Buffer.alloc(W * H * 4);
    const ox = Math.floor((W - f.width) / 2);
    const oy = H - f.height;
    for (let y = 0; y < f.height; y++) f.data.copy(data, ((oy + y) * W + ox) * 4, y * f.width * 4, (y + 1) * f.width * 4);
    return { width: W, height: H, data };
  });
}

// Recorta al contenido visible (alfa > 0).
function trimFrame(f) {
  let x0 = f.width;
  let y0 = f.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      if (f.data[(y * f.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return f;
  return cutFrame(f.data, f.width, { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }, [-999, -999, -999]);
}

module.exports = { findBlobs, rowsOf, cutFrame, alignFrames, trimFrame };
