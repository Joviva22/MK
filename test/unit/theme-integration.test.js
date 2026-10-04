'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '../../src/styles.css'), 'utf8');
const themes = [...css.matchAll(/\[data-theme="([^"]+)"\]\s*\{([^}]+)\}/g)]
  .map(([, name, body]) => ({ name, colors: Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(([, key, color]) => [key, color])) }))
  .filter(({ colors }) => colors.bg);
function luminance(hex) {
  const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return values.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (light + 0.05) / (dark + 0.05);
}
test('all built-in themes keep readable text, syntax and primary buttons', () => {
  assert.equal(themes.length, 27);
  for (const { name, colors } of themes) {
    for (const bg of ['bg', 'surface', 'surface-2']) {
      for (const fg of ['text', 'text-muted', 'accent', 'syntax-keyword', 'syntax-string', 'syntax-number', 'syntax-type']) {
        assert.ok(contrast(colors[fg], colors[bg]) >= 4.5, `${name}: ${fg}/${bg}`);
      }
    }
    assert.ok(contrast(colors['on-accent'], colors.accent) >= 4.5, `${name}: primary button`);
  }
});
test('Kingdom Hearts retains its night blue and gold identity', () => {
  const { colors } = themes.find(({ name }) => name === 'kingdom-hearts');
  assert.equal(colors.bg, '#0b1433');
  assert.equal(colors.accent, '#e8c45e');
});
