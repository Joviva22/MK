'use strict';

// CSV de las bases de datos: separadores, comillas, números y fechas.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../src/shared/csv');

test('parseCsv: coma, punto y coma (Excel es) y tabulador', () => {
  assert.deepEqual(C.parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(C.parseCsv('a;b\r\n1,5;2\r\n'), [['a', 'b'], ['1,5', '2']]);
  assert.deepEqual(C.parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
});

test('parseCsv: comillas, "" escapado, saltos de línea dentro y filas vacías', () => {
  const rows = C.parseCsv('nombre,nota\n"Pérez, Ana","dijo ""hola""\nen dos líneas"\n\n,\n');
  assert.deepEqual(rows, [['nombre', 'nota'], ['Pérez, Ana', 'dijo "hola"\nen dos líneas']]);
});

test('csvEscape: solo cita lo que hace falta y va y vuelve', () => {
  assert.equal(C.csvEscape('simple'), 'simple');
  assert.equal(C.csvEscape('a,b'), '"a,b"');
  assert.equal(C.csvEscape('dice "no"'), '"dice ""no"""');
  assert.equal(C.csvEscape(null), '');
  const tricky = ['x,y', 'comillas "aquí"', 'línea\nnueva'];
  assert.deepEqual(C.parseCsv(tricky.map(C.csvEscape).join(',') + '\n')[0], tricky);
});

test('toNumber: formatos es y en, negativos, basura', () => {
  assert.equal(C.toNumber('1.234,5'), 1234.5);
  assert.equal(C.toNumber('1,234.5'), 1234.5);
  assert.equal(C.toNumber('-12'), -12);
  assert.equal(C.toNumber(' 3 500 '), 3500);
  assert.equal(C.toNumber('12 €'), null);
  assert.equal(C.toNumber('abc'), null);
});

test('toIsoDate: ISO y día/mes/año', () => {
  assert.equal(C.toIsoDate('2026-10-03'), '2026-10-03');
  assert.equal(C.toIsoDate('3/10/2026'), '2026-10-03');
  assert.equal(C.toIsoDate('03.10.2026'), '2026-10-03');
  assert.equal(C.toIsoDate('octubre'), null);
});
