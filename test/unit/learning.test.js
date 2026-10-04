'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../src/shared/studylogic');
const card = { id: 'pcp-1', category: 'pcp', question: '¿Qué es una caché?', answer: 'Una copia de datos para acceder más rápido.', due: '2026-10-04T08:00:00.000Z', interval: 2, repetitions: 1, notePath: '/PCP/tema.md' };
test('tarjetas: migración vacía, duplicados, formato inválido y contenido literal', () => {
  const state = L.normalizeLearning({ cards: [card, card, { id: 'bad', question: 'Sin respuesta' }, { ...card, id: 'ec-1', category: 'ec', notePath: 'https://example.com/a.md', question: '<script>literal</script>' }], reviews: [{}] });
  assert.equal(state.cards.length, 2); assert.equal(state.cards[1].notePath, '');
  assert.equal(state.cards[1].question, '<script>literal</script>'); assert.equal(state.reviews.length, 0);
  assert.deepEqual(L.normalize({ subjects: { pcp: { materials: [{ path: '/PCP/a.md' }] } }, learning: state }).learning, state);
});
test('repaso: vencidos por asignatura y próximos intervalos, sin modificar el original', () => {
  const now = new Date('2026-10-04T10:00:00Z');
  assert.equal(L.dueCards([card, { ...card, id: 'other', category: 'ec' }, { ...card, id: 'future', due: '2026-11-01T00:00:00Z' }], 'pcp', now).length, 1);
  const again = L.scheduleCard(card, 0, now), hard = L.scheduleCard(card, 1, now), good = L.scheduleCard(card, 2, now), easy = L.scheduleCard(card, 3, now);
  assert.equal(Date.parse(again.due) - now.getTime(), 600000); assert.equal(again.repetitions, 0);
  assert.equal(hard.interval, 1); assert.equal(good.interval, 4); assert.equal(easy.interval, 6);
  assert.equal(card.interval, 2); assert.equal(L.scheduleCard({ ...card, interval: 365 }, 3, now).interval, 365);
  assert.throws(() => L.scheduleCard(card, 9, now));
});
test('examen: último resultado decide errores, repaso no borra errores de examen', () => {
  const reviews = [
    { id: 'r1', cardId: card.id, mode: 'exam', grade: 0, date: '2026-10-04T10:00:00Z', attempt: 'Mi intento' },
    { id: 'r2', cardId: card.id, mode: 'review', grade: 3, date: '2026-10-04T11:00:00Z' }
  ];
  assert.equal(L.examMistakes([card], reviews, 'pcp').length, 1);
  reviews.push({ id: 'r3', cardId: card.id, mode: 'exam', grade: 2, date: '2026-10-04T12:00:00Z' });
  assert.equal(L.examMistakes([card], reviews, 'pcp').length, 0);
  assert.equal(L.normalizeLearning({ cards: [card], reviews }).reviews[0].attempt, 'Mi intento');
});
