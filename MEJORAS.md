# Cosas que mejoraría en MK

Opinión propia, no pedida por ninguna feature en curso. Ordenado por impacto real, no por lo divertido que sea implementarlo. Lo ya hecho se saca de acá (queda trackeado en `ESTADO.md`) para que esto no crezca infinito.

## Ideas descartadas (por ahora)

- **Sistema de plugins de verdad (JS de terceros).** Se pidió explícitamente, pero al preguntar por el alcance el usuario eligió el panel informativo (opción segura) en vez de un cargador de JS real — cargar código de terceros en una app con acceso a disco es una decisión de seguridad seria que no se debe improvisar. El panel "Plugins y comunidad" (🧩) queda como placeholder honesto; si más adelante se quiere un sistema real, la forma más segura sería scripts locales en una carpeta `plugins/` (no descargados de internet), con una API explícita y limitada (hooks tipo `onRender`/`onSave`, no acceso libre a `require`/`fs`), revisados a mano antes de habilitarse.
- **Ejecutar código en otros lenguajes (Python, etc.), no solo JavaScript.** El JS corre aislado en un Web Worker (sin acceso a archivos ni a la app). Python u otros lenguajes necesitarían invocar un proceso real del sistema — un salto de riesgo grande que no se debe hacer sin pensarlo aparte.

## Proyectos pesados (no es una pasada de una tarde)

- **Excalidraw embebido (pizarra de dibujo).** Técnicamente viable sin romper el patrón "sin bundler" de MK: Excalidraw tiene un build UMD (`excalidraw.production.min.js` + React/ReactDOM UMD) que se puede cargar con `<script>` suelto, igual que CodeMirror/KaTeX/Mermaid hoy. Se integraría como panel nuevo (tipo Kanban/Graph): botón en la toolbar, abre un canvas de dibujo, guarda como `.excalidraw` (JSON) al lado del `.md` o embebido como imagen exportada en el Markdown. Lo que lo hace "pesado" y no una pasada más: primera dependencia realmente grande (~2MB+ de JS, React entero solo para esto) y hay que decidir bien el modelo de guardado (archivo aparte vs. embebido, cómo referenciarlo desde el `.md`) antes de escribir código — vale la pena, pero es medio día de trabajo en serio, no una tarde.

## Prioridad baja / a futuro

1. **Migrar de `window.md*` + scripts sueltos a ES modules.** El patrón actual (cada archivo en su IIFE, comunicación por `window.mdX`) ya no tiene el riesgo de colisión de antes, pero sigue siendo más implícito que `import`/`export` reales. No urge — funciona bien — pero facilitaría el crecimiento futuro.
2. **Exportar a PDF/HTML no embebe KaTeX real.** Usa una hoja de estilos simplificada; las fórmulas se ven aproximadas. Decisión consciente en su momento para no arrastrar fuentes, pero vale la pena revisar si molesta en la práctica.
3. **Historial de versiones sin diff ni límite de espacio real.** Guarda copias completas (no deltas) y el tope es "20 por archivo", no un tamaño total — en un proyecto con muchos archivos grandes podría acumular bastante en `userData`.
4. **La detección de binario es una heurística.** Byte NUL en los primeros 8000 bytes (lo mismo que usa git) — no es perfecta, pero es la misma que usan herramientas ya probadas.
5. **Diagramas Mermaid con fondo fijo blanco.** No se adapta a los 26 temas de color — se podría pasar `theme: 'dark'` de Mermaid cuando el tema de MK es oscuro, pero no todos los temas mapean limpiamente a "claro u oscuro" (quedaría para revisar caso por caso).
6. **Kanban limitado a un solo archivo.** No combina tareas de varios documentos ni soporta subcolumnas — sería más potente si pudiera armar un tablero a partir de una carpeta entera, no solo el archivo activo.
7. **Export a EPUB de un solo capítulo.** No arma un libro multi-archivo (cada nota como capítulo) ni tiene portada — para "apuntes largos" de un solo documento ya sirve, para un libro real de varios archivos faltaría.
8. **Sincronización con git sin control fino.** Siempre `git add -A` con un mensaje genérico — no se puede elegir qué archivos incluir ni escribir un mensaje de commit propio desde MK.
9. **Grafo: el reacomodo manual de nodos no se guarda.** Ahora se puede arrastrar/zoomear/pan, pero al cerrar y reabrir el grafo vuelve a correr el layout automático desde cero — persistir posiciones por carpeta sería el siguiente paso natural.
