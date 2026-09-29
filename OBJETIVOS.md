# Objetivos y mejoras de MK

Hoja de ruta de la aplicación, de corto a largo plazo. Cada objetivo se **tacha** (`- [x] ~~así~~`) cuando se termina, con la fecha.

> Truco: este archivo es también un tablero. Abrilo en MK → paleta (`Ctrl+Shift+P`) → **"Ver tablero Kanban"**: cada `##` es una columna y cada objetivo una tarjeta.

**Estado:** 28 de 48 objetivos cumplidos · última actualización 2026-09-29.

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

## Corto plazo (próximas sesiones)

Mejoras chicas y de uso diario: se hacen en una sesión cada una.

- [ ] **Home: mover una tarea a "mañana"** con un clic (botón en el editor de tarea y en las atrasadas)
- [ ] **Bases de datos: ordenar por varias columnas** (ej. Estado y después Fecha)
- [ ] **Terminal: renombrar una pestaña** con doble clic (ej. "servidor", "git")
- [ ] **Sidebar: "Copiar ruta"** en el menú contextual de un archivo

## Mediano plazo

Funciones más grandes o que tocan varias partes de la app.

- [ ] **Modo "Live Preview" (escribir en modo lectura)**: editar el `.md` viéndolo renderizado — solo la línea (o bloque) donde está el cursor muestra la sintaxis Markdown para escribir, todo lo demás se ve como en modo lectura (encabezados grandes, negrita, listas, imágenes, tablas), igual que Obsidian. Pedido del usuario.
- [ ] **Bases de datos dentro de una nota**: bloque ```` ```database Proyectos ```` ```` que muestra la tabla en el preview
- [ ] **Home dentro de la carpeta (opcional)**: guardar las tareas en `.mk/home.json` para que viajen con git y se sincronicen entre computadoras
- [ ] **Home: estadísticas**: tareas hechas por semana, racha de hábitos recurrentes, gráfico del mes
- [ ] **Recordatorios con la app cerrada**: mini-servicio en la bandeja del sistema (tray) que sigue avisando
- [ ] **Terminal: pantalla dividida** (dos terminales visibles lado a lado)
- [ ] **Búsqueda global también en bases de datos y tareas del Home**
- [ ] **Separar `main.js`** (más de 1100 líneas) en módulos por área, como ya se hizo con `dbengine.js` y `ptyhost.js`
- [ ] **Actualizar el aviso de vulnerabilidades de `npm audit`** (2 de severidad alta en dependencias)

## Largo plazo

Proyectos pesados o que requieren decisiones de diseño/seguridad antes de empezar (ver `MEJORAS.md`).

- [ ] **Pizarra Excalidraw** embebida para dibujar diagramas a mano
- [ ] **Sistema de plugins** seguro (scripts locales con API limitada, revisados antes de habilitarse)
- [ ] **Ejecutar Python y otros lenguajes** dentro de los bloques de código del preview (hoy solo JS)
- [ ] **Dos editores escribibles a la vez** en pantalla dividida (hoy el panel secundario es de solo lectura)
- [ ] **Sincronización entre dispositivos** sin depender de git (carpeta en la nube / servidor propio)
- [ ] **Versión para Windows y macOS** (hoy el empaquetado y el reproductor multimedia son solo Linux)
- [ ] **Editar el texto dentro de un PDF** (hoy solo operaciones de página y subrayado)

---

## Cómo se mantiene este archivo

1. Al terminar un objetivo: cambiar `- [ ]` por `- [x]`, tacharlo con `~~…~~`, agregar la fecha y moverlo a **Hecho recientemente**.
2. Actualizar el contador de **Estado** de arriba.
3. Ideas nuevas: agregarlas a la sección que corresponda según tamaño (corto = una sesión; mediano = varias; largo = requiere diseño previo).
