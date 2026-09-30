'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildMatcher, replaceIn } = require('../../src/shared/replace');

test('reemplazo literal: sin distinguir mayúsculas, $ no se interpreta', () => {
  const { re } = buildMatcher('gato', {});
  const r = replaceIn('Gato y gato\nperro\ngatos', re, '$1 michi', {});
  assert.strictEqual(r.count, 3);
  assert.strictEqual(r.output, '$1 michi y $1 michi\nperro\n$1 michis');
  assert.deepStrictEqual(r.samples.map((s) => s.line), [1, 3]);
});

test('palabra completa (con tildes) y mayúsculas', () => {
  const { re } = buildMatcher('año', { wholeWord: true, caseSensitive: true });
  const r = replaceIn('año, añoso, Año, el año.', re, 'ciclo', {});
  assert.strictEqual(r.output, 'ciclo, añoso, Año, el ciclo.');
});

test('expresión regular con grupos; errores claros', () => {
  const { re } = buildMatcher('(\\d{4})-(\\d{2})', { regex: true });
  assert.strictEqual(replaceIn('2026-09 y 2025-01', re, '$2/$1', { regex: true }).output, '09/2026 y 01/2025');
  assert.ok(buildMatcher('(', { regex: true }).error);
  assert.ok(buildMatcher('a*', { regex: true }).error, 'coincide con vacío');
  assert.ok(buildMatcher('', {}).error);
  assert.strictEqual(replaceIn('nada', buildMatcher('zzz', {}).re, 'x', {}).count, 0);
});
