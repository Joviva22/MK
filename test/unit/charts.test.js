'use strict';

// Gráficos: lectura de números es/en, bloque ```chart``` y escala. charts.js
// es un script de la ventana: se carga en un contexto aislado con un
// "window" mínimo (solo se prueban las funciones que no dibujan).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: { addEventListener() {} }, document: { addEventListener() {} }, ResizeObserver: class { observe() {} unobserve() {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../src/charts.js'), 'utf-8'), sandbox);
const C = sandbox.window.mdCharts;

test('parseChartBlock: opciones, tabla y números en formato es/en', () => {
  const b = C.parseChartBlock(['tipo: torta', 'título: Gastos', 'valor: Monto', '| Cat | Monto |', '|---|---|', '| Comida | 1.234,5 |', '| Casa | 12 € |', '| Ocio | 45% |'].join('\n'));
  assert.equal(b.type, 'pie');
  assert.equal(b.title, 'Gastos');
  assert.deepEqual(Array.from(b.data, (d) => [d.label, d.value]), [['Comida', 1234.5], ['Casa', 12], ['Ocio', 45]]);
});

test('parseChartBlock: sin tabla o sin la columna → error claro', () => {
  assert.ok(C.parseChartBlock('tipo: barras').error);
  assert.ok(C.parseChartBlock('valor: Nada\n| a | b |\n|---|---|\n| x | 1 |').error);
});

test('niceScale: máximo redondo por encima del valor y pasos parejos', () => {
  const a = C.niceScale(87);
  assert.equal(a.max, 100);
  assert.deepEqual(Array.from(a.ticks), [0, 25, 50, 75, 100]);
  const b = C.niceScale(3);
  assert.ok(b.max >= 3 && b.ticks[0] === 0);
  assert.deepEqual(JSON.parse(JSON.stringify(C.niceScale(0))), { max: 1, ticks: [0, 1] }, 'sin datos: escala mínima');
});
