'use strict';

// Contraste de los temas (WCAG AA): texto y texto secundario ≥ 4,5:1 sobre
// el fondo y sobre --surface (paneles); color de acento ≥ 3:1 (botones,
// enlaces, bordes activos). Lee los temas de src/styles.css.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../src/styles.css'), 'utf-8');

function lum(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function themes() {
  const out = [];
  const re = /(\[data-theme="([^"]+)"\]|:root)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[3];
    const get = (k) => { const x = body.match(new RegExp('--' + k + ':\\s*(#[0-9a-fA-F]{3,8})')); return x && x[1]; };
    const t = { name: m[2] || 'claro', bg: get('bg'), surface: get('surface'), text: get('text'), muted: get('text-muted'), accent: get('accent') };
    if (t.bg && t.text) out.push(t);
  }
  return out;
}

test('hay 26 temas con colores', () => {
  assert.ok(themes().length >= 26);
});

test('todos los temas cumplen el contraste mínimo', () => {
  const bad = [];
  themes().forEach((t) => {
    const checks = [
      ['texto/fondo', t.text, t.bg, 4.5],
      ['texto/panel', t.text, t.surface, 4.5],
      ['secundario/fondo', t.muted, t.bg, 4.5],
      ['secundario/panel', t.muted, t.surface, 4.5],
      ['acento/fondo', t.accent, t.bg, 3]
    ];
    checks.forEach(([what, a, b, min]) => {
      if (a && b && ratio(a, b) < min) bad.push(`${t.name}: ${what} ${ratio(a, b).toFixed(2)} < ${min}`);
    });
  });
  assert.deepEqual(bad, []);
});
