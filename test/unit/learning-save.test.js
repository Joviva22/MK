'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../../src/shared/studylogic');
function boot() {
  const original = { categories: [{ id: 'pcp', name: 'PCP' }], study: L.normalize({ learning: { cards: [{ id: 'c1', category: 'pcp', question: 'Pregunta', answer: 'Referencia', due: '2020-01-01T00:00:00Z', interval: 2, repetitions: 1 }], reviews: [] } }) };
  let allow = false, persisted = null, savedRoot, serial = 0;
  const context = vm.createContext({ data: original, dataRoot: '/old', saveTimer: null, clearTimeout,
    window: { mdStudyLogic: L, addEventListener() {}, crypto: { randomUUID: () => `review-${++serial}` },
      mdEditor: { homeSave: async (value, root) => { savedRoot = root; if (!allow) return false; persisted = JSON.parse(JSON.stringify(value)); return true; }, homeLoad: async () => persisted } },
    confirm: () => true });
  const source = fs.readFileSync(path.join(__dirname, '../../src/home-learning.js'), 'utf8').replace(/^import[^\n]+\n/, '');
  vm.runInContext(source, context);
  vm.runInContext("selectedId = 'pcp'; profile = '/old'; session = { mode: 'review', ids: ['c1'], index: 0, revealed: true, attempt: 'Respuesta', scored: 0, correct: 0 };", context);
  return { context, original, allow: () => { allow = true; }, savedRoot: () => savedRoot };
}
test('guardado fallido: no avanza ni permite cierre; reintento no duplica valoración', async () => {
  const runtime = boot();
  await vm.runInContext('run(() => grade(2))', runtime.context);
  assert.equal(vm.runInContext('session.index', runtime.context), 0);
  assert.equal(vm.runInContext('close()', runtime.context), false);
  assert.equal(runtime.original.study.learning.reviews.length, 1);
  assert.equal(runtime.original.study.learning.cards[0].interval, 4);
  runtime.allow();
  await vm.runInContext('run(retry)', runtime.context);
  assert.equal(vm.runInContext('session.index', runtime.context), 1);
  assert.equal(vm.runInContext('pending', runtime.context), null);
  assert.equal(runtime.original.study.learning.reviews.length, 1);
  assert.equal(runtime.original.study.learning.cards[0].interval, 4);
});
test('reintento tras cambiar Home conserva destino original y no toca asignatura nueva', async () => {
  const runtime = boot();
  await vm.runInContext('run(() => grade(2))', runtime.context);
  runtime.context.data = { categories: [{ id: 'ec', name: 'EC' }], study: L.normalize(null) };
  runtime.context.dataRoot = '/new'; runtime.allow();
  await vm.runInContext('run(retry)', runtime.context);
  assert.equal(runtime.savedRoot(), '/old');
  assert.equal(runtime.context.data.study.learning.cards.length, 0);
  assert.equal(runtime.original.study.learning.reviews.length, 1);
  assert.equal(vm.runInContext('pending', runtime.context), null);
});
