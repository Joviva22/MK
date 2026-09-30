// Lógica pura del Home (sin DOM ni datos globales): fechas, recurrencias,
// tareas "📅" escritas en notas y "@categoría" al agregar. Se usa desde la
// ventana (window.mdHomeLogic, ver home.js) y desde las pruebas unitarias
// de Node (test/unit/homelogic.test.js).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mdHomeLogic = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function iso(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseIso(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
  }

  // Lunes = 0 … domingo = 6.
  function weekdayIdx(d) {
    return (d.getDay() + 6) % 7;
  }

  // ¿Una tarea recurrente cae en ese día?
  function occursOn(task, dateIso) {
    const rep = task.repeat;
    if (!rep || !rep.freq || !task.date) return false;
    if (dateIso < task.date) return false;
    if (rep.until && dateIso > rep.until) return false;
    if ((task.skipDates || []).includes(dateIso)) return false;
    const d = parseIso(dateIso);
    const start = parseIso(task.date);
    switch (rep.freq) {
      case 'daily': return true;
      case 'weekdays': return weekdayIdx(d) < 5;
      case 'weekly': {
        const days = Array.isArray(rep.days) && rep.days.length ? rep.days : [weekdayIdx(start)];
        return days.includes(weekdayIdx(d));
      }
      case 'monthly': return d.getDate() === start.getDate();
      case 'yearly': return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
      default: return false;
    }
  }

  const NOTE_TASK_RE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*?)\s*📅\s*(\d{4}-\d{2}-\d{2})(.*)$/u;

  // Lo que está dentro de código no es una tarea: un ejemplo como
  // `- [ ] algo 📅 2026-10-03` en la documentación aparecía en el calendario,
  // y al moverlo el Home reescribía el archivo (le pasó a OBJETIVOS.md).
  function dateOutsideCode(line) {
    const masked = line.replace(/`[^`]*`/g, (code) => ' '.repeat(code.length));
    return /📅\s*\d{4}-\d{2}-\d{2}/u.test(masked);
  }

  function parseNoteTasks(filePath, content) {
    const items = [];
    let inFence = null;
    content.split('\n').forEach((line, idx) => {
      const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (fence) {
        if (!inFence) inFence = fence[1][0];
        else if (fence[1][0] === inFence) inFence = null;
        return;
      }
      if (inFence) return;
      const m = line.match(NOTE_TASK_RE);
      if (!m || !dateOutsideCode(line)) return;
      const title = (m[4] + ' ' + m[6]).replace(/\s+/g, ' ').trim();
      items.push({ date: m[5], title: title || '(sin texto)', done: m[2].toLowerCase() === 'x', filePath, line: idx, raw: line });
    });
    return items;
  }

  function normalize(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // "@uni repasar parcial" → { category: 'universidad', title: 'repasar parcial' }.
  function parseCategoryToken(text, categories) {
    const m = text.match(/(^|\s)@([\p{L}\p{N}_-]+)/u);
    if (!m) return { title: text, category: null };
    const q = normalize(m[2]);
    const cat = (categories || []).find((c) => normalize(c.id).startsWith(q) || normalize(c.name).startsWith(q));
    if (!cat) return { title: text, category: null };
    return { title: text.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), category: cat.id };
  }

  return { pad, iso, parseIso, addDays, weekdayIdx, occursOn, NOTE_TASK_RE, dateOutsideCode, parseNoteTasks, normalize, parseCategoryToken };
});
