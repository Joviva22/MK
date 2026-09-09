(function () {
'use strict';

function initDropdown(buttonId, menuId) {
  const btn = document.getElementById(buttonId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasHidden = menu.hidden;
    document.querySelectorAll('.dropdown-menu').forEach((m) => { m.hidden = true; });
    menu.hidden = !wasHidden;
  });
  menu.addEventListener('click', (e) => e.stopPropagation());
}

document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach((m) => { m.hidden = true; });
});

window.initDropdown = initDropdown;

})();
