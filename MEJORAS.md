# Cosas que mejoraría en MK

Opinión propia, no pedida por ninguna feature en curso. Ordenado por impacto real, no por lo divertido que sea implementarlo. Lo ya hecho se saca de acá (queda trackeado en `ESTADO.md`) para que esto no crezca infinito.

## Ideas de plugins pendientes

De la lista de plugins interesantes (ver panel 🧩 y `MANUAL.md`), las que se implementaron como funciones propias de MK (corrector ortográfico, snippets de texto, plantillas con variables, nota diaria, diagramas Mermaid) ya no están acá. Quedan pendientes:

1. **Vista de grafo.** Mapa visual de qué nota enlaza con cuál, a partir de los wikilinks — la más pedida en este tipo de apps (Obsidian), pero la más grande de implementar bien (layout de grafo, zoom/pan, actualización en vivo).
2. **Tablero Kanban.** Armado automáticamente a partir de listas de tareas (`- [ ]`) agrupadas por columna — necesitaría definir una convención (¿una carpeta por tablero? ¿un encabezado por columna?).
3. **Exportar a EPUB.** Para apuntes largos o libros armados en Markdown — nueva librería/formato, no reutiliza el pipeline de exportar a HTML/PDF que ya existe.
4. **Sincronización con git al guardar.** Commit automático de la carpeta sin salir de MK — hay que pensar bien cuándo (¿cada guardado sería demasiado ruido de commits?) y qué pasa si la carpeta no es un repo git todavía.
5. **Exportar a tarjetas de memoria (tipo Anki).** A partir de encabezados o callouts — formato de exportación nuevo (`.apkg` o CSV para importar).
6. **Ejecutar bloques de código tipo notebook.** Correr un bloque ```python``` o ```js``` y ver el resultado ahí mismo — la más riesgosa de las seis: ejecutar código arbitrario desde una nota necesita pensarse bien en términos de seguridad antes de tocarla.

## Ideas descartadas (por ahora)

- **Sistema de plugins de verdad (JS de terceros).** Se pidió explícitamente, pero al preguntar por el alcance el usuario eligió el panel informativo (opción segura) en vez de un cargador de JS real — cargar código de terceros en una app con acceso a disco es una decisión de seguridad seria que no se debe improvisar. El panel "Plugins y comunidad" (🧩) queda como placeholder honesto; si más adelante se quiere un sistema real, la forma más segura sería scripts locales en una carpeta `plugins/` (no descargados de internet), con una API explícita y limitada (hooks tipo `onRender`/`onSave`, no acceso libre a `require`/`fs`), revisados a mano antes de habilitarse.

## Prioridad baja / a futuro

1. **Migrar de `window.md*` + scripts sueltos a ES modules.** El patrón actual (cada archivo en su IIFE, comunicación por `window.mdX`) ya no tiene el riesgo de colisión de antes, pero sigue siendo más implícito que `import`/`export` reales. No urge — funciona bien — pero facilitaría el crecimiento futuro.
2. **Exportar a PDF/HTML no embebe KaTeX real.** Usa una hoja de estilos simplificada; las fórmulas se ven aproximadas. Decisión consciente en su momento para no arrastrar fuentes, pero vale la pena revisar si molesta en la práctica.
3. **Sin CI.** Los checks de `npm test` (y ahora `npm run lint`) solo corren si alguien se acuerda de correrlos a mano. Con git y GitHub ya en pie, un workflow de Actions simple lo resolvería sin mucho esfuerzo.
4. **Historial de versiones sin diff ni límite de espacio real.** Guarda copias completas (no deltas) y el tope es "20 por archivo", no un tamaño total — en un proyecto con muchos archivos grandes podría acumular bastante en `userData`.
5. **La detección de binario es una heurística.** Byte NUL en los primeros 8000 bytes (lo mismo que usa git) — no es perfecta, pero es la misma que usan herramientas ya probadas.
6. **Corrector ortográfico sin sugerencias por clic derecho.** El menú contextual propio de MK reemplaza al nativo de Chromium, que es el que trae las sugerencias de corrección — hoy el corrector solo subraya, no corrige. Arreglarlo bien necesita escuchar `context-menu` en `main.js` (ahí sí llegan `misspelledWord`/`dictionarySuggestions`) y coordinar con el menú del renderer, con el timing async correcto — no es trivial, quedó afuera de esta pasada.
7. **Diagramas Mermaid con fondo fijo blanco.** No se adapta a los 26 temas de color — se podría pasar `theme: 'dark'` de Mermaid cuando el tema de MK es oscuro, pero no todos los temas mapean limpiamente a "claro u oscuro" (quedaría para revisar caso por caso).
