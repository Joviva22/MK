(function () {
'use strict';

// Gráficos en SVG propio (sin librerías), compartidos por la vista Gráfico
// de las bases de datos y las estadísticas del Home.
//
//   window.mdCharts.render(host, { type, data, valueLabel, time, format })
//     type: 'bar' | 'line' | 'pie'
//     data: [{ label, value }]  (en el orden en que se dibujan)
//     data[i].color (opcional): color propio de esa entidad (ej. prioridad
//           Alta = rojo en todo el Home); si no, la paleta en orden fijo
//     time: true si las etiquetas son una secuencia temporal (barras
//           verticales; si no, barras horizontales ordenadas por valor)
//
// Paleta: la de referencia validada (8 tonos categóricos en orden fijo, con
// variante clara/oscura). Una sola serie → un solo color (la identidad la
// dan las etiquetas del eje, no el color). Torta → tonos en orden fijo, más
// de 8 porciones se juntan en "Otros". Hover: tooltip por marca. Debajo,
// "Ver tabla" muestra los números exactos (el color nunca es lo único).

const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
};
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SLICES = 8;

function isDark() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const m = bg.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

function palette() {
  return isDark() ? CATEGORICAL.dark : CATEGORICAL.light;
}

function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
  if (parent) parent.appendChild(n);
  return n;
}

function defaultFormat(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  const digits = abs >= 100 || Number.isInteger(v) ? 0 : abs >= 10 ? 1 : 2;
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// Escala "linda" para el eje de valores: 0 .. máximo redondeado, ~4 marcas.
function niceScale(max) {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) || 10 * pow;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(t);
  return { max: top, ticks };
}

// ---- tooltip compartido ----
let tip = null;
function showTip(e, html) {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const x = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
  const y = Math.max(8, e.clientY - tip.offsetHeight - 10);
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
function hideTip() {
  if (tip) tip.hidden = true;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function bindTip(node, label, valueText) {
  const html = `<div class="chart-tooltip-label">${escapeHtml(label)}</div><div class="chart-tooltip-value">${escapeHtml(valueText)}</div>`;
  node.addEventListener('mousemove', (e) => showTip(e, html));
  node.addEventListener('mouseleave', hideTip);
}

// ---- barras ----
function renderBars(svg, width, data, opts) {
  const fmt = opts.format || defaultFormat;
  const color = palette()[0];
  const max = Math.max(0, ...data.map((d) => d.value || 0));
  const scale = niceScale(max);
  if (opts.time) {
    // Columnas verticales (secuencia temporal, orden cronológico).
    const height = 260;
    const pad = { top: 16, right: 12, bottom: 44, left: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    scale.ticks.forEach((t) => {
      const y = pad.top + plotH - (t / scale.max) * plotH;
      svgEl('line', { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: 'chart-grid' }, svg);
      const lbl = svgEl('text', { x: pad.left - 6, y: y + 4, class: 'chart-axis', 'text-anchor': 'end' }, svg);
      lbl.textContent = fmt(t);
    });
    const band = plotW / Math.max(1, data.length);
    const barW = Math.max(3, Math.min(48, band - 2)); // 2px de separación entre barras
    const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));
    data.forEach((d, i) => {
      const h = scale.max ? ((d.value || 0) / scale.max) * plotH : 0;
      const x = pad.left + i * band + (band - barW) / 2;
      const y = pad.top + plotH - h;
      // Extremo de datos redondeado (4px) y base recta sobre el eje.
      const r = Math.min(4, barW / 2, h);
      const path = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`;
      const bar = svgEl('path', { d: h > 0 ? path : `M${x},${y} h${barW}`, fill: color, class: 'chart-mark' }, svg);
      const hit = svgEl('rect', { x: pad.left + i * band, y: pad.top, width: band, height: plotH, class: 'chart-hit' }, svg);
      bindTip(hit, d.label, `${fmt(d.value)} ${opts.valueLabel || ''}`.trim());
      hit.addEventListener('mouseenter', () => bar.classList.add('chart-mark-hover'));
      hit.addEventListener('mouseleave', () => bar.classList.remove('chart-mark-hover'));
      if (i % labelEvery === 0) {
        const t = svgEl('text', { x: x + barW / 2, y: height - pad.bottom + 16, class: 'chart-axis', 'text-anchor': 'middle' }, svg);
        t.textContent = d.label;
      }
    });
    svgEl('line', { x1: pad.left, x2: width - pad.right, y1: pad.top + plotH, y2: pad.top + plotH, class: 'chart-baseline' }, svg);
    return;
  }
  // Barras horizontales (categorías), de mayor a menor, valor al final.
  const rowH = 26;
  const labelW = Math.min(180, Math.max(60, Math.max(...data.map((d) => String(d.label).length)) * 7 + 8));
  const pad = { top: 6, right: 56, bottom: 6, left: labelW };
  const plotW = width - pad.left - pad.right;
  const height = pad.top + pad.bottom + rowH * data.length;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  data.forEach((d, i) => {
    const w = scale.max ? ((d.value || 0) / Math.max(max, 1e-9)) * plotW : 0;
    const y = pad.top + i * rowH + 4;
    const h = rowH - 8;
    const r = Math.min(4, h / 2, w);
    const x = pad.left;
    const path = `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
    const bar = svgEl('path', { d: w > 0 ? path : `M${x},${y} v${h}`, fill: color, class: 'chart-mark' }, svg);
    const name = svgEl('text', { x: pad.left - 8, y: y + h / 2 + 4, class: 'chart-label', 'text-anchor': 'end' }, svg);
    name.textContent = String(d.label).length > 26 ? String(d.label).slice(0, 25) + '…' : d.label;
    const val = svgEl('text', { x: x + w + 6, y: y + h / 2 + 4, class: 'chart-value' }, svg);
    val.textContent = fmt(d.value);
    const hit = svgEl('rect', { x: 0, y: pad.top + i * rowH, width, height: rowH, class: 'chart-hit' }, svg);
    bindTip(hit, d.label, `${fmt(d.value)} ${opts.valueLabel || ''}`.trim());
    hit.addEventListener('mouseenter', () => bar.classList.add('chart-mark-hover'));
    hit.addEventListener('mouseleave', () => bar.classList.remove('chart-mark-hover'));
  });
  svgEl('line', { x1: pad.left, x2: pad.left, y1: pad.top, y2: height - pad.bottom, class: 'chart-baseline' }, svg);
}

// ---- líneas ----
function renderLine(svg, width, data, opts) {
  const fmt = opts.format || defaultFormat;
  const color = palette()[0];
  const height = 260;
  const pad = { top: 18, right: 20, bottom: 44, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const max = Math.max(0, ...data.map((d) => d.value || 0));
  const scale = niceScale(max);
  scale.ticks.forEach((t) => {
    const y = pad.top + plotH - (t / scale.max) * plotH;
    svgEl('line', { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: 'chart-grid' }, svg);
    const lbl = svgEl('text', { x: pad.left - 6, y: y + 4, class: 'chart-axis', 'text-anchor': 'end' }, svg);
    lbl.textContent = fmt(t);
  });
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;
  const pts = data.map((d, i) => [pad.left + (data.length > 1 ? i * step : plotW / 2), pad.top + plotH - ((d.value || 0) / scale.max) * plotH]);
  svgEl('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' '), class: 'chart-line', stroke: color }, svg);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));
  const guide = svgEl('line', { x1: 0, x2: 0, y1: pad.top, y2: pad.top + plotH, class: 'chart-crosshair' }, svg);
  guide.style.display = 'none';
  data.forEach((d, i) => {
    const [x, y] = pts[i];
    const dot = svgEl('circle', { cx: x, cy: y, r: 4, fill: color, class: 'chart-dot' }, svg);
    if (i % labelEvery === 0) {
      const t = svgEl('text', { x, y: height - pad.bottom + 16, class: 'chart-axis', 'text-anchor': 'middle' }, svg);
      t.textContent = d.label;
    }
    // Zona de hover = franja vertical completa (más grande que el punto).
    const hit = svgEl('rect', { x: x - Math.max(step, 16) / 2, y: pad.top, width: Math.max(step, 16), height: plotH, class: 'chart-hit' }, svg);
    bindTip(hit, d.label, `${fmt(d.value)} ${opts.valueLabel || ''}`.trim());
    hit.addEventListener('mouseenter', () => { guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.style.display = ''; dot.setAttribute('r', 6); });
    hit.addEventListener('mouseleave', () => { guide.style.display = 'none'; dot.setAttribute('r', 4); });
  });
  // Etiqueta directa solo en el último punto (no un número en cada punto).
  if (pts.length) {
    const [lx, ly] = pts[pts.length - 1];
    const last = svgEl('text', { x: Math.min(lx, width - pad.right), y: ly - 10, class: 'chart-value', 'text-anchor': 'end' }, svg);
    last.textContent = fmt(data[data.length - 1].value);
  }
  svgEl('line', { x1: pad.left, x2: width - pad.right, y1: pad.top + plotH, y2: pad.top + plotH, class: 'chart-baseline' }, svg);
}

// ---- torta (anillo) ----
function renderPie(svg, width, data, opts, host) {
  const fmt = opts.format || defaultFormat;
  const colors = palette();
  let slices = data.filter((d) => d.value > 0).slice().sort((a, b) => b.value - a.value);
  if (slices.length > MAX_SLICES) {
    const rest = slices.slice(MAX_SLICES - 1);
    slices = slices.slice(0, MAX_SLICES - 1).concat([{ label: 'Otros', value: rest.reduce((s, d) => s + d.value, 0) }]);
  }
  const total = slices.reduce((s, d) => s + d.value, 0);
  const size = 220;
  const r = 96;
  const inner = 58;
  const cx = size / 2;
  const cy = size / 2;
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('chart-pie');
  let a0 = -Math.PI / 2;
  slices.forEach((d, i) => {
    const frac = total ? d.value / total : 0;
    const a1 = a0 + frac * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    const [x0, y0] = p(a0, r);
    const [x1, y1] = p(a1, r);
    const [x2, y2] = p(a1, inner);
    const [x3, y3] = p(a0, inner);
    const path = frac >= 0.9999
      ? `M${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} M${cx - inner},${cy} A${inner},${inner} 0 1,0 ${cx + inner},${cy} A${inner},${inner} 0 1,0 ${cx - inner},${cy} Z`
      : `M${x0},${y0} A${r},${r} 0 ${large},1 ${x1},${y1} L${x2},${y2} A${inner},${inner} 0 ${large},0 ${x3},${y3} Z`;
    // Borde del color de la superficie = 2px de separación entre porciones.
    const seg = svgEl('path', { d: path, fill: d.color || colors[i % colors.length], class: 'chart-slice', 'fill-rule': 'evenodd' }, svg);
    bindTip(seg, d.label, `${fmt(d.value)} ${opts.valueLabel || ''} · ${Math.round(frac * 100)}%`.replace(/\s+·/, ' ·'));
    a0 = a1;
  });
  const center = svgEl('text', { x: cx, y: cy + 6, class: 'chart-pie-total', 'text-anchor': 'middle' }, svg);
  center.textContent = fmt(total);
  // Leyenda: identidad por texto además del color.
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  slices.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'chart-legend-item';
    const sw = document.createElement('span');
    sw.className = 'chart-swatch';
    sw.style.background = d.color || colors[i % colors.length];
    const txt = document.createElement('span');
    txt.textContent = `${d.label} — ${fmt(d.value)} (${total ? Math.round((d.value / total) * 100) : 0}%)`;
    item.append(sw, txt);
    legend.appendChild(item);
  });
  host.appendChild(legend);
}

function renderTable(host, data, opts) {
  const fmt = opts.format || defaultFormat;
  const details = document.createElement('details');
  details.className = 'chart-table';
  const summary = document.createElement('summary');
  summary.textContent = 'Ver tabla';
  details.appendChild(summary);
  const table = document.createElement('table');
  const head = document.createElement('tr');
  [opts.labelTitle || 'Grupo', opts.valueLabel || 'Valor'].forEach((t) => {
    const th = document.createElement('th');
    th.textContent = t;
    head.appendChild(th);
  });
  table.appendChild(head);
  data.forEach((d) => {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    a.textContent = d.label;
    const b = document.createElement('td');
    b.textContent = fmt(d.value);
    tr.append(a, b);
    table.appendChild(tr);
  });
  details.appendChild(table);
  host.appendChild(details);
}

function render(host, opts) {
  host.innerHTML = '';
  host.classList.add('chart-host');
  const data = (opts.data || []).filter((d) => d && d.value != null && !Number.isNaN(d.value));
  if (!data.length) {
    const empty = document.createElement('div');
    empty.className = 'command-palette-empty';
    empty.textContent = opts.emptyText || 'Sin datos para graficar.';
    host.appendChild(empty);
    return;
  }
  const plot = document.createElement('div');
  plot.className = 'chart-plot' + (opts.type === 'pie' ? ' chart-plot-pie' : '');
  host.appendChild(plot);
  const width = Math.max(320, Math.min(900, host.clientWidth || 640));
  const svg = svgEl('svg', { role: 'img', 'aria-label': opts.title || 'Gráfico' });
  plot.appendChild(svg);
  if (opts.type === 'pie') renderPie(svg, width, data, opts, plot);
  else if (opts.type === 'line') renderLine(svg, width, data, opts);
  else renderBars(svg, width, opts.time ? data : data.slice().sort((a, b) => (b.value || 0) - (a.value || 0)), opts);
  renderTable(host, data, opts);
}

// ---- bloque ```chart``` en notas ----
// Opciones "clave: valor" (español o inglés) y después una tabla Markdown:
//   tipo: barras | líneas | torta        (type: bar | line | pie)
//   título: ...                          (title)
//   valor: nombre de la columna a medir  (value) — por defecto la 2ª
//   tiempo: sí                           (time) — columnas verticales en orden
// La primera columna son las etiquetas.

const TYPE_ALIASES = {
  bar: 'bar', barras: 'bar', barra: 'bar', columnas: 'bar',
  line: 'line', lineas: 'line', líneas: 'line', linea: 'line', línea: 'line',
  pie: 'pie', torta: 'pie', tarta: 'pie', dona: 'pie', anillo: 'pie', circular: 'pie'
};

// "1.234,5" (es), "1,234.5" (en), "12 €", "45%": el último separador es el decimal.
function parseNumber(raw) {
  const t = String(raw).replace(/[^\d.,-]/g, '');
  if (!/\d/.test(t)) return null;
  const lastSep = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  const decimals = lastSep === -1 ? 0 : t.length - lastSep - 1;
  // "1.234" con 3 decimales exactos y un solo separador: es de miles.
  const isThousands = lastSep !== -1 && decimals === 3 && (t.match(/[.,]/g) || []).length === 1;
  const normalized = lastSep === -1 || isThousands
    ? t.replace(/[.,]/g, '')
    : t.slice(0, lastSep).replace(/[.,]/g, '') + '.' + t.slice(lastSep + 1);
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function parseChartBlock(text) {
  const opts = {};
  const tableLines = [];
  String(text).split('\n').forEach((line) => {
    if (/^\s*\|/.test(line)) { tableLines.push(line); return; }
    const m = line.match(/^\s*([\wáéíóúñ]+)\s*:\s*(.+?)\s*$/i);
    if (m) opts[m[1].toLowerCase()] = m[2];
  });
  const rows = tableLines.map(splitRow).filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
  if (rows.length < 2) return { error: 'El bloque chart necesita una tabla Markdown (encabezado + al menos una fila).' };
  const header = rows[0];
  const body = rows.slice(1);
  const wanted = opts.valor || opts.value || opts.columna || opts.column;
  let col = wanted ? header.findIndex((h) => h.toLowerCase() === wanted.toLowerCase()) : 1;
  if (col < 1) return { error: `No encontré la columna "${wanted}" en la tabla.` };
  const data = body.map((r) => ({ label: r[0] || '', value: parseNumber(r[col]) })).filter((d) => d.label && d.value !== null);
  if (!data.length) return { error: `La columna "${header[col]}" no tiene números.` };
  const typeRaw = (opts.tipo || opts.type || 'barras').toLowerCase();
  const time = /^(s[ií]|yes|true|1)$/i.test(opts.tiempo || opts.time || '');
  return {
    type: TYPE_ALIASES[typeRaw] || 'bar',
    title: opts['título'] || opts.titulo || opts.title || '',
    data,
    time,
    valueLabel: header[col],
    labelTitle: header[0]
  };
}

// Dibuja un bloque chart (texto crudo) dentro de host, con título o error.
function renderChartBlock(host, text) {
  host.innerHTML = '';
  host.classList.add('md-chart-block');
  const spec = parseChartBlock(text);
  if (spec.error) {
    const err = document.createElement('div');
    err.className = 'md-chart-error';
    err.textContent = '📊 ' + spec.error;
    host.appendChild(err);
    return;
  }
  if (spec.title) {
    const t = document.createElement('div');
    t.className = 'md-chart-title';
    t.textContent = spec.title;
    host.appendChild(t);
  }
  const plot = document.createElement('div');
  host.appendChild(plot);
  render(plot, spec);
}

window.mdCharts = { render, niceScale, palette, parseChartBlock, renderChartBlock };

})();
