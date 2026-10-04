(function () {
'use strict';

const attrs = { width: 16, height: 16, 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' };

function button(host, name, label = '') {
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', name);
  host.replaceChildren(icon);
  if (label) host.appendChild(document.createTextNode(label));
  if (!host.hasAttribute('aria-label')) host.setAttribute('aria-label', host.title || label);
  host.classList.toggle('ui-icon-only', !label);
  lucide.createIcons({ attrs, root: host });
}

window.mdIcons = { button };
lucide.createIcons({ attrs });

})();
