(function (root) {
'use strict';
function category(value) { return String(value || '').trim().slice(0, 80); }
function notePath(value) { return typeof value === 'string' && value.startsWith('/') && !/[\x00-\x1f]/.test(value) ? value.slice(0, 4096) : ''; }
function detail(value) { return String(value || '').trim().slice(0, 500); }
function validSeconds(value) { return Number.isFinite(value) && value > 0 && value <= 86400; }
function normalize(source) {
  const data = { version: 1, categories: [], records: [], selectedCategory: category(source?.selectedCategory) };
  if (Array.isArray(source?.categories)) data.categories = [...new Set(source.categories.filter((c) => typeof c === 'string').map(category).filter(Boolean))];
  if (Array.isArray(source?.records)) {
    const seen = new Set();
    for (const r of source.records) {
      if (!r || typeof r.id !== 'string' || seen.has(r.id) || !validSeconds(r.seconds) || !Number.isFinite(Date.parse(r.date))) continue;
      seen.add(r.id);
      data.records.push({ id: r.id, category: category(r.category), seconds: r.seconds, date: new Date(r.date).toISOString(), completed: r.completed === true, task: String(r.task || '').slice(0, 500), notePath: notePath(r.notePath), detail: detail(r.detail) });
    }
  }
  for (const name of [data.selectedCategory, ...data.records.map((r) => r.category)]) {
    if (name && !data.categories.includes(name)) data.categories.push(name);
  }
  return data;
}
function summarize(data, { from = -Infinity, to = Infinity, category: selected = null, notePath: selectedNote = null } = {}) {
  const totals = new Map();
  for (const r of data.records) {
    const time = Date.parse(r.date);
    if (time < from || time >= to || (selected !== null && r.category !== selected) || (selectedNote !== null && (r.notePath || '') !== selectedNote)) continue;
    const total = totals.get(r.category) || { category: r.category, seconds: 0, completed: 0, partial: 0 };
    total.seconds += r.seconds;
    total[r.completed ? 'completed' : 'partial']++;
    totals.set(r.category, total);
  }
  return [...totals.values()].sort((a, b) => b.seconds - a.seconds);
}
const api = { category, notePath, detail, validSeconds, normalize, summarize };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.mdPomodoroLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
