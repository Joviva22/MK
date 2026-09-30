# Cambios

Todas las versiones de MK. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones: [SemVer](https://semver.org/lang/es/) (mayor.menor.parche).

Para publicar una versión nueva: sumar una sección acá, `npm version <mayor|menor|parche>` y `git push --follow-tags` — GitHub Actions compila el AppImage y lo publica en *Releases*.

## [2.0.0] — 2026-09-30

### Planificar
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

- **Reabrir la pestaña cerrada** con `Ctrl+Alt+W` (también los borradores sin título, con su texto).

- **Bienvenida** en el primer arranque: elegir qué usar (Escribir / Escribir y planificar / Todo), crear o elegir la carpeta de notas y los atajos clave.
- **Ajustes** rediseñado (secciones, buscador), barra superior solo íconos / con texto / oculta, **Módulos** para apagar lo que no uses, barra de estado (guardado, rama de git, palabras), grafo interactivo, tokens de diseño y animaciones suaves.
- **Accesibilidad**: contraste WCAG AA en los 26 temas, navegación con teclado, ARIA.

### Carpetas grandes
- La carpeta **se vigila sola**, disco asíncrono, **índice** en memoria y en disco; `main.js` separado en módulos.

### Seguridad y solidez

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
