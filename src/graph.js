(function () {
'use strict';

const overlay = document.getElementById('graph-panel');
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');

let nodes = [];
let edges = [];
let nodesById = {};

// Vista interactiva: pan/zoom sobre el layout ya calculado, y arrastre de
// nodos individuales. El layout en sí (nodes[].x/y) sigue siendo el mismo
// cálculo de fuerzas de siempre — esto solo agrega una transformación
// mundo→pantalla encima, más la posibilidad de mover un nodo a mano.
let view = { scale: 1, tx: 0, ty: 0 };
let dragNode = null;
let dragMoved = false;
let dragStartClient = null;
let isPanning = false;
let panStart = null;
let currentRoot = null;

// Filtros y resaltado: buscar, etiqueta, carpeta, ocultar notas sin
// enlaces, "solo esta y sus vecinos" (clic derecho) y vecinos al pasar el
// mouse.
const filters = { q: '', tag: '', folder: '', hideOrphans: false, focus: null };
let hoverNode = null;
let neighbors = {}; // id → Set de ids vecinos
const searchEl = document.getElementById('graph-search');
const tagEl = document.getElementById('graph-tag');
const folderEl = document.getElementById('graph-folder');
const orphansEl = document.getElementById('graph-orphans');
const countEl = document.getElementById('graph-count');

function isVisible(n) {
  if (filters.focus && n.id !== filters.focus && !(neighbors[filters.focus] || new Set()).has(n.id)) return false;
  if (filters.tag && !(n.tags || []).includes(filters.tag)) return false;
  if (filters.folder && n.folder !== filters.folder) return false;
  if (filters.hideOrphans && !n.degree) return false;
  return true;
}

function visibleNodes() {
  return nodes.filter(isVisible);
}

function matchesSearch(n) {
  return filters.q && n.id.toLowerCase().includes(filters.q);
}

function radiusOf(n) {
  return 5 + Math.min(9, Math.sqrt(n.degree || 0) * 2.2);
}

// Reacomodo manual (arrastrar nodos) persistido por carpeta en config.json,
// bajo graphPositions: { [rootPath]: { [nodeId]: {x, y} } }. Nodos nuevos
// (archivos agregados después del último guardado) no tienen entrada ahí —
// se ubican con el layout de fuerzas de siempre, mezclado con los que sí
// tienen posición guardada.
async function loadPositionsFor(root) {
  const config = await window.mdEditor.getConfig();
  return (config.graphPositions || {})[root] || null;
}

async function savePositionsFor(root) {
  const config = await window.mdEditor.getConfig();
  const graphPositions = config.graphPositions || {};
  const saved = {};
  nodes.forEach((n) => { saved[n.id] = { x: n.x, y: n.y }; });
  graphPositions[root] = saved;
  await window.mdEditor.setConfig({ graphPositions });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height
  };
}

function toWorld(canvasX, canvasY) {
  return { x: (canvasX - view.tx) / view.scale, y: (canvasY - view.ty) / view.scale };
}

function themeColor(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function seedPositions() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = Math.min(canvas.width, canvas.height) / 2 - 40;
  nodes.forEach((n, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    n.x = cx + r * Math.cos(angle);
    n.y = cy + r * Math.sin(angle);
    n.vx = 0;
    n.vy = 0;
  });
}

// Fuerzas simples: los nodos se repelen entre sí, las aristas actúan como
// resortes. Se corre un número fijo de iteraciones antes de dibujar (sin
// animación) — suficiente para acomodar grafos chicos/medianos de notas.
function physicsStep() {
  const REPULSION = 2600;
  const SPRING = 0.02;
  const SPRING_LEN = 100;
  const DAMPING = 0.85;
  const GRAVITY = 0.0015; // atracción suave al centro: sin enlaces no se van a los bordes
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  nodes.forEach((n) => {
    n.fx = 0;
    n.fy = 0;
  });

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const distSq = Math.max(dx * dx + dy * dy, 1);
      const dist = Math.sqrt(distSq);
      const force = REPULSION / distSq;
      dx /= dist;
      dy /= dist;
      a.fx += dx * force;
      a.fy += dy * force;
      b.fx -= dx * force;
      b.fy -= dy * force;
    }
  }

  edges.forEach((e) => {
    const a = nodesById[e.source];
    const b = nodesById[e.target];
    if (!a || !b) return;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const force = (dist - SPRING_LEN) * SPRING;
    dx /= dist;
    dy /= dist;
    a.fx += dx * force;
    a.fy += dy * force;
    b.fx -= dx * force;
    b.fy -= dy * force;
  });

  nodes.forEach((n) => {
    n.fx += (cx - n.x) * GRAVITY;
    n.fy += (cy - n.y) * GRAVITY;
    n.vx = (n.vx + n.fx) * DAMPING;
    n.vy = (n.vy + n.fy) * DAMPING;
    n.x = Math.max(24, Math.min(canvas.width - 24, n.x + n.vx));
    n.y = Math.max(24, Math.min(canvas.height - 24, n.y + n.vy));
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = themeColor('--surface', '#f5f7fa');
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.scale, view.scale);

  ctx.strokeStyle = themeColor('--border', '#d8dee8');
  ctx.lineWidth = 1;
  edges.forEach((e) => {
    const a = nodesById[e.source];
    const b = nodesById[e.target];
    if (!a || !b || !isVisible(a) || !isVisible(b)) return;
    const lit = hoverNode && (a === hoverNode || b === hoverNode);
    ctx.globalAlpha = hoverNode && !lit ? 0.15 : 1;
    ctx.strokeStyle = lit ? themeColor('--accent', '#2563eb') : themeColor('--border', '#d8dee8');
    ctx.lineWidth = lit ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  const accent = themeColor('--accent', '#2563eb');
  const text = themeColor('--text', '#1f2937');
  const muted = themeColor('--text-muted', '#6b7280');
  const near = hoverNode ? (neighbors[hoverNode.id] || new Set()) : null;
  const dimmed = (n) => near && n !== hoverNode && !near.has(n.id);
  visibleNodes().forEach((n) => {
    const r = radiusOf(n);
    ctx.globalAlpha = dimmed(n) ? 0.2 : 1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (matchesSearch(n) || n === hoverNode) {
      ctx.strokeStyle = text;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = matchesSearch(n) || n === hoverNode ? text : (dimmed(n) ? muted : text);
    ctx.font = (n === hoverNode || matchesSearch(n) ? 'bold ' : '') + '12px sans-serif';
    ctx.fillText(n.id, n.x + r + 4, n.y + 4);
  });
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 1;
  ctx.restore();
  updateCount();
}

function updateCount() {
  if (!countEl) return;
  const v = visibleNodes().length;
  let text = v === nodes.length ? `${nodes.length} notas · ${edges.length} enlaces` : `${v} de ${nodes.length} notas`;
  if (filters.focus) text = `Vecinos de "${filters.focus}" (Esc: ver todo) · ` + text;
  countEl.textContent = text;
}

function fillSelect(el, first, values) {
  if (!el) return;
  const current = el.value;
  el.innerHTML = '';
  [['', first], ...values.map((v) => [v, v])].forEach(([value, label]) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = value && el === tagEl ? '#' + label : label;
    el.appendChild(o);
  });
  el.value = values.includes(current) ? current : '';
}

function renderEmpty(message) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = themeColor('--surface', '#f5f7fa');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = themeColor('--text-muted', '#6b7280');
  ctx.font = '14px sans-serif';
  ctx.fillText(message, 20, 30);
}

function buildAndDraw(data, savedPositions) {
  view = { scale: 1, tx: 0, ty: 0 };
  nodes = (data.nodes || []).map((n) => ({ id: n.id, path: n.path, tags: n.tags || [], folder: n.folder || '.', degree: 0 }));
  edges = data.edges || [];
  nodesById = {};
  neighbors = {};
  nodes.forEach((n) => {
    nodesById[n.id] = n;
    neighbors[n.id] = new Set();
  });
  edges.forEach((e) => {
    if (!nodesById[e.source] || !nodesById[e.target]) return;
    neighbors[e.source].add(e.target);
    neighbors[e.target].add(e.source);
  });
  nodes.forEach((n) => { n.degree = neighbors[n.id].size; });
  filters.focus = null;
  hoverNode = null;
  fillSelect(tagEl, 'Todas las etiquetas', Array.from(new Set(nodes.flatMap((n) => n.tags))).sort());
  fillSelect(folderEl, 'Todas las carpetas', Array.from(new Set(nodes.map((n) => n.folder))).sort());

  if (!nodes.length) {
    renderEmpty('Sin archivos en la carpeta abierta.');
    return;
  }

  seedPositions();
  if (savedPositions && Object.keys(savedPositions).length) {
    // Nodos con posición guardada la usan tal cual; los nuevos se quedan
    // con la posición inicial en círculo de seedPositions (no vale la pena
    // correr el layout de fuerzas de nuevo solo por ellos).
    nodes.forEach((n) => {
      const p = savedPositions[n.id];
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
    });
  } else {
    for (let i = 0; i < 250; i++) physicsStep();
  }
  draw();
}

canvas.style.cursor = 'grab';

function nodeAt(clientX, clientY) {
  const c = toCanvasCoords(clientX, clientY);
  const w = toWorld(c.x, c.y);
  return visibleNodes().find((n) => Math.hypot(n.x - w.x, n.y - w.y) < radiusOf(n) + 7) || null;
}

// Pasar el mouse: resalta la nota y sus vecinas.
canvas.addEventListener('mousemove', (e) => {
  if (dragNode || isPanning) return;
  const hit = nodeAt(e.clientX, e.clientY);
  if (hit !== hoverNode) {
    hoverNode = hit;
    canvas.style.cursor = hit ? 'pointer' : 'grab';
    draw();
  }
});
canvas.addEventListener('mouseleave', () => {
  if (hoverNode) { hoverNode = null; draw(); }
});

// Clic derecho en una nota: abrir, al lado, backlinks, solo sus vecinas.
let menuEl = null;
function closeMenu() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
}
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  closeMenu();
  const n = nodeAt(e.clientX, e.clientY);
  if (!n) return;
  menuEl = document.createElement('div');
  menuEl.className = 'context-menu graph-menu';
  menuEl.setAttribute('role', 'menu');
  const item = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = label;
    b.addEventListener('click', () => { closeMenu(); fn(); });
    menuEl.appendChild(b);
  };
  item('Abrir', () => { close(); window.openFileAtPath(n.path); });
  item('Abrir en el panel secundario', () => { close(); if (window.mdSecondaryPane) window.mdSecondaryPane.open(n.path); });
  item(`Ver backlinks de "${n.id}"`, () => { close(); if (window.mdBacklinks) window.mdBacklinks.open(n.path); });
  item(filters.focus === n.id ? 'Ver todas las notas' : 'Solo esta y sus vecinas', () => {
    filters.focus = filters.focus === n.id ? null : n.id;
    draw();
  });
  menuEl.style.left = `${e.clientX}px`;
  menuEl.style.top = `${e.clientY}px`;
  document.body.appendChild(menuEl);
  const first = menuEl.querySelector('button');
  if (first) first.focus();
});
document.addEventListener('mousedown', (e) => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); });

if (searchEl) searchEl.addEventListener('input', () => { filters.q = searchEl.value.trim().toLowerCase(); draw(); });
if (tagEl) tagEl.addEventListener('change', () => { filters.tag = tagEl.value; draw(); });
if (folderEl) folderEl.addEventListener('change', () => { filters.folder = folderEl.value; draw(); });
if (orphansEl) orphansEl.addEventListener('change', () => { filters.hideOrphans = orphansEl.checked; draw(); });
if (searchEl) {
  searchEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const hit = visibleNodes().find(matchesSearch);
    if (hit) { close(); window.openFileAtPath(hit.path); }
  });
}

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // el derecho abre el menú
  dragStartClient = { x: e.clientX, y: e.clientY };
  dragMoved = false;
  const hit = nodeAt(e.clientX, e.clientY);
  if (hit) {
    dragNode = hit;
    dragNode.vx = 0;
    dragNode.vy = 0;
  } else {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    canvas.style.cursor = 'grabbing';
  }
});

window.addEventListener('mousemove', (e) => {
  if (!dragNode && !isPanning) return;
  if (dragStartClient && Math.hypot(e.clientX - dragStartClient.x, e.clientY - dragStartClient.y) > 3) dragMoved = true;
  if (dragNode) {
    const c = toCanvasCoords(e.clientX, e.clientY);
    const w = toWorld(c.x, c.y);
    dragNode.x = w.x;
    dragNode.y = w.y;
    draw();
  } else if (isPanning) {
    view.tx = panStart.tx + (e.clientX - panStart.x);
    view.ty = panStart.ty + (e.clientY - panStart.y);
    draw();
  }
});

window.addEventListener('mouseup', () => {
  if (dragNode && !dragMoved) {
    close();
    window.openFileAtPath(dragNode.path);
  } else if (dragNode && dragMoved && currentRoot) {
    savePositionsFor(currentRoot);
  }
  dragNode = null;
  isPanning = false;
  panStart = null;
  dragStartClient = null;
  canvas.style.cursor = 'grab';
});

// Zoom centrado en el cursor: el punto del mundo bajo el mouse se queda fijo
// en pantalla mientras cambia la escala, para no "perder" el lugar al hacer zoom.
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const c = toCanvasCoords(e.clientX, e.clientY);
  const before = toWorld(c.x, c.y);
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  view.scale = clamp(view.scale * factor, 0.25, 4);
  view.tx = c.x - before.x * view.scale;
  view.ty = c.y - before.y * view.scale;
  draw();
}, { passive: false });

// El lienzo toma el ancho del panel (y el alto que quepa en la ventana).
function sizeCanvas() {
  const box = canvas.parentElement;
  const w = Math.max(400, Math.floor(box.clientWidth));
  const h = Math.max(300, Math.floor(Math.min(window.innerHeight * 0.62, w * 0.62)));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

async function open() {
  overlay.hidden = false;
  sizeCanvas();
  const root = window.mdState.rootFolder;
  currentRoot = root;
  if (!root) {
    renderEmpty('Abrí una carpeta primero para ver el grafo.');
    return;
  }
  renderEmpty('Cargando...');
  const [data, savedPositions] = await Promise.all([
    window.mdEditor.buildGraph(root),
    loadPositionsFor(root)
  ]);
  buildAndDraw(data, savedPositions);
}

function close() {
  overlay.hidden = true;
  closeMenu();
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || overlay.hidden) return;
  if (menuEl) return closeMenu();
  if (filters.focus) { filters.focus = null; draw(); return; } // primero sale de "solo vecinas"
  close();
});

window.mdGraph = {
  open,
  close,
  getData: () => ({ nodes, edges }),
  getVisible: () => visibleNodes().map((n) => n.id),
  setFilters: (f) => { Object.assign(filters, f); draw(); },
  neighborsOf: (id) => Array.from(neighbors[id] || []),
  // Solo para test/renderer-checks.js: mueve un nodo y persiste, sin
  // simular el arrastre real del mouse (coordenadas de pantalla frágiles
  // para un test automatizado).
  moveNodeForTest: async (nodeId, x, y) => {
    const n = nodesById[nodeId];
    if (!n) return;
    n.x = x;
    n.y = y;
    draw();
    if (currentRoot) await savePositionsFor(currentRoot);
  }
};

})();
