(function () {
'use strict';

// Widgets en notas: bloques ```widget``` con datos vivos de MK.
//
//   ```widget            ```widget          ```widget          ```widget
//   tareas: semana       progreso           base: Gastos       mascotas
//   ```                  ```                vista: Sin pagar   ```
//                                           suma: Monto
//                                           ```
//
// tareas: hoy | semana | atrasadas (se pueden tildar desde la nota).
// base: suma / promedio de una columna, o cuenta de filas, de una vista.

function parseSpec(text) {
  const spec = {};
  text.split('\n').forEach((line) => {
    const t = line.trim();
    if (!t) return;
    const m = t.match(/^([\p{L}_]+)\s*:\s*(.*)$/u);
    if (m) spec[m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] = m[2].trim();
    else if (!spec.tipo) spec.tipo = t.toLowerCase();
  });
  if (!spec.tipo) {
    if ('tareas' in spec) spec.tipo = 'tareas';
    else if ('base' in spec) spec.tipo = 'base';
  }
  return spec;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function frame(host, title) {
  host.innerHTML = '';
  host.classList.add('md-widget');
  host.appendChild(el('div', 'md-widget-title', title));
  const body = el('div', 'md-widget-body');
  host.appendChild(body);
  // Clics adentro no mueven el cursor del editor (Live Preview).
  host.addEventListener('mousedown', (e) => e.stopPropagation());
  return body;
}

function error(host, msg) {
  host.innerHTML = '';
  host.classList.add('md-widget');
  host.appendChild(el('div', 'md-widget-error', '▦ ' + msg));
}

const TASK_TITLES = { hoy: 'Tareas de hoy', semana: 'Tareas de la semana', atrasadas: 'Tareas atrasadas' };

async function renderTasks(host, spec, text) {
  const kind = ['hoy', 'semana', 'atrasadas'].includes((spec.tareas || '').toLowerCase()) ? spec.tareas.toLowerCase() : 'semana';
  if (!window.mdHome || !window.mdHome.widgetItems) return error(host, 'El Home no está disponible.');
  const items = await window.mdHome.widgetItems(kind);
  const done = items.filter((i) => i.done).length;
  const body = frame(host, `✅ ${TASK_TITLES[kind]} · ${done}/${items.length}`);
  if (!items.length) {
    body.appendChild(el('div', 'md-widget-empty', kind === 'atrasadas' ? '¡Nada atrasado! 🎉' : 'Nada planificado.'));
    return;
  }
  const list = el('ul', 'md-widget-tasks');
  items.forEach((it) => {
    const li = el('li', it.done ? 'done' : '');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = it.done;
    box.setAttribute('aria-label', it.title);
    box.addEventListener('change', () => {
      window.mdHome.widgetSetDone(it.id, it.date, box.checked);
      setTimeout(() => renderWidget(host, text), 50);
    });
    const label = el('span', 'md-widget-task-title', it.title);
    li.append(box);
    if (it.time) li.appendChild(el('span', 'md-widget-time', it.time));
    li.appendChild(label);
    if (kind !== 'hoy' && it.date) li.appendChild(el('span', 'md-widget-date', new Date(it.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })));
    if (it.category) {
      const chip = el('span', 'home-task-cat', it.category);
      chip.style.setProperty('--cat', it.color);
      li.appendChild(chip);
    }
    list.appendChild(li);
  });
  body.appendChild(list);
}

async function renderProgress(host) {
  if (!window.mdHome || !window.mdHome.computeStats) return error(host, 'El Home no está disponible.');
  await window.mdHome.widgetItems('hoy'); // asegura que el Home cargó
  const s = window.mdHome.computeStats();
  const body = frame(host, '📈 Tu progreso');
  const pct = s.week.total ? Math.round((s.week.done / s.week.total) * 100) : 0;
  const tiles = el('div', 'md-widget-tiles');
  [['Esta semana', `${s.week.done}/${s.week.total}`, `${pct}% hechas`], ['Racha', `${s.streak}`, s.streak === 1 ? 'día' : 'días'], ['Atrasadas', `${s.overdue}`, s.overdue ? 'para reprogramar' : '¡al día!']].forEach(([l, v, sub]) => {
    const t = el('div', 'md-widget-tile');
    t.append(el('div', 'md-widget-tile-label', l), el('div', 'md-widget-tile-value', v), el('div', 'md-widget-tile-sub', sub));
    tiles.appendChild(t);
  });
  body.appendChild(tiles);
  const bar = el('div', 'pet-card-bar');
  const fill = el('div');
  fill.style.width = pct + '%';
  bar.appendChild(fill);
  body.appendChild(bar);
}

async function renderBase(host, spec) {
  if (!window.mdDatabase || !window.mdDatabase.widgetTotal) return error(host, 'Las bases de datos no están disponibles.');
  const res = await window.mdDatabase.widgetTotal(spec);
  if (res.error) return error(host, res.error);
  const body = frame(host, `▤ ${res.db}`);
  const fmt = Number.isInteger(res.value) ? res.value.toLocaleString() : res.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  body.appendChild(el('div', 'md-widget-number', fmt));
  body.appendChild(el('div', 'md-widget-tile-sub', res.label));
  const open = el('button', 'db-embed-open', 'Abrir');
  open.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); window.mdDatabase.open(res.dbId); });
  host.querySelector('.md-widget-title').appendChild(open);
}

function renderPets(host) {
  if (!window.mdPet || !window.mdPet.teamSummary) return error(host, 'Las mascotas no están disponibles.');
  const team = window.mdPet.teamSummary();
  const body = frame(host, '🐾 Tu equipo');
  if (!team.length) {
    body.appendChild(el('div', 'md-widget-empty', 'Todavía no hay mascotas en el equipo.'));
    return;
  }
  const row = el('div', 'md-widget-pets');
  team.forEach((p) => {
    const c = el('div', 'md-widget-pet' + (p.legendary ? ' legendary' : ''));
    const a = el('div', 'md-widget-pet-art');
    a.innerHTML = p.art;
    c.append(a, el('div', 'md-widget-pet-name', p.name), el('div', 'md-widget-tile-sub', `Nivel ${p.level}${p.legendary ? ' · 🌟' : ` · etapa ${p.stage}/3`}`));
    row.appendChild(c);
  });
  body.appendChild(row);
  const more = el('button', 'db-embed-open', 'Mis mascotas');
  more.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); window.mdPet.openCollection(); });
  host.querySelector('.md-widget-title').appendChild(more);
}

async function renderWidget(host, text) {
  const spec = parseSpec(text || '');
  try {
    if (spec.tipo === 'tareas') return await renderTasks(host, spec, text);
    if (spec.tipo === 'progreso') return await renderProgress(host);
    if (spec.tipo === 'base') return await renderBase(host, spec);
    if (spec.tipo === 'mascotas') return renderPets(host);
    return error(host, 'Widget desconocido. Usá: tareas: hoy | semana | atrasadas · progreso · base: Nombre (+ suma/promedio: Columna) · mascotas.');
  } catch (e) {
    window.mdEditor.logError('widget', (e && e.stack) || String(e));
    return error(host, 'No se pudo dibujar el widget.');
  }
}

window.mdWidgets = { renderWidget, parseSpec };

})();
