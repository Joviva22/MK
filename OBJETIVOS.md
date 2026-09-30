# Objetivos y mejoras de MK

Hoja de ruta de la aplicación, de corto a largo plazo. Cada objetivo se **tacha** (`- [x] ~~así~~`) cuando se termina, con la fecha.

> Truco: este archivo es también un tablero. Abrilo en MK → paleta (`Ctrl+Shift+P`) → **"Ver tablero Kanban"**: cada `##` es una columna y cada objetivo una tarjeta.

**Estado:** 101 de 136 objetivos cumplidos · última actualización 2026-09-30.

---

## Prioridad recomendada (según Claude)

Orden sugerido para lo que falta, de más a menos urgente. Los detalles de cada uno están en las secciones de abajo.

**P1 — Seguridad y que nada se pierda** ✅ *hecho (2026-09-29): Electron 44 sin vulnerabilidades, instalación con `npm run install-desktop`, Home opcional en la carpeta.*

**P2 — Lo que más se nota en el uso diario**
1. ~~**Escribir en PDF**~~ ✅ hecho. *(era prioridad alta)* abrir un PDF, hacer clic en cualquier lugar de la página y escribir (tamaño y color de letra), mover/borrar lo agregado, **rellenar formularios PDF** (campos de texto y casillas) y guardar como PDF nuevo. Editar el texto que ya viene impreso sigue en largo plazo.
3. ~~**Abrir con IA (Claude Code, Gemini CLI, Codex)**~~ ✅ hecho.
4. ~~**Gráficos en las bases de datos**~~ ✅ hecho.
5. ~~**Búsqueda global también en bases de datos y tareas del Home**~~ ✅ hecho.
6. ~~**Recordatorios y resumen diario por Gmail**~~ ✅ hecho (2026-09-30): ⚙ Ajustes → Correo; contraseña de aplicación cifrada con el llavero del sistema.
7. ~~**Home: estadísticas**~~ ✅ hecho.
8. ~~**Barra superior más limpia**~~ ✅ hecho (2026-09-30): opción en ⚙ Ajustes para mostrar los botones de la toolbar **solo con ícono** o **con texto** (hoy unos tienen texto y otros no), y ocultar la barra entera (se vuelve a mostrar con un atajo o al acercar el mouse arriba).
9. ~~**Rediseño de ⚙ Ajustes**~~ ✅ hecho (2026-09-30): hoy es un menú desplegable largo que se armó al principio y creció a los tumbos. Pasarlo a un **panel propio con secciones** (Editor, Apariencia, Nota diaria, Terminal, Home y recordatorios, Correo, Archivos y git, Toolbar), con buscador de ajustes y descripciones cortas.
10. ~~**El botón de modo muestra en qué modo estás**~~ ✅ hecho (2026-09-30): el botón de vista cambia de ícono y texto según el modo actual (Normal · Enfoque · Lectura · Live Preview), no solo el tooltip.
11. ~~**Mascota virtual**~~ ✅ hecho (2026-09-30) (como *vscode-pets* / *vscode-pokemon*): un compañero animado en una esquina (o en el panel de la terminal) que camina, se puede alimentar/tirar la pelota; varias especies y temas.
12. ~~**Mascota ligada a tus tareas y Pomodoros**~~ ✅ hecho (2026-09-30) (estilo *Digimon/Pokémon*): gana experiencia con cada tarea tildada y cada Pomodoro terminado, sube de nivel y **evoluciona**; se pone triste si hay tareas atrasadas. Depende del 11 y del 13.
13. ~~**Categorías en las tareas del Home**~~ ✅ hecho (2026-09-30): etiqueta de color, `@categoría` al agregar y filtro. Sin estadísticas por categoría ni vínculo con las mascotas (a pedido: más simple).

**P3 — Comodidad**
14. ~~**Gráficos desde tablas Markdown**~~ ✅ hecho.
15. ~~**Bases de datos dentro de una nota**~~ ✅ hecho.
16. ~~**Nota diaria configurable**~~ ✅ hecho.
17. ~~**Terminal: pantalla dividida**~~ ✅ hecho.

**P4 — Mantenimiento técnico** (no se ve, pero hace que lo demás sea más fácil y seguro de cambiar)
18. ~~**Separar `main.js`** en módulos~~ ✅ hecho.
19. **Migrar a módulos ES** (después del 18).

**Escalabilidad** — ver la sección "Escalabilidad y solidez": ~~índice de la carpeta~~, ~~vigilar la carpeta~~ y ~~disco asíncrono~~ hechos (2026-09-29): una carpeta con miles de notas ya no congela MK.

**Consolidación** — ver la sección "Consolidación" (revisiones externas): ~~validación de rutas~~, ~~CSP~~, ~~sandbox~~ y ~~registro de errores~~ hechos (2026-09-29); quedan agrupar escrituras de bases de datos, pruebas unitarias, accesibilidad y dividir archivos grandes.

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
- [x] ~~**Optimización medida**: arranque −30 % (~1150 → ~800 ms), memoria JS −47 % (32 → 17 MB, librerías grandes bajo demanda), render con fórmulas −67 % (184 → 61 ms, caché de KaTeX y fórmulas después de DOMPurify), preview oculto sin redibujar, ESLint 63 → 0 warnings~~ (2026-09-29)
- [x] ~~**Fotos, video y audio de cualquier formato común** (visor único, audio embebido `![[x.mp3]]`, adelantar en archivos largos con pedidos por rango, "Abrir con la aplicación del sistema" para lo que no se puede mostrar)~~ (2026-09-29)
- [x] ~~**Gráficos desde tablas Markdown** (bloque `chart`: barras, líneas, torta; preview, Live Preview y export)~~ (2026-09-29)
- [x] ~~**Bases de datos dentro de una nota** (bloque `database`: base, vista con sus filtros o gráfico, filas; botón Abrir; preview y Live Preview)~~ (2026-09-29)
- [x] ~~**Nota diaria configurable** (carpeta, formato AAAA/AA/MM/DD con subcarpetas y plantilla, en Ajustes)~~ (2026-09-29)
- [x] ~~**Terminal: pantalla dividida** (◫ / Ctrl+Shift+5, hasta 4 shells lado a lado por pestaña, cerrar un panel o la pestaña)~~ (2026-09-29)
- [x] ~~**Vigilar la carpeta** (`fs.watch` por carpeta, sin ocultas ni node_modules, tope 3000: el árbol y las pestañas abiertas se actualizan solos)~~ (2026-09-29)
- [x] ~~**Disco asíncrono en el proceso principal** (árbol en paralelo, leer/guardar, backups con poda en segundo plano, búsqueda/etiquetas/backlinks/grafo/Kanban leyendo de a 16, wikilinks, bytes de PDF/docx; el árbol de MK+node_modules pasa de 249 ms bloqueando a 110 ms sin bloquear. Quedan `…Sync` solo en config, diálogos y exportar)~~ (2026-09-29)
- [x] ~~**Índice de la carpeta** (`src/folderindex.js`: lista y contenido en memoria, se relee solo lo que avisa el vigilante o lo que guarda MK; búsqueda/etiquetas/backlinks/grafo/Kanban/tareas del Home sobre 3000 notas: 159 ms la primera vez → 7 ms)~~ (2026-09-29)
- [x] ~~**Aviso automático "1 semana antes"** (tareas del Home, 📅 de notas y fechas de bases de datos; interruptor y hora en el Home; "+ 1 semana antes" en el editor de avisos)~~ (2026-09-29)
- [x] ~~**Terminal: elegir el shell** (⚙ Ajustes o menú ▾; lista de /etc/shells + PATH, validada en el proceso principal)~~ (2026-09-29)
- [ ] **Índice guardado en `.mk/index`** para que la primera consulta tras abrir MK también sea rápida (y etiquetas/enlaces precalculados en el índice, no solo el texto)

## Pedidos nuevos (2026-09-30)

- [x] ~~**Toolbar: botones solo ícono / con texto** y ocultar la barra superior~~ (Ajustes → Apariencia; `Ctrl+Shift+M`) (2026-09-30)
- [x] ~~**Rediseño de ⚙ Ajustes** en un panel con secciones y buscador~~ (`Ctrl+,`; 7 secciones, búsqueda sin tildes, interruptores, teclado) (2026-09-30)
- [x] ~~**Botón de modo que muestra el modo actual**~~ (ícono + nombre) (2026-09-30)
- [x] ~~**Mascota virtual**~~ (3 especies propias × 3 etapas en SVG, camina, pelota, comida, se duerme; o **imágenes propias** por etapa) (2026-09-30)
- [x] ~~**Mascota que evoluciona con tareas y Pomodoros**~~ (+10 por tarea sin duplicar, +25 por Pomodoro, evoluciona en nivel 5 y 10, triste con atrasadas) (2026-09-30)
- [x] ~~**Mascota con personajes de un juego RPG Maker**~~ (carpeta `Graphics/Characters` detectada sola, líneas evolutivas desde `PBS/pokemon.txt` con ramas, caminata animada por dirección; se copian solo 3 sprites a la config local) (2026-09-30)
- [x] ~~**Varias mascotas: equipo, huevos y legendarias**~~ (equipo de 3, colección, huevo por cada evolución, 4 logros → huevos legendarios, 7 líneas + 4 legendarias de MK o criaturas y legendarios del juego, ocultas siguen ganando, migración de la mascota anterior) (2026-09-30)
- [x] ~~**Más lenguajes: F5 y resaltado**~~ (F5 para TS, Rust, PHP, Perl, Lua, R, Julia, Haskell, Dart, Swift, Kotlin, zsh, fish, PowerShell, SQL, HTML y Makefile; resaltado de ~25 lenguajes más cargado al abrir) (2026-09-30)
- [x] ~~**Mascota: XP por filas de bases de datos marcadas como hechas**~~ (cualquier casilla tildada, en la base, en el bloque o desde el aviso; una vez por fila y día) (2026-09-30)
- [x] ~~**Categorías en tareas del Home**~~ (`@categoría` al agregar, chip de color, filtro que heredan las nuevas, administrador con color) (2026-09-30) — *las estadísticas por categoría y el vínculo con las mascotas se probaron y se quitaron a pedido: más simple*

## Ideas de `MEJORAS_PROPUESTAS.md` (Gemini)

Revisado el 2026-09-30. Lo que ya estaba hecho o repetido queda anotado; lo nuevo, como objetivo.

**Ya hechas (ver Consolidación):** CSP estricta, `sandbox: true`, validación de rutas en el proceso principal, avisos + registro de errores. **Ya estaban en la lista:** SQLite nativo / agrupar escrituras, dividir CSS y archivos grandes, módulos ES, accesibilidad ARIA + teclado, editar texto de PDFs, sincronización entre dispositivos (P2P ≈ "Sincronización" de largo plazo).

**Estética (UI/UX)**
- [x] ~~**Sistema de diseño con tokens**~~ (2026-09-30: `--radius*`, `--shadow-1..3`, `--space-1..5`, `--font-xs..xl`, `--dur*`/`--ease` en `styles.css`; los usan Ajustes, la barra y lo nuevo — el resto de componentes se migra de a poco): escala tipográfica fija (H1–H6, cuerpo, notas), radios estándar (8px tarjetas, 4px botones) y sombras suaves en vez de bordes duros — base para el rediseño de Ajustes y los temas
- [x] ~~**Micro-interacciones**~~ (2026-09-30: menús, diálogos, avisos, hover y destello al guardar; respeta "reducir movimiento"): abrir/cerrar sidebar y panel secundario, cambio a Live Preview, hover de la toolbar, destello sutil al guardar. Respetando "reducir movimiento" del sistema
- [x] ~~**Indicador de cambios sin guardar en el sidebar**~~ (2026-09-30) (punto de color junto al archivo, no solo en la pestaña)
- [x] ~~**Barra de estado más útil**~~ (guardado / sin guardar / cambió afuera, rama de git con clic a commits, palabras y caracteres de la selección) (2026-09-30)
- [x] ~~**Contraste suficiente en todos los temas**~~ (13 temas corregidos en el texto secundario y ayu-light en el acento; prueba automática WCAG AA) (2026-09-30)

**Funciones**
- [x] ~~**Bloque `database` editable**~~ (texto, número, fecha, selección y casillas en el lugar, con teclado; se redibuja respetando filtros) (2026-09-30)
- [x] ~~**Grafo interactivo**~~ (clic derecho: abrir, panel secundario, backlinks, solo vecinas; filtros por etiqueta, carpeta y sin enlaces; buscar; resaltar vecinas; tamaño por enlaces; también cuenta links Markdown `[x](otra.md)`) (2026-09-30)
- [x] ~~**Desactivar módulos que no uses**~~ (Ajustes → Módulos: 9 módulos; se ocultan de la barra, la paleta y los menús y sus atajos se frenan, sin borrar datos) (2026-09-30)
- [x] ~~**Dashboards / widgets en notas**~~ (bloque `widget`: tareas hoy/semana/atrasadas tildables, progreso, total/promedio/cuenta de una base, mascotas; preview y Live Preview) (2026-09-30)
- [x] ~~**Botones de script en una nota**~~ (bloque `run` con título opcional; en la carpeta de la nota; confirmación con el comando exacto y confianza por nota + texto) (2026-09-30)
- [x] ~~**Explorador de multimedia**~~ (cuadrícula con miniaturas perezosas, filtros por tipo, búsqueda, abrir e insertar en la nota) (2026-09-30) — *falta: etiquetas propias para la multimedia*
- *Descartado por ahora:* indexar en Rust/C++ — el índice en memoria ya da búsquedas de ~7 ms en 3000 notas; se revisa si hiciera falta.

## Consolidación (revisión externa, `REVISION_APLICACION.md`)

La revisión concluye —y coincido— que ahora toca **consolidar más que añadir**. Verificado en el código el 2026-09-29.

**Prioridad alta**
- [x] ~~**Bases de datos: guardado atómico**~~ (temporal + fsync + rename: un corte a mitad ya no deja el `.sqlite3` truncado) (2026-09-29)
- [x] ~~**Validación de rutas central en el proceso principal**~~ (`pathguard.js`: solo lo que el usuario abrió — carpeta, diálogos, arrastrar desde el sistema, argumentos, sesión; leer/guardar/crear/mover/borrar, `md-local://`, bases de datos, git, Home, búsqueda y exportar lo validan; intentos rechazados al log. Límite: la terminal integrada puede todo, la barrera contra una ventana comprometida es CSP + sandbox) (2026-09-29)
- [x] ~~**Content Security Policy estricta** en `index.html`~~ (scripts solo archivos locales, nada inline; sin conexiones a internet; `'unsafe-eval'` solo por las fórmulas — pasarlas a un Worker lo quitaría. `cspwatch.js` + un test que falla ante cualquier violación) (2026-09-29)
- [x] ~~**Activar `sandbox: true`**~~ (rutas con un helper POSIX propio en el preload, comparado con Node en un test; highlight.js en el proceso principal, asíncrono; exportar espera el resaltado) (2026-09-29)
- [x] ~~**Registro local de errores**~~ (`userData/logs/mk.log` rotativo; guardar notas, Home y bases de datos avisan en pantalla si fallan; errores de JS no capturados al log; config/sesión/Home con escritura atómica y un JSON dañado se aparta en vez de pisarse) (2026-09-29)
- [x] ~~**Revisar el resto de `catch` silenciosos**~~ (exportar CSV/PDF/Word/HTML/EPUB/Anki avisa si falla; abrir PDF/docx dañados queda en el log; la ventana que imprime el PDF ahora con sandbox y sin JavaScript) (2026-09-30)
- [x] ~~**Bases de datos: agrupar escrituras**~~ (una escritura atómica 300 ms después del último cambio, y al salir; 30 cambios → 1 escritura) (2026-09-30)

**Prioridad media**
- [ ] **Dividir `database.js` (~2200 líneas), `home.js` (~1800) y `styles.css` (~4400)** por responsabilidad (va junto con la migración a módulos ES)
- [x] ~~**Pruebas unitarias rápidas**~~ (`npm run test:unit`, node:test, 23 pruebas en ~0,3 s, también en CI: fechas/recurrencias, tareas 📅, @categoría, CSV, gráficos, rutas, JSON atómico, índice, catálogo del juego; lógica compartida en `src/shared/`) (2026-09-30) — *faltan pruebas visuales*
- [x] ~~**Accesibilidad**: roles y etiquetas ARIA; navegación con teclado~~ (botones de ícono con nombre, pestañas y árbol con roles y flechas, diálogos que atrapan y devuelven el foco, menús con teclado, foco visible) (2026-09-30) — *falta probar con un lector de pantalla real (Orca)*
- [ ] **Quitar los `…Sync` que quedan** en el proceso principal (exportar, config, sesión, Home)

**Prioridad baja**
- [ ] **Versionado semántico y CHANGELOG** (hoy `package.json` sigue en 1.0.0)
- [ ] **Documentación sin cifras volátiles** (README ya corregido; revisar el resto)
- [ ] **Primer arranque guiado**: separar claramente escribir / planificar / herramientas avanzadas

## Corto plazo (próximas sesiones)

Mejoras chicas y de uso diario: se hacen en una sesión cada una. *(Todas hechas — ver "Prioridad recomendada" para lo que sigue.)*


## Escalabilidad y solidez

Lo que MK necesita para seguir andando rápido y sin sorpresas con **carpetas grandes** (miles de notas), **más datos** (años de tareas, bases de miles de filas) y **más funciones**. Basado en lo que hoy hace el código (medido el 2026-09-29).

### Carpetas grandes
- [ ] **Árbol del sidebar virtualizado y cargado por demanda**: hoy se lee la carpeta entera (recursivo) al abrirla; leer cada subcarpeta al desplegarla y dibujar solo las filas visibles
- [ ] **Búsqueda con índice y sin tope de 200**: resultados al instante, con filtros (carpeta, tipo, fecha) y búsqueda aproximada

### Datos que crecen
- [ ] **Bases de datos: guardar solo lo que cambió** (escrituras ya agrupadas el 2026-09-30; falta motor nativo con WAL para no reescribir el archivo entero): hoy cada edición reescribe el archivo SQLite **entero** (`db.export()`); agrupar escrituras (guardar cada ~1 s) o pasar a SQLite nativo con WAL
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
- [ ] **Migrar a módulos ES** (ver Mediano/Largo plazo; `main.js` ya está separado)
- [x] ~~**Una sola capa de acceso a archivos** con validación de rutas centralizada~~ (`pathguard.js`, 2026-09-29)
- [ ] **Tareas pesadas fuera de la ventana** (Web Workers / proceso aparte): parseo de la carpeta, grafo, CSV grandes, PDFs grandes
- [ ] **Traducciones (i18n)**: los textos están escritos en el código; sacarlos a archivos para poder tener MK en inglés u otros idiomas
- [ ] **Accesibilidad: probar con lector de pantalla** (Orca) — lo de teclado y ARIA ya está (ver Consolidación, 2026-09-30)

### Calidad
- [x] ~~**Tests unitarios rápidos** (node:test)~~ (ver Consolidación, 2026-09-30)
- [x] ~~**Registro de errores local**~~ (`logs/mk.log`, 2026-09-29)
- [ ] **Botón "Reportar un problema"** que arme el informe (versión, últimas líneas del log) sin datos personales
- [ ] **Pruebas visuales**: capturas de referencia de los paneles principales en claro/oscuro, para detectar diseño roto

### Seguridad
- [x] ~~**Content-Security-Policy** en la ventana~~ (2026-09-29)
- [x] ~~**`sandbox: true` en el renderer**~~ (2026-09-29)
- [ ] **Permisos de la terminal e IAs** documentados y visibles (qué carpeta ve cada una)

### Distribución
- [ ] **Versiones y CHANGELOG** (semver) y **releases automáticos** del AppImage en GitHub Actions
- [ ] **Actualización automática** del AppImage (avisar cuando hay versión nueva y actualizar con un clic)

## Mediano plazo

Funciones más grandes o que tocan varias partes de la app.

- [x] ~~**Recordatorios por Gmail**~~: además de la notificación local, mandar un correo a tu Gmail con los mismos avisos — del mismo día y anticipados ("faltan N días"), a la hora que elijas — para tareas del Home y filas de bases de datos con fecha. El asunto dice qué y cuándo (*"Faltan 3 días: Entregar TP — vie 3 oct, 18:30"*) y el cuerpo trae día, hora, notas y de dónde sale (Home, nota o base de datos). Configuración en Ajustes con tu dirección y una **contraseña de aplicación** de Google (SMTP), guardada cifrada con el llavero del sistema (`safeStorage`), nunca en texto plano. Opcional y apagado por defecto: es la única función que necesita internet (hecho 2026-09-30)
- [x] ~~**Resumen diario por Gmail**~~: un correo cada mañana con el plan del día (tareas, atrasadas y fechas de bases de datos), a la hora que elijas (hecho 2026-09-30)
- [x] ~~**Separar `main.js`** (más de 1100 líneas) en módulos por área~~ (2026-09-29: queda en ~340 líneas; `ipc-files`, `ipc-notes`, `ipc-export`, `ipc-system`, `mainctx`, `folderwatch`, `folderindex`)

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
