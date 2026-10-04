'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../src/shared/studylogic');
test('temas conservan enlaces, deduplican y normalizan estados sin afectar tarjetas', () => {
  const result = L.normalize({ subjects: { pcp: { topics: [
    { id: 't', title: ' Semáforos ', status: 'invalid', materials: ['/a.pdf', '/a.pdf', 'https://a.pdf'], cardIds: ['c', 'c'] },
    { id: 't', title: 'Duplicado' }, { id: 'empty', title: '' }
  ] } } });
  assert.deepEqual(result.subjects.pcp.topics, [{ id: 't', title: 'Semáforos', status: 'pending', materials: ['/a.pdf'], cardIds: ['c'] }]);
  assert.deepEqual(L.normalize(result), result);
});
test('evidencia usa tarjetas de la asignatura y último examen; no cambia autoevaluación', () => {
  const topic = { status: 'mastered', cardIds: ['a', 'b', 'other', 'deleted'] };
  const learning = { cards: [{ id: 'a', category: 'pcp', due: '2026-01-01' }, { id: 'b', category: 'pcp', due: '2027-01-01' }, { id: 'other', category: 'ec', due: '2026-01-01' }],
    reviews: [{ cardId: 'a', mode: 'exam', date: '2026-01-01', grade: 0 }, { cardId: 'a', mode: 'exam', date: '2026-02-01', grade: 2 }, { cardId: 'b', mode: 'exam', date: '2026-01-01', grade: 0 }] };
  assert.deepEqual(L.topicEvidence(topic, learning, 'pcp', new Date('2026-10-04')), { cards: 2, missing: 2, due: 1, mistakes: 1 });
  assert.equal(topic.status, 'mastered');
});
test('resumen respeta semana local, fecha real, archivo duplicado y categorías compartidas', () => {
  const now = new Date(2026, 9, 4, 12);
  const categories = [{ id: 'a', name: 'PCP' }, { id: 'b', name: 'EC' }];
  const study = { subjects: { a: { pomodoroCategory: 'Study' }, b: { pomodoroCategory: 'Study' } } };
  const tasks = [{ id: 'done', category: 'a', done: true, date: '2025-01-01', doneAt: '2026-10-04' },
    { id: 'done', category: 'a', done: true, doneAt: '2026-10-04' }, { id: 'unknown', category: 'a', done: true },
    { id: 'repeat', category: 'a', repeat: { freq: 'daily' }, doneDates: ['2026-09-28', '2026-09-28', '2026-10-05'] }];
  const records = [{ category: 'Study', seconds: 1500, date: now.toISOString() }, { category: 'Study', seconds: 900, date: new Date(2026, 8, 27, 12).toISOString() }];
  const report = L.weeklySummary(study, categories, tasks, records, now);
  assert.equal(report.from, '2026-09-28'); assert.equal(report.until, '2026-10-05');
  assert.equal(report.rows[0].completed, 1); assert.equal(report.rows[0].repetitions, 1); assert.equal(report.rows[0].undated, 1);
  assert.equal(report.rows[0].seconds, 1500); assert.equal(report.rows[1].seconds, 1500);
  assert.equal(L.weeklySummary(study, categories, tasks, records, now, -1).rows[0].seconds, 900);
});
