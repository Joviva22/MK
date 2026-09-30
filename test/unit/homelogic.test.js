'use strict';

// Lógica del Home: fechas, recurrencias, tareas "📅" en notas, @categoría.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../../src/shared/homelogic');

test('iso / parseIso / addDays: ida y vuelta, fin de mes y año bisiesto', () => {
  assert.equal(H.iso(H.parseIso('2026-10-03')), '2026-10-03');
  assert.equal(H.iso(H.addDays(H.parseIso('2026-01-31'), 1)), '2026-02-01');
  assert.equal(H.iso(H.addDays(H.parseIso('2028-02-28'), 1)), '2028-02-29');
  assert.equal(H.iso(H.addDays(H.parseIso('2026-12-31'), 1)), '2027-01-01');
  assert.equal(H.iso(H.addDays(H.parseIso('2026-03-01'), -1)), '2026-02-28');
});

test('weekdayIdx: lunes 0 … domingo 6', () => {
  assert.equal(H.weekdayIdx(H.parseIso('2026-09-28')), 0); // lunes
  assert.equal(H.weekdayIdx(H.parseIso('2026-10-04')), 6); // domingo
});

test('occursOn: diaria, hábiles, semanal, mensual, anual, hasta y saltos', () => {
  const t = (repeat, extra) => ({ date: '2026-09-28', repeat, ...extra });
  assert.equal(H.occursOn(t({ freq: 'daily' }), '2026-09-27'), false, 'antes de empezar no');
  assert.equal(H.occursOn(t({ freq: 'daily' }), '2026-10-10'), true);
  assert.equal(H.occursOn(t({ freq: 'weekdays' }), '2026-10-03'), false, 'sábado no');
  assert.equal(H.occursOn(t({ freq: 'weekdays' }), '2026-10-02'), true, 'viernes sí');
  assert.equal(H.occursOn(t({ freq: 'weekly' }), '2026-10-05'), true, 'mismo día de la semana que empezó');
  assert.equal(H.occursOn(t({ freq: 'weekly', days: [0, 2] }), '2026-09-30'), true, 'miércoles elegido (lunes = 0)');
  assert.equal(H.occursOn(t({ freq: 'weekly', days: [0, 2] }), '2026-10-01'), false, 'jueves no elegido');
  assert.equal(H.occursOn(t({ freq: 'monthly' }), '2026-11-28'), true);
  assert.equal(H.occursOn(t({ freq: 'monthly' }), '2026-11-27'), false);
  assert.equal(H.occursOn(t({ freq: 'yearly' }), '2027-09-28'), true);
  assert.equal(H.occursOn(t({ freq: 'daily', until: '2026-09-30' }), '2026-10-01'), false, 'después de "hasta" no');
  assert.equal(H.occursOn(t({ freq: 'daily' }, { skipDates: ['2026-09-29'] }), '2026-09-29'), false, 'día salteado');
  assert.equal(H.occursOn({ date: '2026-09-28' }, '2026-09-28'), false, 'sin repetición no es recurrente');
});

test('parseNoteTasks: lee "- [ ] … 📅 fecha", marca hechas e ignora código', () => {
  const md = [
    '# Pendientes',
    '- [ ] Entregar TP 📅 2026-10-03',
    '* [x] Comprar pan 📅 2026-10-01 #casa',
    '- [ ] Sin fecha',
    'Ejemplo en línea: `- [ ] no es tarea 📅 2026-10-05`',
    '```',
    '- [ ] tampoco 📅 2026-10-06',
    '```',
    '~~~md',
    '- [ ] ni esta 📅 2026-10-07',
    '~~~'
  ].join('\n');
  const items = H.parseNoteTasks('/n.md', md);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => [i.title, i.date, i.done, i.line]), [
    ['Entregar TP', '2026-10-03', false, 1],
    ['Comprar pan #casa', '2026-10-01', true, 2]
  ]);
});

test('parseCategoryToken: prefijo, sin tildes, en cualquier lugar; desconocida se deja', () => {
  const cats = [{ id: 'universidad', name: 'Universidad' }, { id: 'economia', name: 'Economía' }];
  assert.deepEqual(H.parseCategoryToken('@uni repasar parcial', cats), { title: 'repasar parcial', category: 'universidad' });
  assert.deepEqual(H.parseCategoryToken('pagar luz @econ', cats), { title: 'pagar luz', category: 'economia' });
  assert.deepEqual(H.parseCategoryToken('pagar luz @ECONOMÍA', cats), { title: 'pagar luz', category: 'economia' });
  assert.deepEqual(H.parseCategoryToken('mail a juan@empresa.com', cats), { title: 'mail a juan@empresa.com', category: null });
  assert.deepEqual(H.parseCategoryToken('algo @xyz', cats), { title: 'algo @xyz', category: null });
});
