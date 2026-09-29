# Objetivos y mejoras de MK

Hoja de ruta de la aplicación, de corto a largo plazo. Cada objetivo se **tacha** (`- [x] ~~así~~`) cuando se termina, con la fecha.

> Truco: este archivo es también un tablero. Abrilo en MK → paleta (`Ctrl+Shift+P`) → **"Ver tablero Kanban"**: cada `##` es una columna y cada objetivo una tarjeta.

**Estado:** 52 de 95 objetivos cumplidos · última actualización 2026-09-29.

---

## Prioridad recomendada (según Claude)

Orden sugerido para lo que falta, de más a menos urgente. Los detalles de cada uno están en las secciones de abajo.

**P1 — Seguridad y que nada se pierda** ✅ *hecho (2026-09-29): Electron 44 sin vulnerabilidades, instalación con `npm run install-desktop`, Home opcional en la carpeta.*

**P2 — Lo que más se nota en el uso diario**
1. ~~**Escribir en PDF**~~ ✅ hecho. *(era prioridad alta)* abrir un PDF, hacer clic en cualquier lugar de la página y escribir (tamaño y color de letra), mover/borrar lo agregado, **rellenar formularios PDF** (campos de texto y casillas) y guardar como PDF nuevo. Editar el texto que ya viene impreso sigue en largo plazo.
3. ~~**Abrir con IA (Claude Code, Gemini CLI, Codex)**~~ ✅ hecho.
4. ~~**Gráficos en las bases de datos**~~ ✅ hecho.
5. ~~**Búsqueda global también en bases de datos y tareas del Home**~~ ✅ hecho.
6. **Recordatorios y resumen diario por Gmail**: el sistema de avisos ya está completo; falta el canal de correo (necesita tu contraseña de aplicación de Google).
7. ~~**Home: estadísticas**~~ ✅ hecho.

**P3 — Comodidad**
8. **Gráficos desde tablas Markdown** (`chart`).
9. **Bases de datos dentro de una nota** (bloque `database`).
10. **Nota diaria configurable** (carpeta y nombre).
11. **Terminal: pantalla dividida**.

**P4 — Mantenimiento técnico** (no se ve, pero hace que lo demás sea más fácil y seguro de cambiar)
12. **Separar `main.js`** en módulos.
13. **Migrar a módulos ES** (después del 12).

**Escalabilidad** — ver la sección "Escalabilidad y solidez": lo más urgente es el **índice de la carpeta**, **vigilar la carpeta** y el **disco asíncrono** (sin eso, una carpeta con miles de notas congela MK).

**P5 — Proyectos grandes** (requieren decidir antes el diseño; hacerlos de a uno y con tiempo)
14. Sincronización entre dispositivos · 15. Windows y macOS · 16. Sistema de plugins · 17. Pizarra Excalidraw · 18. Dos editores escribibles · 19. Ejecutar Python en el preview · 20. YouTube embebido · 21. Editar texto dentro de un PDF.

---

## Hecho recientemente

- [x] ~~**Home**: planificador semanal y mensual con calendario, objetivos, notas, atrasadas y bandeja sin fecha~~ (2026-09-29)
- [x] ~~**Home + Bases de datos**: las filas con columna Fecha aparecen en el calendario~~ (2026-09-29)
- [x] ~~**Guías por función** (`Guias/`): cómo usar y para qué sirve cada parte de MK~~ (2026-09-29)
- [x] ~~**Home: tareas recurrentes** (diaria, días hábiles, semanal con días elegidos, mensual, anual, con fecha de fin)~~ (2026-09-29)
- [x] ~~**Home: hora en las tareas y recordatorios** con notificación del sistema~~ (2026-09-29)
- [x] ~~**Bases de datos: ordenar por columna**~~ (2026-09-29)
- [x] ~~**Bases de datos: filtros por campo** guardados en cada vista~~ (2026-09-29)
- [x] ~~**Terminal integrada** estilo VS Code (xterm.js + node-pty, varias pestañas, `` Ctrl+` ``)~~ (2026-09-29)
- [x] ~~**Bases de datos relacionales** tipo Notion (relaciones, fórmulas, rollups, vistas)~~ (antes de 2026-09-29)
- [x] ~~**Tema personalizado** con selector de color~~ (antes de 2026-09-29)
- [x] ~~Crear esta hoja de ruta (`OBJETIVOS.md`)~~ (2026-09-29)
- [x] ~~**Regenerar el AppImage** (`npm run dist`) con todo lo nuevo, terminal incluida (node-pty verificado dentro del paquete)~~ (2026-09-29)
- [x] ~~**Home: Pomodoro desde una tarea**: ⏱ en el editor de tarea, cuenta 🍅 y pregunta si la terminaste~~ (2026-09-29)
- [x] ~~**Home: enlazar una nota** a la tarea (📄 en la tarjeta la abre)~~ (2026-09-29)
- [x] ~~**Home: tareas de las notas en el calendario** (`- [ ] algo 📅 2026-10-03`), tildables desde el Home~~ (2026-09-29)
- [x] ~~**Home: "Plan de hoy → nota diaria"** (sección `## Plan del día`, sin duplicar)~~ (2026-09-29)
- [x] ~~**Bases de datos: vista Calendario** (arrastrar para cambiar la fecha, doble clic para crear)~~ (2026-09-29)
- [x] ~~**Bases de datos: importar y exportar CSV** (detecta separador y tipos)~~ (2026-09-29)
- [x] ~~**Terminal: colores ANSI adaptados a temas claros**~~ (2026-09-29)
- [x] ~~**Terminal: "Abrir terminal aquí"** en el menú contextual del sidebar~~ (2026-09-29)
- [x] ~~**Terminal: ejecutar el archivo actual** (F5 / ▶: `.py`, `.sh`, `.js`, `.c`, `.cpp`, `.java`, `.rb`, `.go`)~~ (2026-09-29)
- [x] ~~Arreglo: el panel de Bases de datos quedaba recortado en alto~~ (2026-09-29)
- [x] ~~**`desktopName` en `package.json`**: el AppImage trae `mk-editor.desktop` con `StartupWMClass=mk-editor`~~ (2026-09-29)
- [x] ~~**Home: renombrar una tarea con doble clic** en el título~~ (2026-09-29)
- [x] ~~**Bases de datos: ancho de columnas ajustable** (arrastrar el borde; se guarda por vista)~~ (2026-09-29)
- [x] ~~**Bases de datos: duplicar una fila** (clic derecho → Duplicar, copia valores y relaciones)~~ (2026-09-29)
- [x] ~~**Terminal: buscar dentro de la salida** (`Ctrl+F`)~~ (2026-09-29)
- [x] ~~Terminal: fuentes Nerd Font para prompts con íconos (Powerlevel10k, Starship)~~ (2026-09-29)
- [x] ~~**Modo "Live Preview"** (escribir viendo el Markdown renderizado; cuarto modo además de normal/enfoque/lectura, `Ctrl+Shift+L` y en el ciclo 🎯). Pedido del usuario~~ (2026-09-29)
- [x] ~~Limpieza: fuera `ESTADO.md`, `MEJORAS.md` y `RESUMEN.md` (desactualizados; lo pendiente pasó acá), restos de build y de tests~~ (2026-09-29)
- [x] ~~**Recordatorios para filas de bases de datos**: avisos configurables en cada columna Fecha, para todas sus filas~~ (2026-09-29)
- [x] ~~**Recordatorios anticipados ("faltan N días")**: varios avisos por tarea, "N días antes a las HH:MM"; la notificación dice qué, qué día y a qué hora (*"Faltan 3 días para Entregar TP — Viernes, 2 de octubre a las 18:30"*)~~ (2026-09-29)
- [x] ~~**Posponer avisos** (10 min, 1 hora, mañana 9:00) y **✓ Hecho** desde una tarjeta de aviso en MK (Linux no permite botones en la notificación del sistema); lo pospuesto se guarda entre sesiones~~ (2026-09-29)
- [x] ~~**Recordatorios con la ventana cerrada**: cerrar deja MK en la bandeja del sistema (avisos activos; salir con `Ctrl+Q` o el menú de la bandeja) y opción "Iniciar MK con el sistema" (arranca oculto)~~ (2026-09-29)
- [x] ~~**Home: "→ Mañana"** en el editor de tarea y **"A mañana"** para todas las atrasadas~~ (2026-09-29)
- [x] ~~**Bases de datos: ordenar por varias columnas** ("+ Después por esta", niveles ↑1 ↓2)~~ (2026-09-29)
- [x] ~~**Terminal: renombrar una pestaña** con doble clic~~ (2026-09-29)
- [x] ~~**Sidebar: "Copiar ruta" / "Copiar ruta relativa"** y **selección de rango con `Shift`+clic**~~ (2026-09-29)
- [x] ~~**Live Preview: callouts y diagramas Mermaid** dibujados~~ (2026-09-29)
- [x] ~~**Arrastrar en todos los tableros**: en el Home también las tareas 📅 de notas (cambia la fecha en el archivo) y las filas de bases de datos; en el Kanban modo carpeta, entre columnas (dentro de su archivo)~~ (2026-09-29)
- [x] ~~**P1 · Electron 32 → 44.4.5**: `npm audit` pasa de 2 vulnerabilidades altas a 0 (el portapapeles pasó al proceso principal, que Electron 44 exige)~~ (2026-09-29)
- [x] ~~**P1 · Instalación en el usuario** (`npm run install-desktop`): AppImage en `~/.local/share/mk/`, lanzador del menú e "Iniciar con el sistema" apuntando ahí, sin depender de la carpeta del proyecto~~ (2026-09-29)
- [x] ~~**P1 · Home en la carpeta abierta (opcional)**: `<carpeta>/.mk/home.json`, viaja con git; guardado atómico (sin archivos a medio escribir)~~ (2026-09-29)
- [x] ~~**Abrir con IA**: Claude Code, Gemini CLI y Codex desde el sidebar, el botón "IA ▾" y la paleta, en una pestaña de la terminal con el archivo como contexto~~ (2026-09-29)
- [x] ~~**Arreglo (pérdida de datos)**: una pestaña con contenido viejo ya no pisa un archivo que cambió fuera de MK — recarga si no hay cambios propios, ⚠ + autoguardado en pausa si los hay, y Ctrl+S pregunta~~ (2026-09-29)
- [x] ~~**Arreglo: `prompt()` no funciona en Electron**: rompía las plantillas de "Nuevo ▾" (salvo Markdown vacío), "Insertar tabla" y crear/renombrar en el sidebar. Diálogo propio (`askdialog.js`) y regla de ESLint que prohíbe `prompt()`~~ (2026-09-29)
- [x] ~~**Pestañas: clic derecho** → cerrar / las otras / las de la derecha / las guardadas / todas, copiar ruta~~ (2026-09-29)
- [x] ~~**Arreglo sidebar**: mover un archivo arrastrándolo volvía a fallar (el arrastre nativo pisaba al interno en Electron 44; ahora es `Alt`+arrastrar); el árbol ya no se pliega entero al crear/mover/renombrar (lo nuevo queda visible y resaltado); mover una carpeta actualiza las pestañas de sus archivos; "Mi nota" se crea como `Mi nota.md`~~ (2026-09-29)
- [x] ~~**Gráficos en las bases de datos**: vista Gráfico (barras, líneas, torta) agrupando por cualquier columna o por día/semana/mes/año, midiendo cantidad/suma/promedio; tooltip y "Ver tabla"~~ (2026-09-29)
- [x] ~~**Escribir en PDF**: texto libre en cualquier lugar de la página (tamaño, color, mover, borrar) y formularios PDF (texto, casillas, listas), guardado en un PDF nuevo~~ (2026-09-29)
- [x] ~~**Búsqueda global en tareas del Home y bases de datos** (secciones Archivos / Tareas / Bases de datos; clic abre la tarea o la base filtrada)~~ (2026-09-29)
- [x] ~~**Home: estadísticas** (📈): semana/mes, racha, atrasadas, hechas por semana, pendientes por prioridad y rachas de hábitos~~ (2026-09-29)

## Corto plazo (próximas sesiones)

Mejoras chicas y de uso diario: se hacen en una sesión cada una. *(Todas hechas — ver "Prioridad recomendada" para lo que sigue.)*


## Escalabilidad y solidez

Lo que MK necesita para seguir andando rápido y sin sorpresas con **carpetas grandes** (miles de notas), **más datos** (años de tareas, bases de miles de filas) y **más funciones**. Basado en lo que hoy hace el código (medido el 2026-09-29).

### Carpetas grandes
- [ ] **Índice de la carpeta**: hoy búsqueda, etiquetas, backlinks, grafo, Kanban de carpeta y tareas 📅 del Home **releen todos los archivos** en cada consulta. Un índice en memoria (ruta → fecha de modificación, etiquetas, enlaces, tareas) actualizado solo con lo que cambia, y guardado en `.mk/index` para arrancar rápido
- [ ] **Vigilar la carpeta** (`fs.watch`): el árbol, el índice y las pestañas se actualizan solos cuando algo cambia afuera (git, otra app, una IA), sin botón 🔄
- [ ] **Disco asíncrono en el proceso principal**: 63 llamadas `…Sync` bloquean toda la ventana mientras leen/escriben; con carpetas grandes o discos lentos, la app se congela. Pasarlas a `fs.promises`
- [ ] **Árbol del sidebar virtualizado y cargado por demanda**: hoy se lee la carpeta entera (recursivo) al abrirla; leer cada subcarpeta al desplegarla y dibujar solo las filas visibles
- [ ] **Búsqueda con índice y sin tope de 200**: resultados al instante, con filtros (carpeta, tipo, fecha) y búsqueda aproximada

### Datos que crecen
- [ ] **Bases de datos: guardar solo lo que cambió**: hoy cada edición reescribe el archivo SQLite **entero** (`db.export()`); agrupar escrituras (guardar cada ~1 s) o pasar a SQLite nativo con WAL
- [ ] **Bases de datos grandes**: tabla virtualizada (solo filas visibles), paginación y cálculo de fórmulas/rollups en segundo plano, para bases de 10.000+ filas
- [ ] **Home con años de tareas**: archivar tareas terminadas viejas (siguen en búsqueda y estadísticas) y buscar avisos por fecha en vez de recorrer todas las tareas cada 30 s
- [ ] **Versión en los archivos de datos** (`home.json`, `config.json`, esquema SQLite) con migraciones automáticas, para poder cambiar formatos sin romper datos viejos
- [ ] **Exportar / importar todo**: un solo archivo con Home, bases de datos, ajustes y snippets (respaldo y mudanza a otra computadora)

### Rendimiento de la edición
- [ ] **Preview incremental**: redibujar solo los bloques que cambiaron (hoy se regenera todo el HTML en cada pausa)
- [ ] **Live Preview incremental al escribir**: hoy cada cambio de texto reconstruye todas las marcas del documento; limitarlo a las líneas tocadas
- [ ] **Migrar a CodeMirror 6**: CodeMirror 5 está en mantenimiento; la 6 es más rápida con documentos grandes, tiene mejor accesibilidad y decoraciones nativas para Live Preview
- [ ] **Medición continua** (`npm run bench`): arranque, render del preview y apertura de carpeta, con valores de referencia para detectar si algo empeora

### Arquitectura
- [ ] **Separar `main.js`** y **migrar a módulos ES** (ver Mediano/Largo plazo)
- [ ] **Una sola capa de acceso a archivos** con validación de rutas centralizada (hoy cada IPC valida por su cuenta)
- [ ] **Tareas pesadas fuera de la ventana** (Web Workers / proceso aparte): parseo de la carpeta, grafo, CSV grandes, PDFs grandes
- [ ] **Traducciones (i18n)**: los textos están escritos en el código; sacarlos a archivos para poder tener MK en inglés u otros idiomas
- [ ] **Accesibilidad**: navegación completa con teclado, roles ARIA en paneles y menús, probado con lector de pantalla

### Calidad
- [ ] **Tests unitarios rápidos** (node:test) para la lógica pura (fechas del Home, CSV, filtros, fórmulas, parseo de tareas), además de la suite de la app completa (hoy 106 checks, ~25 s)
- [ ] **Registro de errores local** (`~/.config/md-editor-local/logs`) y botón "Reportar un problema" que arme el informe sin datos personales
- [ ] **Pruebas visuales**: capturas de referencia de los paneles principales en claro/oscuro, para detectar diseño roto

### Seguridad
- [ ] **Content-Security-Policy** en la ventana (hoy no hay): solo scripts propios, sin `eval` remoto
- [ ] **`sandbox: true` en el renderer**: hoy está desactivado porque el `preload` usa módulos de Node; mover eso al proceso principal
- [ ] **Permisos de la terminal e IAs** documentados y visibles (qué carpeta ve cada una)

### Distribución
- [ ] **Versiones y CHANGELOG** (semver) y **releases automáticos** del AppImage en GitHub Actions
- [ ] **Actualización automática** del AppImage (avisar cuando hay versión nueva y actualizar con un clic)

## Mediano plazo

Funciones más grandes o que tocan varias partes de la app.

- [ ] **Gráficos desde tablas Markdown**: un bloque ```` ```chart ```` (o botón en una tabla del preview) que dibuja barras/líneas/torta a partir de una tabla `| … |` de la nota, también en Live Preview
- [ ] **Bases de datos dentro de una nota**: bloque ```` ```database Proyectos ```` ```` que muestra la tabla en el preview
- [ ] **Recordatorios por Gmail**: además de la notificación local, mandar un correo a tu Gmail con los mismos avisos — del mismo día y anticipados ("faltan N días"), a la hora que elijas — para tareas del Home y filas de bases de datos con fecha. El asunto dice qué y cuándo (*"Faltan 3 días: Entregar TP — vie 3 oct, 18:30"*) y el cuerpo trae día, hora, notas y de dónde sale (Home, nota o base de datos). Configuración en Ajustes con tu dirección y una **contraseña de aplicación** de Google (SMTP), guardada cifrada con el llavero del sistema (`safeStorage`), nunca en texto plano. Opcional y apagado por defecto: es la única función que necesita internet
- [ ] **Resumen diario por Gmail**: un correo cada mañana con el plan del día (tareas, atrasadas y fechas de bases de datos), a la hora que elijas
- [ ] **Terminal: pantalla dividida** (dos terminales visibles lado a lado)
- [ ] **Separar `main.js`** (más de 1100 líneas) en módulos por área, como ya se hizo con `dbengine.js` y `ptyhost.js`
- [ ] **Nota diaria configurable**: elegir carpeta y formato del nombre (hoy siempre `Diario/AAAA-MM-DD.md`)

## Largo plazo

Proyectos pesados o que requieren decisiones de diseño/seguridad antes de empezar.

- [ ] **Pizarra Excalidraw** embebida para dibujar diagramas a mano (viable con su build UMD, pero suma ~2 MB y React; decidir antes si se guarda como `.excalidraw` aparte o dentro del `.md`)
- [ ] **Sistema de plugins** seguro: scripts locales en `plugins/` (nunca descargados), con una API limitada de hooks (`onRender`, `onSave`) sin acceso libre a `require`/`fs`, revisados antes de habilitarse
- [ ] **Ejecutar Python y otros lenguajes** dentro de los bloques de código del preview (hoy solo JS aislado en un Worker; para otros lenguajes está F5 en la terminal, que es explícito)
- [ ] **Dos editores escribibles a la vez** en pantalla dividida (hoy el panel secundario es de solo lectura; varios módulos asumen un único CodeMirror)
- [ ] **Migrar los scripts sueltos (`window.mdX`) a módulos ES** (`import`/`export`): refactor de todo `src/`, mejor hacerlo solo y con tiempo
- [ ] **Embeber vídeos de YouTube** (fácil técnicamente, pero rompe la premisa "sin internet": habría que marcar esas notas como no-offline)
- [ ] **Sincronización entre dispositivos** sin depender de git (carpeta en la nube / servidor propio)
- [ ] **Versión para Windows y macOS** (hoy el empaquetado y el reproductor multimedia son solo Linux)
- [ ] **Editar el texto dentro de un PDF** (hoy solo operaciones de página y subrayado: un PDF guarda glifos posicionados, no texto editable)

---

## Cómo se mantiene este archivo

1. Al terminar un objetivo: cambiar `- [ ]` por `- [x]`, tacharlo con `~~…~~`, agregar la fecha y moverlo a **Hecho recientemente**.
2. Actualizar el contador de **Estado** de arriba.
3. Ideas nuevas: agregarlas a la sección que corresponda según tamaño (corto = una sesión; mediano = varias; largo = requiere diseño previo).
