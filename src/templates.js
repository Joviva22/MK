(function () {
'use strict';

const TEMPLATES = {
  vacio: '',
  apuntes: '# Título\n\n## Introducción\n\n## Conceptos importantes\n\n## Ejemplos\n\n## Ejercicios\n\n## Resumen\n',
  documentacion: '# Nombre del proyecto\n\n## Descripción\n\n## Instalación\n\n## Uso\n\n## API\n\n## Licencia\n',
  trabajo: '# Título del trabajo\n\n**Autor:**  \n**Fecha:**  \n**Asignatura:**  \n\n## Introducción\n\n## Desarrollo\n\n## Conclusión\n\n## Bibliografía\n',
  readme: '# Nombre del proyecto\n\nDescripción breve del proyecto.\n\n## Instalación\n\n```bash\n\n```\n\n## Uso\n\n## Licencia\n',
  formulas: '# Fórmulas\n\nInline: $E = mc^2$\n\nBloque:\n\n$$\n\\sum_{i=1}^{n} x_i^2\n$$\n'
};

window.initDropdown('btn-new', 'new-menu');

document.querySelectorAll('#new-menu button[data-template]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('new-menu').hidden = true;
    window.mdTabs.newTab(TEMPLATES[btn.dataset.template]);
  });
});

})();
