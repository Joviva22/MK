'use strict';

// Fórmulas de bases de datos: mismo resultado que JavaScript para lo que
// documentan las guías, y sin salida a los globales de la ventana.
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../src/shared/formula');

const row = { Precio: 12.5, Cantidad: 4, Nombre: 'Ana', Prioridad: 'Alta', Hecha: true, Horas: 21, Etiquetas: ['a', 'b', 'c'], 'Último contacto': '2026-08-15', Presupuesto: 100, Gastado: 30 };
const prop = (name) => (name in row ? row[name] : null);
const run = (expr) => F.run(expr, prop);

test('ejemplos de las guías', () => {
  assert.equal(run('prop("Precio") * prop("Cantidad")'), 50);
  assert.equal(run('prop("Nombre") + " — " + prop("Prioridad")'), 'Ana — Alta');
  assert.equal(run('prop("Hecha") ? "✅" : "⏳"'), '✅');
  assert.equal(run('Math.round(prop("Horas") / 8)'), 3);
  assert.equal(run('prop("Etiquetas").length'), 3);
  assert.equal(run('prop("Presupuesto") - prop("Gastado")'), 70);
  assert.equal(run('prop("Último contacto") < "2026-09-01" ? "📞 Llamar" : ""'), '📞 Llamar');
});

test('operadores y precedencia como JavaScript', () => {
  const cases = ['1 + 2 * 3', '(1 + 2) * 3', '2 ** 3 ** 2', '10 - 4 - 3', '7 % 3', '-3 + +"4"', '!0 && "x"', 'null ?? "def"', '0 || 5',
    '1 < 2 === true', '"5" == 5', '"5" === 5', '1 ? 2 ? 3 : 4 : 5', 'typeof "a"', '1e3 + .5 + 0x10', "'it\\'s'", '`a${1 + 1}b`',
    '[1, 2, 3].map(x => x * 2).join("-")', '[1, 2, 3, 4].filter((x) => x % 2).reduce((a, b) => a + b, 0)', '({ a: 1 }).a',
    '"hola".toUpperCase().slice(0, 2)', 'Number("3.5") + parseInt("2")', 'String(12).padStart(4, "0")'];
  for (const expr of cases) assert.deepEqual(F.run(expr, prop), (0, eval)(expr), expr);
  assert.equal(run('null?.x'), undefined);
  assert.equal(run('new Date(0).getTime()'), 0);
  assert.equal(typeof run('Date.now()'), 'number');
  assert.equal(run('Array.isArray(prop("Etiquetas"))'), true);
});

test('sin acceso a globales ni a Function', () => {
  const escapes = [
    'window', 'globalThis', 'this', 'process', 'require', 'eval("1")', 'Function("return 1")',
    'prop.constructor', '"".constructor.constructor("return globalThis")()', '[].constructor', '({}).__proto__',
    'prop.call(null, "x")', 'Math.max.call', '[].map.bind', 'Number.prototype', 'Array.prototype.map',
    '"x"["const" + "ructor"]', '(x => x).constructor', 'new Function("1")', 'Object', 'Reflect', 'JSON.parse.apply',
    '({ __proto__: 1 })', '"a" = 1', 'a; b', 'Date.prototype'
  ];
  for (const expr of escapes) assert.throws(() => run(expr), undefined, expr);
});

test('errores de sintaxis claros', () => {
  assert.throws(() => run('prop("A"'), SyntaxError);
  assert.throws(() => run('"sin cerrar'), SyntaxError);
  assert.throws(() => run('1 +'), SyntaxError);
  assert.throws(() => run('1 2'), SyntaxError);
});
