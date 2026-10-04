(function () {
'use strict';

// Ocultar botones de la toolbar que no usás, y poder ejecutarlos igual
// desde Ajustes sin tener que volver a mostrarlos. La lista se arma sola a
// partir de los botones marcados con .toolbar-optional en el HTML (mismo
// espíritu que commandpalette.js: nunca se desincroniza de lo que hay).

const container = document.getElementById('toolbar-buttons-settings');

// El title trae "Acción (atajo)" — para la lista alcanza con la acción,
// el atajo completo se ve igual al pasar el mouse por el botón real.
function labelFor(btn) {
  // Nombre corto (toolbarstyle.js) y, si no, el title sin el atajo.
  return btn.dataset.short || (btn.title || btn.id).replace(/\s*\([^)]*\)\s*$/, '').trim();
}

async function setVisible(id, visible) {
  document.getElementById(id).hidden = !visible;
  const config = await window.mdEditor.getConfig();
  const hidden = new Set(config.hiddenToolbarButtons || []);
  if (visible) hidden.delete(id); else hidden.add(id);
  await window.mdEditor.setConfig({ hiddenToolbarButtons: Array.from(hidden) });
}

function buildRows() {
  container.innerHTML = '';
  document.querySelectorAll('.toolbar-optional').forEach((btn) => {
    const row = document.createElement('div');
    row.className = 'toolbar-buttons-settings-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `toolbar-vis-${btn.id}`;
    checkbox.checked = !btn.hidden;
    checkbox.addEventListener('change', () => setVisible(btn.id, checkbox.checked));

    const text = document.createElement('label');
    text.title = btn.title;
    text.setAttribute('for', checkbox.id);
    text.textContent = labelFor(btn);

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'toolbar-buttons-settings-run';
    runBtn.title = 'Ejecutar ahora';
    window.mdIcons.button(runBtn, 'play');
    runBtn.addEventListener('click', () => btn.click());

    row.appendChild(checkbox);
    row.appendChild(text);
    row.appendChild(runBtn);
    container.appendChild(row);
  });
}

(async () => {
  const config = await window.mdEditor.getConfig();
  const hidden = new Set(config.hiddenToolbarButtons || []);
  document.querySelectorAll('.toolbar-optional').forEach((btn) => {
    btn.hidden = hidden.has(btn.id);
  });
  buildRows();
})();

})();
