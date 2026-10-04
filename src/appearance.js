(function () {
'use strict';

// Move the existing controls: their listeners, shortcuts and visibility settings
// continue to refer to the same buttons.
const toolbar = document.querySelector('.toolbar');
document.getElementById('sidebar-empty-open').addEventListener('click', () => document.getElementById('btn-open-folder').click());
const dropdown = document.createElement('div');
dropdown.className = 'dropdown';
const trigger = document.createElement('button');
trigger.id = 'btn-tools';
trigger.className = 'toolbar-button';
trigger.title = 'Herramientas';
trigger.setAttribute('aria-label', 'Herramientas');
trigger.innerHTML = '<i data-lucide="ellipsis"></i><span class="tb-label">Herramientas</span><span class="tb-caret">▾</span>';
const menu = document.createElement('div');
menu.id = 'tools-menu';
menu.className = 'dropdown-menu dropdown-menu-scroll tools-menu';
menu.hidden = true;
dropdown.append(trigger, menu);
toolbar.insertBefore(dropdown, document.getElementById('btn-export').parentElement);

const groups = [
  ['Documento', ['btn-save-as', 'btn-diff', 'btn-toc', 'btn-tags', 'btn-backlinks']],
  ['Utilidades', ['btn-refresh-tree', 'btn-run-file', 'btn-plugins', 'btn-pdfpages', 'btn-pdfhighlight']],
  ['Estudio y multimedia', ['btn-pomodoro', 'btn-pomodoro-history', 'btn-media-prev', 'btn-media-playpause', 'btn-media-next']]
];
for (const [label, ids] of groups) {
  const heading = document.createElement('div');
  heading.className = 'tools-menu-heading';
  heading.textContent = label;
  menu.appendChild(heading);
  for (const id of ids) {
    const button = document.getElementById(id);
    const text = button.querySelector('.tb-label');
    if (text) text.classList.remove('tb-added');
    button.addEventListener('click', () => { menu.hidden = true; });
    menu.appendChild(button);
  }
}
window.initDropdown(trigger.id, menu.id);
if (window.lucide) window.lucide.createIcons({ root: trigger });

const widthSelect = document.getElementById('reading-width-select');
const widths = { compact: '720px', comfortable: '900px', wide: '1120px', full: 'none' };
function applyWidth(value) {
  const selected = Object.hasOwn(widths, value) ? value : 'comfortable';
  widthSelect.value = selected;
  document.documentElement.style.setProperty('--reading-width', widths[selected]);
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
}
widthSelect.addEventListener('change', async () => {
  applyWidth(widthSelect.value);
  await window.mdEditor.setConfig({ readingWidth: widthSelect.value });
});
(async () => {
  const config = await window.mdEditor.getConfig();
  applyWidth(config.readingWidth);
})();
})();
