# Cambios

Todas las versiones de MK. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones: [SemVer](https://semver.org/lang/es/) (mayor.menor.parche).

Para publicar una versión nueva: sumar una sección acá, `npm version <mayor|menor|parche>` y `git push --follow-tags` — GitHub Actions compila el AppImage y lo publica en *Releases*.

## Sin publicar

- Búsqueda con nombres destacados, ubicación secundaria, coincidencias resaltadas y navegación con flechas/Enter. Paleta y apertura rápida con ayudas de teclado, selección siempre visible y estados vacíos más claros. Resultados antiguos descartados al cambiar de consulta o cerrar; avisos de error adaptados al tema y con contenido largo desplazable.

- Pestañas con nombres largos recortados, indicador independiente de cambios, cierre discreto y selección/foco más claros. Separadores de paneles con agarre visible y acabado común de diálogos; Ajustes apila campos en ventanas estrechas y mejora el espaciado y la lectura.

- Home como espacio principal con vista Día, resumen de agenda, creación sin guardar borradores cancelados, opciones agrupadas, tareas completadas plegables y Deshacer al completar o mover tareas propias. Semana y mes se adaptan al espacio disponible; volver al editor conserva el documento y su posición.
- Edición PDF con herramientas por contexto, navegación directa a página, zoom y ajuste al ancho, nombre de archivo y estado de cambios. Guardar copia y Ctrl+S muestran el resultado en el panel.
- Pizarra con Guardar destacado, Guardar como separado y estados de cambios, guardado, cancelación y error; controles protegidos durante el guardado.

- Temas renovados con paletas más diferenciadas, colores propios de sintaxis compartidos entre editor, código de las notas y terminal, controles nativos claros/oscuros y texto legible sobre botones de acento. Kingdom Hearts conserva su identidad azul y dorada. Galería con muestras de sintaxis y colores; contraste comprobado en los 27 temas.

- Interfaz más despejada: menú Herramientas, ancho de lectura configurable, controles coherentes y jerarquía del documento refinada. Explorador con acciones al pasar el cursor o enfocar, archivo activo destacado y acciones para carpetas vacías. Contraste del texto secundario revisado en los 27 temas. Home más amplio y adaptable, tareas con más espacio, prioridades con etiquetas y foco de teclado visible.

- Atajos personalizables en Ajustes: 23 acciones, grabación de combinaciones, conflictos y teclas reservadas, quitar/restaurar por acción y restauración global. Guardado confirmado, conservación de atajos anteriores si falla, respeto de módulos apagados y teclas locales de terminal/pizarra; ayudas de botones actualizadas.

- Vista de estudio dividida: editor de notas junto a PDF y pizarra editable opcional. Apertura desde paleta, asignatura o tema; PDF ajustado al ancho, citas con página sin cerrar el visor, pizarra ocultable sin perder cambios y protección al cerrar con cambios pendientes.

- Comprensión por asignatura: temas pendientes, practicando o dominados, enlaces a materiales y tarjetas y señales de repaso/errores de examen. Resumen semanal con tiempo, tareas activas y archivadas, repeticiones y temas actuales para reforzar; consulta de semanas anteriores sin confundir autoevaluación con aprendizaje demostrado.

- PDFs y pizarras incrustados en Markdown mediante `![[archivo.pdf#page=2]]` y `![[archivo.excalidraw]]`, en Preview y Live Preview. Inserción desde paleta, navegación del PDF y actualización de dibujos tras guardar. Carga visible limitada, liberación de recursos y protección de rutas y HTML ajeno; exportaciones conservan enlaces, no visores.

- Repaso espaciado por asignatura: tarjetas manuales o desde la selección de una nota, edición, fechas según valoración y contador de pendientes en Home. Guardado confirmado y reintento sin duplicar valoraciones.
- Modo examen: preguntas en orden aleatorio, intento antes de revelar la referencia, autoevaluación, historial persistente y práctica de errores. No altera el calendario de repaso ni modifica los apuntes.

- Estudio por asignatura: materiales Markdown/PDF, próximas entregas, tareas y tiempo por categoría de Pomodoro. Plan de hoy con presupuesto de foco y prioridades por vencimiento, sin modificar tareas automáticamente.
- Primera pizarra Excalidraw local, cargada bajo demanda: creación, apertura y guardado manual `.excalidraw`, protección ante cambios externos y aviso al descartar cambios. Sin cuenta ni servicio de pago; dibujos en panel independiente, todavía sin incrustación en notas.
- Dependencias de la pizarra actualizadas mediante overrides y DOMPurify actualizado para corregir avisos de seguridad de producción.

- Mascotas Pokémon: variantes regionales desde PBS de formas, selección individual de cualquier sprite —incluidas evoluciones y especies fuera del catálogo—, búsqueda por identificador y Mostrar más. Importación de Pokémon propios/futuros con nombre, región e imagen libres, sin reemplazar la colección. Se validan todas las imágenes de una línea antes de sustituir etapas existentes.

- Contexto de estudio: focos vinculados a una nota Markdown guardada, detalle editable del trabajo, reapertura del apunte y filtros del historial/estadísticas por nota. El vínculo no cambia al pasar de pestaña; se conservan registros anteriores, categorías y tareas Home.

- PDF a apuntes: selección y copia del texto original, citas en notas nuevas o al final de la nota activa, y enlaces a la página original desde preview y Live Preview. Selección en páginas giradas, aviso de escaneos sin OCR, protección de anotaciones al cambiar de archivo y descarte de renders antiguos.

- Live Preview: escribir dentro de palabras con formato y espacios fuera de delimitadores ya no reconstruye toda la nota. Marcadores ocultos sin widgets vacíos, tokens reutilizados por texto/idioma, limpieza de marcas localizada y liberación del DOM de lectura oculto. Nuevas mediciones de edición con formato y entrada nativa; la optimización general sigue pendiente.

- Segunda optimización de CM6: evita reconstrucciones duplicadas al cambiar de pestaña y difiere el preview oculto. Live Preview actualiza localmente filas de tablas, callouts y cuerpos de bloques de código cuando conservan su estructura. Mediciones desglosadas de apertura y reconstrucción.

- Primera optimización de CM6: cachés de texto y posiciones, decoraciones agrupadas por documento y actualización local conservadora de prosa en Live Preview. El corrector descarta respuestas antiguas tras editar o cambiar de pestaña.

- Pomodoros con categorías, estadísticas por periodo y asignatura, historial editable y registros manuales; tiempo efectivo sin pausas ni descansos, checkpoints y reintento de guardado.
- Roxas disponible al importar su hoja sin exigir Lucky Emblems; conserva personajes y progreso existentes.

- Editor migrado a CodeMirror 6, con historial independiente por pestaña, autocompletado nativo y compatibilidad con Live Preview, búsqueda, corrector y modo máquina de escribir.
- Lenguajes de código empaquetados para CM6; ya no se cargan addons de CM5 al abrirlos.
- Pruebas ampliadas para Live Preview, historial, autocompletado y limpieza de decoraciones entre pestañas. Las pruebas y el empaquetado regeneran automáticamente el bundle del editor.

## [2.0.0] — 2026-09-30

### Planificar
- **Home → Horario**: la semana por horas, estilo calendario: tareas en su franja con duración, crear en un hueco, arrastrar para mover o cambiar la duración, línea de ahora.
- **Archivo del Home**: las tareas terminadas hace más de 3 meses (ajustable) pasan a un archivo; siguen en la búsqueda y en la racha.
- **Home**: planificador semanal y mensual con calendario, tareas con hora, prioridad y repetición (hábitos), arrastrar tareas de día, tareas `📅` escritas en notas, estadísticas 📈, **categorías** con color (`@categoría` al agregar, filtro).
- **Recordatorios**: a la hora, días antes y **1 semana antes automático**; posponer y ✓ Hecho desde la tarjeta; siguen sonando con MK en la **bandeja**; también **por correo (Gmail)** con resumen diario opcional.
- **Bases de datos** tipo Notion en `.mk/`: columnas tipadas, relaciones, fórmulas, rollups, vistas tabla / tablero / galería / calendario / **gráfico**, filtros y orden, CSV; **bloque `database`** en notas (editable en el lugar).
- **Gráficos**: bloque `chart` desde tablas Markdown.
- **Widgets en notas** (bloque `widget`): tareas de hoy/semana/atrasadas tildables, progreso, totales de una base, mascotas.
- **Nota diaria** configurable (carpeta, formato, plantilla).
- **Mascotas**: equipo que evoluciona con tus tareas y Pomodoros, huevos, legendarias por logros; criaturas de MK, de un juego de RPG Maker o imágenes propias.

### Escribir y ver

- **Modo máquina de escribir** (`Ctrl+Alt+M`): la línea del cursor siempre centrada; opción de **atenuar los otros párrafos**.
- **Reemplazar en toda la carpeta** (botón en `Ctrl+Shift+F`): vista previa −/+ por línea, regex, cada archivo con su versión anterior en el historial.
- **Pegar imágenes** con `Ctrl+V` (capturas, *Copiar imagen*) o arrastrarlas desde el navegador: se guardan en `assets/` junto a la nota.
- **Live Preview**, botón de modo con el modo actual, fotos / video / audio de cualquier formato común, explorador de multimedia.
- **Escribir en PDF** (texto libre y formularios).
- Resaltado y F5 para ~25 lenguajes más.

### Terminal e IA
- **Terminal integrada** (pestañas, pantalla dividida, elegir shell, buscar), **F5** para ejecutar, **Abrir con IA** (Claude Code, Gemini CLI, Codex), **bloques `run`** con confirmación.

### Interfaz

- **Galería de temas** en Ajustes → Apariencia, con muestra de cada tema y vista previa grande al pasar el mouse (reemplaza al menú «Tema» de la barra).

- **Guiño a Kingdom Hearts**: llavero de keyblades con logros (con tu propia imagen), golpe al tildar, cursor keyblade, tema *Kingdom Hearts* con Lucky Emblems; **Sora y Roxas** como mascotas animadas (con tus hojas de sprites) y retratos de Sora que reaccionan.
- Títulos y enlaces del editor con el color del tema (antes, azul ilegible en los temas oscuros).

- **Reabrir la pestaña cerrada** con `Ctrl+Alt+W` (también los borradores sin título, con su texto).

- **Bienvenida** en el primer arranque: elegir qué usar (Escribir / Escribir y planificar / Todo), crear o elegir la carpeta de notas y los atajos clave.
- **Ajustes** rediseñado (secciones, buscador), barra superior solo íconos / con texto / oculta, **Módulos** para apagar lo que no uses, barra de estado (guardado, rama de git, palabras), grafo interactivo, tokens de diseño y animaciones suaves.
- **Accesibilidad**: contraste WCAG AA en los 26 temas, navegación con teclado, ARIA.

### Carpetas grandes

- **Preview incremental**: solo se reprocesa el bloque que cambió (la mitad de tiempo en notas grandes).
- La carpeta **se vigila sola**, disco asíncrono, **índice** en memoria y en disco; `main.js` separado en módulos.

### Seguridad y solidez

- **Versión de formato** en `config.json`, `home.json` y las bases SQLite, con migraciones automáticas (y copia antes de cada una).
- **Reportar un problema** (Ajustes → Sistema): informe con versión, sistema y últimos errores, sin datos personales, para copiar o abrir en GitHub.
- Corregido: borrar una vista de una base de datos podía dar error si las vistas se habían cambiado desde un bloque en una nota.

- Respaldo: exportar / importar ajustes, Home y mascotas en un archivo `.mkbackup` (copia automática antes de importar).
- Electron 44; **CSP**, **sandbox**, **rutas validadas** en el proceso principal; ventana de impresión de PDF aislada.
- Guardado **atómico** (bases de datos, Home, configuración); un JSON dañado se aparta en vez de pisarse; **registro de errores** y avisos visibles; las pestañas viejas ya no pisan archivos cambiados afuera.
- **Pruebas**: suite de la app (133 checks) y pruebas unitarias rápidas (`npm run test:unit`) en CI.

## [1.0.0] — 2026-09-11

Primera versión: editor de Markdown y LaTeX local con pestañas, preview, búsqueda, etiquetas, wikilinks, backlinks y grafo, Kanban, Mermaid, historial de versiones, git, Pomodoro, herramientas de PDF, importar/exportar `.docx`, exportar a PDF / HTML / EPUB / Anki, panel secundario y 26 temas.

[2.0.0]: https://github.com/Joviva22/MK/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Joviva22/MK/releases/tag/v1.0.0
