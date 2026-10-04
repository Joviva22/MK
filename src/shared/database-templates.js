(function (global) {
'use strict';
const choices = labels => labels.map(([id, label], i) => ({ id, label, color: ['#b38b38', '#5683b8', '#549374'][i] }));
const status = { key: 'status', name: 'Estado', type: 'select', options: { choices: choices([['pending', 'Pendiente'], ['progress', 'En curso'], ['done', 'Terminado']]) } };
const views = [
  { name: 'Todo', type: 'table' },
  { name: 'Por estado', type: 'board', groupBy: 'status' },
  { name: 'Pendientes', type: 'table', filters: [{ column: 'status', op: 'is_not', value: 'done' }] }
];
const templates = [
  { id: 'blank', name: 'Base vacía', icon: 'table-2', description: 'Empieza con una columna Nombre y añade las que necesites.', columns: [{ key: 'name', name: 'Nombre', type: 'text' }], views: [{ name: 'Tabla', type: 'table' }], examples: [] },
  { id: 'reading', name: 'Lecturas', icon: 'book-open', description: 'Organiza libros, apuntes y artículos que quieras leer.', columns: [{ key: 'title', name: 'Título', type: 'text' }, { key: 'author', name: 'Autor', type: 'text' }, { ...status, options: { choices: choices([['pending', 'Por leer'], ['progress', 'Leyendo'], ['done', 'Terminado']]) } }, { key: 'date', name: 'Fecha', type: 'date' }], views, examples: [{ title: 'Ejemplo: apuntes de clase', author: 'Tú', status: 'pending' }, { title: 'Ejemplo: artículo interesante', author: 'Autor del artículo', status: 'done' }] },
  { id: 'projects', name: 'Proyectos', icon: 'folder-kanban', description: 'Sigue el avance de tus proyectos y sus fechas de entrega.', columns: [{ key: 'name', name: 'Proyecto', type: 'text' }, status, { key: 'date', name: 'Fecha de entrega', type: 'date' }, { key: 'notes', name: 'Notas', type: 'text' }], views: [...views, { name: 'Entregas', type: 'calendar', dateColumn: 'date' }], examples: [{ name: 'Ejemplo: preparar una presentación', status: 'progress', notes: 'Añade aquí los próximos pasos.' }, { name: 'Ejemplo: organizar materiales', status: 'pending' }] },
  { id: 'study', name: 'Estudio', icon: 'graduation-cap', description: 'Planifica temas de repaso y registra cuánto has estudiado.', columns: [{ key: 'topic', name: 'Tema', type: 'text' }, { key: 'subject', name: 'Asignatura', type: 'text' }, status, { key: 'minutes', name: 'Minutos', type: 'number' }, { key: 'date', name: 'Fecha de repaso', type: 'date' }], views: [...views, { name: 'Repasos', type: 'calendar', dateColumn: 'date' }], examples: [{ topic: 'Ejemplo: repasar el tema 1', subject: 'Tu asignatura', status: 'progress', minutes: 25 }, { topic: 'Ejemplo: resolver ejercicios', subject: 'Tu asignatura', status: 'pending', minutes: 0 }] }
];
if (typeof module !== 'undefined' && module.exports) module.exports = templates;
else global.mdDatabaseTemplates = templates;
})(typeof window !== 'undefined' ? window : globalThis);
