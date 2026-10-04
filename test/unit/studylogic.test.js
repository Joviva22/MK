'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../src/shared/studylogic');
const H = require('../../src/shared/homelogic');
test('materiales: normaliza, deduplica y no admite enlaces remotos ni tipos ajenos', () => {
  const data = L.normalize({ subjects: { pcp: { pomodoroCategory: ' PCP ', materials: [
    { path: '/PCP/tema 1.md' }, { path: '/PCP/tema 1.md' }, { path: '/PCP/referencia.PDF', label: 'PDF' },
    { path: 'https://example.com/a.pdf' }, { path: '/tmp/a.sh' }, { path: '/tmp/nota\n.md' }, { path: '/PCP/esquema.excalidraw' }
  ] } } });
  assert.equal(data.subjects.pcp.materials.length, 3);
  assert.equal(data.subjects.pcp.pomodoroCategory, 'PCP');
  assert.equal(data.subjects.pcp.materials[0].label, 'tema 1.md');
  assert.deepEqual(JSON.parse(JSON.stringify(L.normalize(null))), { version: 1, subjects: {}, planMinutes: 100, learning: { cards: [], reviews: [] } });
  const special = L.normalize(JSON.parse('{"subjects":{"__proto__":{"materials":[]}}}'));
  assert.equal(Object.getPrototypeOf(special.subjects), null);
});
test('plan de hoy: vencimientos, todas las asignaturas, presupuesto y tareas completadas', () => {
  const cats = [{ id: 'pcp', name: 'PCP' }, { id: 'ec', name: 'EC' }];
  const tasks = [
    { id: 'later', category: 'pcp', title: 'Futura', date: '2026-11-01' },
    { id: 'none', category: 'pcp', title: 'Sin fecha' },
    { id: 'soon', category: 'ec', title: 'Próxima', date: '2026-10-06' },
    { id: 'today', category: 'ec', title: 'Hoy', date: '2026-10-04' },
    { id: 'late', category: 'pcp', title: 'Atrasada', date: '2026-10-01' },
    { id: 'done', category: 'pcp', title: 'Hecha', date: '2026-10-01', done: true }
  ];
  const result = L.todayPlan(tasks, cats, '2026-10-04', H, 75);
  assert.deepEqual(result.items.map((i) => i.task.id), ['late', 'today', 'soon']);
  assert.equal(result.pending, 5); assert.equal(result.focusMinutes, 75);
  assert.equal(L.todayPlan(tasks, cats, '2026-10-04', H, 0).items.length, 0);
  assert.equal(L.normalize({ planMinutes: -1 }).planMinutes, 100);
  assert.equal(tasks.length, 6);
});
test('tiempo: respeta categoría y límites locales de hoy/semana, sin mezclar asignaturas', () => {
  const now = new Date(2026, 9, 4, 12); // domingo; semana empieza el lunes
  const records = [
    { category: 'PCP', date: new Date(2026, 9, 4, 9).toISOString(), seconds: 1500 },
    { category: 'PCP', date: new Date(2026, 8, 28, 10).toISOString(), seconds: 600 },
    { category: 'PCP', date: new Date(2026, 8, 27, 10).toISOString(), seconds: 300 },
    { category: 'EC', date: now.toISOString(), seconds: 900 },
    { category: 'PCP', date: 'mal', seconds: 900 }
  ];
  assert.deepEqual(L.focusTotals(records, 'PCP', now), { today: 1500, week: 2100, all: 2400 });
});
test('tareas: incluye atrasadas/sin fecha, excluye completadas y muestra próxima repetición pendiente', () => {
  const tasks = [
    { id: 'a', category: 'pcp', title: 'Atrasada', date: '2026-10-01' },
    { id: 'b', category: 'pcp', title: 'Sin fecha' },
    { id: 'c', category: 'pcp', title: 'Hecha', done: true },
    { id: 'd', category: 'ec', title: 'Otra' },
    { id: 'e', category: 'pcp', title: 'Diaria', date: '2026-10-01', repeat: { freq: 'daily' }, doneDates: ['2026-10-04'], skipDates: ['2026-10-05'] }
  ];
  const entries = L.pendingTasks(tasks, 'pcp', '2026-10-04', H);
  assert.deepEqual(entries.map((entry) => entry.task.id), ['a', 'e', 'b']);
  assert.equal(entries[1].date, '2026-10-06');
  assert.equal(tasks.length, 5);
});
