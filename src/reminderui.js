(function () {
'use strict';

// Editor de "avisos anticipados", compartido por el editor de tareas del
// Home (home.js) y la configuración de columnas Fecha de las bases de datos
// (database.js). Cada aviso es { days, time }: "N días antes, a las HH:MM"
// (days = 0 → el mismo día). Quien lo usa guarda la lista que devuelve el
// getter; el motor de avisos está en home.js (checkReminders).

const DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14, 30];

function dayLabel(days) {
  if (days === 0) return 'El mismo día';
  if (days === 1) return '1 día antes';
  if (days === 7) return '1 semana antes';
  if (days === 14) return '2 semanas antes';
  if (days === 30) return '1 mes antes';
  return `${days} días antes`;
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

// Arma la lista editable dentro de host y devuelve () => [{ days, time }].
function build(host, initial) {
  const list = el('div', 'reminder-list');
  host.appendChild(list);
  const rows = [];

  function addRow(r) {
    const row = el('div', 'reminder-row');
    const daysSel = el('select', 'reminder-field');
    DAY_OPTIONS.forEach((d) => {
      const opt = el('option', null, dayLabel(d));
      opt.value = String(d);
      daysSel.appendChild(opt);
    });
    daysSel.value = String(r && r.days != null ? r.days : 1);
    const atLabel = el('span', 'reminder-at', 'a las');
    const time = el('input', 'reminder-field');
    time.type = 'time';
    time.value = (r && r.time) || '09:00';
    const del = el('button', 'reminder-del', '×');
    del.type = 'button';
    del.title = 'Quitar este aviso';
    const entry = { row, daysSel, time };
    del.addEventListener('click', () => {
      row.remove();
      rows.splice(rows.indexOf(entry), 1);
    });
    row.append(daysSel, atLabel, time, del);
    list.appendChild(row);
    rows.push(entry);
  }

  (initial || []).forEach(addRow);

  const add = el('button', 'reminder-add', '+ Agregar aviso');
  add.type = 'button';
  add.addEventListener('click', () => addRow(null));
  host.appendChild(add);
  const week = el('button', 'reminder-add', '+ 1 semana antes');
  week.type = 'button';
  week.title = 'Agrega un aviso 7 días antes, a las 09:00';
  week.addEventListener('click', () => {
    if (!rows.some((r) => r.daysSel.value === '7')) addRow({ days: 7, time: '09:00' });
  });
  host.appendChild(week);

  return () => rows
    .filter((r) => r.time.value)
    .map((r) => ({ days: Number(r.daysSel.value), time: r.time.value }))
    .sort((a, b) => b.days - a.days || a.time.localeCompare(b.time));
}

window.mdReminderUI = { build, dayLabel };

})();
