(function () {
'use strict';

function fitPopover(menu) {
  menu.style.translate = '0px 0px';
  const rect = menu.getBoundingClientRect();
  const shift = rect.left < 12 ? 12 - rect.left : rect.right > window.innerWidth - 12 ? window.innerWidth - 12 - rect.right : 0;
  menu.style.translate = `${shift}px 0px`;
}

function initDropdown(buttonId, menuId) {
  const btn = document.getElementById(buttonId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.setAttribute('aria-controls', menuId);
  btn.setAttribute('aria-expanded', String(!menu.hidden));
  new MutationObserver(() => btn.setAttribute('aria-expanded', String(!menu.hidden)))
    .observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasHidden = menu.hidden;
    document.querySelectorAll('.dropdown-menu').forEach((m) => { m.hidden = true; });
    menu.hidden = !wasHidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) fitPopover(menu);
  });
  menu.addEventListener('click', (e) => e.stopPropagation());
}

document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach((m) => { m.hidden = true; });
});

window.addEventListener('resize', () => {
  document.querySelectorAll('.dropdown-menu:not([hidden]), .home-options[open] .home-options-body').forEach(fitPopover);
});
window.mdFitPopover = fitPopover;
window.initDropdown = initDropdown;

})();
