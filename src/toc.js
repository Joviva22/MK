(function () {
'use strict';

const tocPanel = document.getElementById('toc-panel');
const previewPaneEl = document.getElementById('preview-pane');

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'seccion';
}

function buildTocItems() {
  const headings = previewPaneEl.querySelectorAll('h1, h2, h3');
  const used = new Set();
  const items = [];
  headings.forEach((h) => {
    const base = slugify(h.textContent);
    let id = base;
    let i = 2;
    while (used.has(id)) id = `${base}-${i++}`;
    used.add(id);
    h.id = id;
    items.push({ id, text: h.textContent, level: Number(h.tagName[1]) });
  });
  return items;
}

function renderToc() {
  const items = buildTocItems();
  tocPanel.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'toc-title';
  title.textContent = 'CONTENIDO';
  tocPanel.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'toc-empty';
    empty.textContent = 'Sin encabezados';
    tocPanel.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const a = document.createElement('a');
    a.href = '#';
    a.className = `toc-item toc-level-${item.level}`;
    a.textContent = item.text;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(item.id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    tocPanel.appendChild(a);
  });
}

function toggleToc() {
  tocPanel.hidden = !tocPanel.hidden;
  if (!tocPanel.hidden) renderToc();
}

document.getElementById('btn-toc').addEventListener('click', toggleToc);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    toggleToc();
  }
});

window.onPreviewRendered = function () {
  if (!tocPanel.hidden) renderToc();
};

})();
