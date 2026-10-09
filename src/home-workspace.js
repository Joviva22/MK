'use strict';

const host = document.getElementById('home-panel');
const editor = document.querySelector('.container');
const homeButton = document.getElementById('btn-home');
const preview = document.getElementById('preview-scroll');
let snapshot = null;
// Home occupies the same flex slot as the editor; dialogs remain above both.
document.getElementById('terminal-workspace').insertBefore(host, document.getElementById('terminal-panel'));

function sync() {
  const active = !host.hidden;
  document.body.classList.toggle('home-active', active);
  editor.inert = active;
  homeButton.setAttribute('aria-pressed', String(active));
}
new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ['hidden'] });
sync();

export function showWorkspace() {
  if (host.hidden) {
    const cm = window.mdCodeMirror;
    snapshot = { doc: cm?.getDoc(), scroll: cm?.getScrollInfo(), preview: preview.scrollTop, focus: document.activeElement };
  }
  host.hidden = false;
  sync();
}

export function hideWorkspace() {
  host.hidden = true;
  sync();
  const saved = snapshot;
  snapshot = null;
  const cm = window.mdCodeMirror;
  cm?.refresh();
  if (saved && cm?.getDoc() === saved.doc) {
    cm.scrollTo(saved.scroll?.left || 0, saved.scroll?.top || 0);
    preview.scrollTop = saved.preview;
  }
  if (saved?.focus?.isConnected && !host.contains(saved.focus)) saved.focus.focus();
  else cm?.focus();
}
