(function () {
'use strict';

const container = document.querySelector('.container');
const sidebarPaneEl = document.getElementById('sidebar-pane');
const editorColumnEl = document.querySelector('.editor-column');

function makeResizer(handle, varName, sizeEl, minPx, maxPx) {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPx = sizeEl.getBoundingClientRect().width;
    handle.classList.add('active');
    document.body.classList.add('resizing');

    function onMove(ev) {
      const next = Math.max(minPx, Math.min(maxPx, startPx + (ev.clientX - startX)));
      container.style.setProperty(varName, `${next}px`);
      if (window.mdCodeMirror) window.mdCodeMirror.refresh();
    }

    function onUp() {
      handle.classList.remove('active');
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

makeResizer(document.getElementById('resizer-sidebar'), '--sidebar-w', sidebarPaneEl, 220, 400);
makeResizer(document.getElementById('resizer-editor'), '--editor-w', editorColumnEl, 300, 1400);

})();
