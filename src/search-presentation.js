(function () {
'use strict';

// Build matches with text nodes: filenames and snippets never become HTML.
function highlight(host, value, query) {
  const text = String(value || '');
  const needle = String(query || '').trim();
  host.textContent = '';
  if (!needle) { host.textContent = text; return; }
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    host.appendChild(document.createTextNode(text.slice(offset, match.index)));
    const mark = document.createElement('mark');
    mark.textContent = match[0];
    host.appendChild(mark);
    offset = match.index + match[0].length;
  }
  host.appendChild(document.createTextNode(text.slice(offset)));
}

window.mdSearchPresentation = { highlight };
})();
