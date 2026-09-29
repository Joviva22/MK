(function () {
'use strict';

// {{fecha}}/{{titulo}} se completan solos al crear el documento (ver
// MANUAL.md, "Plantillas con variables"). {{titulo}} solo pide el título
// si la plantilla elegida lo usa.
const TEMPLATES = {
  vacio: '',
  apuntes: '# {{titulo}}\n\n_{{fecha}}_\n\n## Introducción\n\n## Conceptos importantes\n\n## Ejemplos\n\n## Ejercicios\n\n## Resumen\n',
  documentacion: '# {{titulo}}\n\n## Descripción\n\n## Instalación\n\n## Uso\n\n## API\n\n## Licencia\n',
  trabajo: '# {{titulo}}\n\n**Autor:**  \n**Fecha:** {{fecha}}  \n**Asignatura:**  \n\n## Introducción\n\n## Desarrollo\n\n## Conclusión\n\n## Bibliografía\n',
  readme: '# {{titulo}}\n\nDescripción breve del proyecto.\n\n## Instalación\n\n```bash\n\n```\n\n## Uso\n\n## Licencia\n',
  formulas: '# Fórmulas — {{fecha}}\n\nInline: $E = mc^2$\n\nBloque:\n\n$$\n\\sum_{i=1}^{n} x_i^2\n$$\n'
};

async function fillTemplate(text) {
  let filled = text;
  if (filled.includes('{{titulo}}')) {
    const titulo = await window.mdAsk('Título del documento:', '');
    if (titulo === null) return null; // canceló: no se crea nada
    filled = filled.split('{{titulo}}').join(titulo.trim() || 'Sin título');
  }
  const fecha = new Date().toLocaleDateString();
  filled = filled.split('{{fecha}}').join(fecha);
  return filled;
}

window.initDropdown('btn-new', 'new-menu');

document.querySelectorAll('#new-menu button[data-template]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    document.getElementById('new-menu').hidden = true;
    const text = await fillTemplate(TEMPLATES[btn.dataset.template]);
    if (text !== null) window.mdTabs.newTab(text);
  });
});

})();
