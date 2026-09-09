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
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  const accent = themeColor('--accent', '#2563eb');
  const text = themeColor('--text', '#1f2937');
  nodes.forEach((n) => {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = text;
    ctx.font = '12px sans-serif';
    ctx.fillText(n.id, n.x + 10, n.y + 4);
  });

  ctx.restore();
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
  nodes = (data.nodes || []).map((n) => ({ id: n.id, path: n.path }));
  edges = data.edges || [];
  nodesById = {};
  nodes.forEach((n) => {
    nodesById[n.id] = n;
  });

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

canvas.addEventListener('mousedown', (e) => {
  dragStartClient = { x: e.clientX, y: e.clientY };
  dragMoved = false;
  const c = toCanvasCoords(e.clientX, e.clientY);
  const w = toWorld(c.x, c.y);
  const hit = nodes.find((n) => Math.hypot(n.x - w.x, n.y - w.y) < 14);
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

async function open() {
  overlay.hidden = false;
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
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) close();
});

window.mdGraph = {
  open,
  close,
  getData: () => ({ nodes, edges }),
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
