'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const L = require('../../src/shared/pomodorologic');

test('normalización: categorías únicas, registros válidos y selección conservada', () => {
  const r = { id: 'a', date: '2026-10-03T10:00:00Z', seconds: 1500, category: ' PCP ', completed: true };
  const data = L.normalize({ categories: [' PCP ', 'PCP', null], selectedCategory: 'EC', records: [r, r, { ...r, id: 'b', seconds: -1 }, { ...r, id: 'c', date: 'mal' }] });
  assert.deepEqual(data.categories, ['PCP', 'EC']);
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].category, 'PCP');
});
test('estadísticas: dos focos PCP son 50 minutos; filtrar no cambia los datos', () => {
  const data = L.normalize({ records: [
    { id: 'a', date: '2026-10-03T10:00:00Z', seconds: 1500, category: 'PCP', completed: true },
    { id: 'b', date: '2026-10-03T11:00:00Z', seconds: 1500, category: 'PCP', completed: true },
    { id: 'c', date: '2026-10-04T10:00:00Z', seconds: 600, category: 'EC', completed: false }
  ] });
  assert.deepEqual(L.summarize(data, { category: 'PCP' }), [{ category: 'PCP', seconds: 3000, completed: 2, partial: 0 }]);
  assert.equal(L.summarize(data, { from: Date.parse('2026-10-04'), to: Date.parse('2026-10-05') })[0].seconds, 600);
  assert.equal(data.records.length, 3);
});

function store() {
  let config = {};
  let fail = false;
  const window = { mdPomodoroLogic: L, mdEditor: {
    getConfig: async () => config,
    setConfig: async (partial) => {
      if (fail) throw new Error('disco lleno');
      config = JSON.parse(JSON.stringify({ ...config, ...partial }));
      return config;
    }
  } };
  vm.runInNewContext(fs.readFileSync('src/pomodoro-history.js', 'utf8'), { window, crypto: { randomUUID }, document: { dispatchEvent() {} }, CustomEvent: class {} });
  return { api: window.mdPomodoroHistory, config: () => config, fail: (value) => { fail = value; } };
}
test('historial: escrituras simultáneas, checkpoints sin duplicación y edición persistente', async () => {
  const { api, config } = store();
  await Promise.all([api.addCategory('PCP'), api.record({ id: 'focus-a', category: 'PCP', seconds: 10 }), api.record({ id: 'focus-b', category: 'EC', seconds: 20 })]);
  await api.record({ id: 'focus-a', category: 'PCP', seconds: 1500, completed: true });
  assert.equal(api.getState().records.length, 2);
  assert.equal(config().pomodoroHistory.records.find((r) => r.id === 'focus-a').seconds, 1500);
  await api.edit('focus-a', { date: '2026-10-03T10:00:00Z', category: 'EC', seconds: 3000, completed: true });
  await api.renameCategory('EC', 'Estudio');
  assert.equal(config().pomodoroHistory.records[0].category, 'Estudio');
  await api.remove('focus-b');
  assert.equal(api.getState().records.length, 1);
  await assert.rejects(api.edit('focus-a', { date: 'no', seconds: -3 }));
  assert.equal(api.getState().records[0].seconds, 3000);
});
test('historial: fallo de disco conserva el cambio en memoria y permite reintentar', async () => {
  const s = store();
  s.fail(true);
  await assert.rejects(s.api.record({ category: 'PCP', seconds: 60 }), /disco lleno/);
  assert.equal(s.api.isDirty(), true);
  assert.equal(s.api.getState().records.length, 1);
  s.fail(false);
  await s.api.retry();
  assert.equal(s.api.isDirty(), false);
  assert.equal(s.config().pomodoroHistory.records[0].seconds, 60);
});

function timer(focusMinutes = 1) {
  let now = 0;
  let tick;
  const records = new Map();
  const gains = [];
  const nodes = new Map();
  const window = {
    mdPomodoroLogic: L,
    mdLuckyEmblem: { mini: () => 'emblem' },
    mdPet: { gain: (kind, key, seconds) => gains.push({ kind, key, seconds }) },
    mdEditor: { getConfig: async () => ({ pomodoroFocusMinutes: focusMinutes, pomodoroBreakMinutes: 0.5 }), logError() {} },
    mdPomodoroHistory: { ready: Promise.resolve(), getState: () => ({ selectedCategory: 'PCP' }), selectCategory: async () => {}, record: async (r) => { records.set(r.id, r); } }
  };
  const ctx = { window, document: { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { addEventListener() {}, append() {} });
    return nodes.get(id);
  } }, performance: { now: () => now }, crypto: { randomUUID }, Notification: class {}, alert: (message) => { throw new Error(message); }, setInterval: (fn) => { tick = fn; return 1; }, clearInterval: () => { tick = null; } };
  vm.runInNewContext(fs.readFileSync('src/pomodoro.js', 'utf8'), ctx);
  return { api: window.mdPomodoro, window, records, gains, advance: async (ms) => {
    now += ms; if (tick) tick();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  } };
}
test('temporizador: pausa y descanso no cuentan, foco completado cuenta una sola vez', async () => {
  const t = timer();
  await t.api.toggle();
  await t.advance(15000);
  await t.api.toggle();
  await t.advance(120000);
  assert.equal(t.api.getState().elapsedSeconds, 15);
  await t.api.toggle();
  await t.advance(45000);
  assert.equal(t.api.getState().phase, 'break');
  assert.equal(t.records.size, 1);
  assert.equal([...t.records.values()][0].seconds, 60);
  assert.equal([...t.records.values()][0].completed, true);
  assert.equal(t.gains.length, 1);
  assert.deepEqual(t.gains[0], { kind: 'pomodoro', key: null, seconds: 60 });
  await t.advance(30000);
  assert.equal(t.api.getState().phase, 'focus');
  assert.equal(t.records.size, 1);
  await t.api.reset();
});
test('temporizador: un foco de dos horas entrega 7200 segundos efectivos para calcular XP', async () => {
  const t = timer(120);
  await t.api.toggle();
  await t.advance(7200000);
  assert.equal(t.api.getState().phase, 'break');
  assert.equal(t.gains.length, 1);
  assert.equal(t.gains[0].seconds, 7200);
  await t.api.reset();
});
test('temporizador: editar lo restante no inventa tiempo; finalizar guarda un parcial', async () => {
  const t = timer();
  await t.api.toggle();
  await t.advance(10000);
  t.api.configure('EC', 50);
  await t.advance(5000);
  await t.api.reset();
  const record = [...t.records.values()][0];
  assert.equal(record.seconds, 15);
  assert.equal(record.category, 'EC');
  assert.equal(record.completed, false);
  assert.equal(t.gains.length, 0);
});
test('temporizador: retraso del intervalo no cuenta más que la duración del foco', async () => {
  const t = timer();
  await t.api.toggle();
  await t.advance(600000);
  assert.equal([...t.records.values()][0].seconds, 60);
  assert.equal(t.gains[0].seconds, 60);
  assert.equal(t.api.getState().remainingSeconds, 30);
  await t.api.reset();
});

test('contexto: registros antiguos se conservan y el filtro de nota no mezcla rutas', () => {
  const data = L.normalize({ records: [
    { id: 'old', date: '2026-10-03T10:00:00Z', seconds: 1500, category: 'PCP', task: 'Práctica' },
    { id: 'new', date: '2026-10-03T10:00:00Z', seconds: 600, category: 'PCP', notePath: '/PCP/tema 1.md', detail: ' Ejercicio 4 ' },
    { id: 'other', date: '2026-10-03T10:00:00Z', seconds: 900, category: 'PCP', notePath: '/EC/tema 1.md' }
  ] });
  assert.equal(data.records[0].task, 'Práctica');
  assert.equal(data.records[0].notePath, '');
  assert.equal(data.records[1].detail, 'Ejercicio 4');
  assert.equal(L.summarize(data, { notePath: '/PCP/tema 1.md' })[0].seconds, 600);
  assert.equal(L.summarize(data, { notePath: '' })[0].seconds, 1500);
  assert.equal(L.notePath('https://example.com/tema.md'), '');
  assert.equal(L.notePath('/tmp/nota\n.md'), '');
});

test('historial: editar duración conserva contexto; detalle y vínculo se pueden corregir', async () => {
  const s = store();
  await s.api.record({ id: 'a', category: 'PCP', seconds: 60, notePath: '/PCP/tema.md', detail: 'Práctica 4', task: 'Tarea Home' });
  const values = { date: '2026-10-03T10:00:00Z', category: 'PCP', seconds: 120, completed: true };
  await s.api.edit('a', values);
  assert.equal(s.api.getState().records[0].notePath, '/PCP/tema.md');
  assert.equal(s.api.getState().records[0].detail, 'Práctica 4');
  await s.api.edit('a', { ...values, notePath: '', detail: 'Repaso' });
  const r = L.normalize(s.config().pomodoroHistory).records[0];
  assert.equal(r.task, 'Tarea Home');
  assert.equal(r.detail, 'Repaso');
  assert.equal(r.notePath, '');
});

test('temporizador: foco vinculado captura su nota, cambiar pestaña no mueve tiempo ni inventa XP', async () => {
  const t = timer();
  let activePath = '/PCP/nota.md';
  t.window.mdTabs = { getActiveTabInfo: () => ({ filePath: activePath }) };
  t.window.mdCodeMirror = { getOption: () => 'markdown' };
  await t.api.startForNote();
  t.api.setContext(t.api.getState().notePath, 'Ejercicios');
  activePath = '/EC/otra.md';
  await t.advance(10000);
  await t.api.reset();
  const r = [...t.records.values()][0];
  assert.equal(r.notePath, '/PCP/nota.md');
  assert.equal(r.detail, 'Ejercicios');
  assert.equal(r.seconds, 10);
  assert.equal(t.gains.length, 0);
  assert.equal(t.api.getState().notePath, '');
  activePath = null;
  await assert.rejects(t.api.startForNote(), /guarda/);
  assert.equal(t.api.getState().phase, 'idle');
});

test('temporizador: cambiar contexto reclasifica el foco completo; la tarea Home no se pierde', async () => {
  const t = timer();
  await t.api.startFor('Entrega', () => true, 'PCP');
  await t.advance(15000);
  t.api.setContext('/PCP/tema.md', 'Repaso');
  await t.advance(5000);
  await t.api.reset();
  assert.equal(t.records.size, 1);
  const r = [...t.records.values()][0];
  assert.equal(r.task, 'Entrega');
  assert.equal(r.seconds, 20);
  assert.equal(r.notePath, '/PCP/tema.md');
});

test('temporizador: foco de asignatura guarda el parcial anterior antes de cambiar contexto', async () => {
  const t = timer();
  await t.api.toggle(); await t.advance(10000);
  await t.api.startForContext('EC', '/EC/tema.md', 'Asignatura EC');
  await t.advance(5000); await t.api.reset();
  const records = [...t.records.values()];
  assert.equal(records.length, 2);
  assert.equal(records[0].category, 'PCP'); assert.equal(records[0].seconds, 10);
  assert.equal(records[1].category, 'EC'); assert.equal(records[1].seconds, 5);
  assert.equal(records[1].notePath, '/EC/tema.md'); assert.equal(records[1].detail, 'Asignatura EC');
  assert.equal(t.gains.length, 0);
});
