(function () {
'use strict';

const overlay = document.getElementById('graph-panel');
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');

let nodes = [];
let edges = [];
let nodesById = {};

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
}

function renderEmpty(message) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = themeColor('--surface', '#f5f7fa');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = themeColor('--text-muted', '#6b7280');
  ctx.font = '14px sans-serif';
  ctx.fillText(message, 20, 30);
}

function buildAndDraw(data) {
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
  for (let i = 0; i < 250; i++) physicsStep();
  draw();
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const hit = nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 14);
  if (hit) {
    close();
    window.openFileAtPath(hit.path);
  }
});

async function open() {
  overlay.hidden = false;
  const root = window.mdState.rootFolder;
  if (!root) {
    renderEmpty('Abrí una carpeta primero para ver el grafo.');
    return;
  }
  renderEmpty('Cargando...');
  const data = await window.mdEditor.buildGraph(root);
  buildAndDraw(data);
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

window.mdGraph = { open, close, getData: () => ({ nodes, edges }) };

})();
