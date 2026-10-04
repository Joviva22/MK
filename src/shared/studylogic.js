(function (root) {
'use strict';
function materialPath(value) {
  return typeof value === 'string' && value.startsWith('/') && value.length <= 4096 && !/[\x00-\x1f]/.test(value) && /\.(md|markdown|pdf|excalidraw)$/i.test(value) ? value : '';
}
function normalize(source) {
  const subjects = Object.create(null);
  for (const [id, value] of Object.entries(source?.subjects || {})) {
    if (!value || typeof value !== 'object') continue;
    const seen = new Set();
    const materials = [];
    for (const entry of Array.isArray(value.materials) ? value.materials : []) {
      const path = materialPath(entry?.path);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      materials.push({ path, label: String(entry.label || path.split('/').pop()).trim().slice(0, 120) });
    }
    const topicIds = new Set();
    const topics = [];
    for (const topic of Array.isArray(value.topics) ? value.topics : []) {
      if (typeof topic?.id !== 'string' || !topic.id || topic.id.length > 120 || topicIds.has(topic.id)) continue;
      const title = String(topic.title || '').trim().slice(0, 160);
      if (!title) continue;
      topicIds.add(topic.id);
      topics.push({ id: topic.id, title, status: ['pending', 'practicing', 'mastered'].includes(topic.status) ? topic.status : 'pending',
        materials: [...new Set((Array.isArray(topic.materials) ? topic.materials : []).map(materialPath).filter(Boolean))],
        cardIds: [...new Set((Array.isArray(topic.cardIds) ? topic.cardIds : []).filter((key) => typeof key === 'string' && key && key.length <= 120))] });
    }
    subjects[id] = { materials, topics, pomodoroCategory: String(value.pomodoroCategory || '').trim().slice(0, 80) };
  }
  const minutes = Number(source?.planMinutes);
  return { version: 1, subjects, planMinutes: Number.isInteger(minutes) && minutes >= 25 && minutes <= 720 ? minutes : 100, learning: normalizeLearning(source?.learning) };
}
function normalizeLearning(source) {
  const ids = new Set();
  const cards = [];
  for (const value of Array.isArray(source?.cards) ? source.cards : []) {
    if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 120 || ids.has(value.id)) continue;
    const question = String(value.question || '').trim().slice(0, 8000);
    const answer = String(value.answer || '').trim().slice(0, 16000);
    if (!question || !answer || typeof value.category !== 'string') continue;
    ids.add(value.id);
    const due = Date.parse(value.due);
    cards.push({ id: value.id.slice(0, 120), category: value.category.slice(0, 120), question, answer,
      notePath: /\.(md|markdown)$/i.test(value.notePath || '') ? materialPath(value.notePath) : '',
      due: Number.isFinite(due) ? new Date(due).toISOString() : '1970-01-01T00:00:00.000Z',
      interval: Math.max(0, Math.min(365, Number(value.interval) || 0)), repetitions: Number.isFinite(Number(value.repetitions)) ? Math.max(0, Math.min(1000000, Math.floor(Number(value.repetitions)))) : 0 });
  }
  const reviewIds = new Set();
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const reviews = [];
  for (const value of Array.isArray(source?.reviews) ? source.reviews : []) {
    if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 120 || reviewIds.has(value.id) || typeof value.cardId !== 'string' || !['review', 'exam'].includes(value.mode) || ![0, 1, 2, 3].includes(value.grade) || !Number.isFinite(Date.parse(value.date))) continue;
    reviewIds.add(value.id);
    const origin = cardsById.get(value.cardId);
    reviews.push({ id: value.id, cardId: value.cardId, category: String(value.category || origin?.category || '').slice(0, 120), question: String(value.question || origin?.question || '').slice(0, 8000), mode: value.mode, grade: value.grade, date: new Date(value.date).toISOString(), attempt: String(value.attempt || '').slice(0, 16000) });
  }
  return { cards, reviews };
}
function dueCards(cards, category, now = new Date()) {
  return cards.filter((card) => (!category || card.category === category) && Date.parse(card.due) <= now.getTime()).sort((a, b) => a.due.localeCompare(b.due) || a.question.localeCompare(b.question));
}
function scheduleCard(card, grade, now = new Date()) {
  if (![0, 1, 2, 3].includes(grade) || !Number.isFinite(now.getTime())) throw new Error('Valoración o fecha inválida.');
  const interval = grade === 0 ? 0 : grade === 1 ? 1 : grade === 2 ? Math.max(1, Math.min(365, Math.round((card.interval || 0) * 2))) : Math.max(4, Math.min(365, Math.round((card.interval || 0) * 3)));
  const due = new Date(now.getTime() + (grade === 0 ? 600000 : 0));
  if (grade !== 0) due.setDate(due.getDate() + interval);
  return { ...card, interval, due: due.toISOString(), repetitions: grade === 0 ? 0 : card.repetitions + 1 };
}
function examMistakes(cards, reviews, category) {
  const latest = new Map();
  for (const review of reviews) if (review.mode === 'exam' && (!latest.has(review.cardId) || latest.get(review.cardId).date <= review.date)) latest.set(review.cardId, review);
  return cards.filter((card) => (!category || card.category === category) && latest.get(card.id)?.grade < 2);
}
function focusTotals(records, category, now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const monday = new Date(today); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const nextMonday = new Date(monday); nextMonday.setDate(nextMonday.getDate() + 7);
  const result = { today: 0, week: 0, all: 0 };
  for (const record of records || []) {
    const time = Date.parse(record.date);
    if (record.category !== category || !Number.isFinite(time) || !Number.isFinite(record.seconds) || record.seconds <= 0) continue;
    result.all += record.seconds;
    if (time >= today.getTime() && time < tomorrow.getTime()) result.today += record.seconds;
    if (time >= monday.getTime() && time < nextMonday.getTime()) result.week += record.seconds;
  }
  return result;
}
function pendingTasks(tasks, categoryId, today, logic) {
  const entries = [];
  for (const task of tasks || []) {
    if (task.category !== categoryId) continue;
    if (!task.repeat?.freq) {
      if (!task.done) entries.push({ task, date: task.date || null, done: false, recurring: false });
      continue;
    }
    // Una fila por serie: su siguiente ocurrencia pendiente en 30 días.
    for (let i = 0; i <= 30; i++) {
      const date = logic.iso(logic.addDays(logic.parseIso(today), i));
      if (logic.occursOn(task, date) && !(task.doneDates || []).includes(date)) {
        entries.push({ task, date, done: false, recurring: true }); break;
      }
    }
  }
  return entries.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || String(a.task.title).localeCompare(String(b.task.title)));
}
function todayPlan(tasks, categories, today, logic, minutes = 100) {
  const week = logic.iso(logic.addDays(logic.parseIso(today), 7));
  const rank = (item) => !item.date ? 3 : item.date < today ? 0 : item.date === today ? 1 : item.date <= week ? 2 : 4;
  const items = categories.flatMap((cat) => pendingTasks(tasks, cat.id, today, logic).map((item) => ({ ...item, category: cat })));
  items.sort((a, b) => rank(a) - rank(b) || (a.date || '9999').localeCompare(b.date || '9999') || String(a.task.title).localeCompare(String(b.task.title)));
  const budget = Number.isFinite(minutes) ? Math.max(0, Math.min(720, minutes)) : 100;
  return { items: items.slice(0, Math.floor(budget / 25)), pending: items.length, focusMinutes: Math.floor(budget / 25) * 25 };
}
function topicEvidence(topic, learning, category, now = new Date()) {
  const ids = new Set(topic.cardIds);
  const cards = learning.cards.filter((card) => card.category === category && ids.has(card.id));
  return { cards: cards.length, missing: ids.size - cards.length, due: dueCards(cards, category, now).length,
    mistakes: examMistakes(cards, learning.reviews, category).length };
}
function weeklySummary(source, categories, tasks, records, now = new Date(), offset = 0) {
  const study = normalize(source);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7 + Math.min(0, Math.trunc(offset) || 0) * 7);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const from = iso(start), until = iso(end);
  const uniqueTasks = [...new Map((tasks || []).map((task) => [task.id, task])).values()];
  const rows = categories.map((cat) => {
    const subject = study.subjects[cat.id]; const mapping = subject?.pomodoroCategory || cat.name;
    let completed = 0, repetitions = 0, undated = 0;
    for (const task of uniqueTasks.filter((task) => task.category === cat.id)) {
      if (task.repeat?.freq) repetitions += [...new Set(task.doneDates || [])].filter((date) => date >= from && date < until).length;
      else if (task.done) { if (!task.doneAt) undated++; else if (task.doneAt >= from && task.doneAt < until) completed++; }
    }
    const seconds = (records || []).filter((r) => r.category === mapping && Date.parse(r.date) >= start.getTime() && Date.parse(r.date) < end.getTime() && Number.isFinite(r.seconds) && r.seconds > 0).reduce((sum, r) => sum + r.seconds, 0);
    const attention = (subject?.topics || []).map((topic) => ({ ...topic, ...topicEvidence(topic, study.learning, cat.id, now) })).filter((topic) => topic.status !== 'mastered' || topic.due || topic.mistakes);
    return { id: cat.id, name: cat.name, mapping, seconds, completed, repetitions, undated, attention };
  });
  return { from, until, rows };
}
const api = { materialPath, normalize, focusTotals, pendingTasks, todayPlan, normalizeLearning, dueCards, scheduleCard, examMistakes, topicEvidence, weeklySummary };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.mdStudyLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
