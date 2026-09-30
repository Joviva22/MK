# MK — Editor de Markdown Local

App de escritorio (Electron) para escribir y organizar notas en Markdown y LaTeX, guardadas como archivos de texto normales en tu disco — sin cuenta, sin nube, sin conexión a internet. Todo lo que hace corre local: nada de lo que escribís sale de tu computadora.

## Por qué existe

La idea es simple: un editor que se sienta como una app de notas moderna (pestañas, preview en vivo, búsqueda, temas, atajos) pero que por dentro sea texto plano de toda la vida — tus notas siguen siendo `.md` normales, abribles con cualquier otro editor, versionables con git, sin formato propietario ni base de datos oculta.

## Qué podés hacer

### Escribir y organizar
Editor (CodeMirror) con preview en vivo al lado, pestañas con autoguardado, y restauración de sesión si cerrás con cambios sin guardar. Markdown completo: imágenes/vídeos/PDF embebidos, tablas, callouts, subrayado (`==texto==`) y fórmulas con LaTeX (`$...$` / `$$...$$` vía KaTeX). El sidebar de carpetas deja poner un ícono propio por archivo y seleccionar varios a la vez (`Ctrl+clic`) para mover o eliminar en bloque. Etiquetas `#tag` y wikilinks `[[Nota]]` con backlinks para enlazar notas entre sí, más un grafo interactivo para verlas todas conectadas.

También se pueden abrir y editar archivos de código (`.py`, `.c`/`.cpp`, `.java`, `.sh`) con resaltado de sintaxis propio para cada lenguaje — el preview (que renderiza Markdown) se oculta solo en esos casos, no tiene sentido ahí.

### Buscar y moverte rápido
`Ctrl+F` busca y reemplaza dentro del archivo actual; `Ctrl+Shift+F` busca en toda la carpeta abierta; `Ctrl+P` abre un archivo por nombre sin tocar el mouse. Paleta de comandos (`Ctrl+Shift+P`) para no memorizar dónde está cada botón. Ver [`COMANDOS.md`](./COMANDOS.md) para la lista completa de atajos.

### Planificar: Home, bases de datos y gráficos
- **Home** (`Ctrl+Shift+H`): planificador semanal y mensual con calendario, tareas con hora y prioridad, recurrentes (hábitos), arrastrar tareas de día, tareas `📅` escritas en tus notas, estadísticas 📈 y **recordatorios** (a la hora, días antes y **1 semana antes automático** para todo lo que tenga fecha, aunque MK esté en la bandeja), también **por correo (Gmail)** con resumen diario opcional.
- **Bases de datos** relacionales tipo Notion (tabla, tablero, calendario, galería y **Gráfico**), guardadas en `.mk/` dentro de tu carpeta, con importar/exportar CSV.
- **Gráficos**: vista Gráfico de una base, bloque ```` ```chart ```` que dibuja una tabla Markdown, y bloque ```` ```database ```` que muestra una vista de una base **dentro de una nota**.

### Mascotas
Un equipo de criaturas que camina al pie de la ventana y **evoluciona** con cada tarea que tildás y cada Pomodoro que terminás; cada evolución deja un **huevo** con una criatura nueva y los logros dan **legendarias**. Criaturas propias de MK, personajes de un juego de RPG Maker o tus imágenes.

### Terminal e IA
Terminal real integrada (`` Ctrl+` ``) con el shell que elijas (bash, zsh, fish…), pestañas, **pantalla dividida** (`Ctrl+Shift+5`), búsqueda en la salida y **F5** para ejecutar el archivo actual (`.py`, `.c`, `.js`, `.sh`…). **Abrir con IA**: Claude Code, Gemini CLI o Codex arrancan en la terminal con el archivo como contexto.

### Carpetas grandes
La carpeta abierta **se vigila sola** (lo que cambie git, otra app o una IA aparece en el árbol y en las pestañas sin refrescar), el disco se lee sin congelar la ventana y un **índice en memoria** hace que búsqueda, etiquetas, backlinks, grafo y Kanban no relean todo cada vez: la primera consulta lee la carpeta y las siguientes son casi instantáneas.

### Un segundo archivo al lado (split view)
El **panel secundario** muestra un segundo archivo (Markdown, PDF, `.docx` o imagen) de solo lectura junto al principal, del mismo ancho y con su propio divisor para repartir el espacio. Un clic en el título lo "promueve" a principal — sin necesidad de una segunda instancia del editor.

### Word y PDF
Abrir un `.docx` lo convierte a Markdown editable al vuelo (con tablas), y se puede exportar de vuelta a un `.docx` real. Del lado de PDF: **escribir encima y rellenar formularios**, unir, separar, rotar, reordenar páginas, agregar marca de agua o firma, y subrayar texto arrastrando el mouse. Fotos, video y audio de cualquier formato común se abren con su visor (y los que Chromium no reproduce ofrecen la app del sistema). Exportar notas a PDF, HTML, EPUB o tarjetas de Anki.

### Herramientas integradas
Todo esto viene ya armado en la app, no son plugins de terceros:
- Tablero **Kanban** (por archivo o por carpeta completa) armado a partir de encabezados y listas.
- Diagramas **Mermaid**, incluso con imágenes propias adentro de los nodos.
- Ejecutar bloques de código JavaScript en un Web Worker aislado (sin acceso a tus archivos).
- Sincronización con **git** al guardar, automática o eligiendo a mano qué archivos entran en cada commit.
- Nota diaria (`Ctrl+Shift+D`) con carpeta, formato del nombre y plantilla configurables; snippets de texto (`/fecha`, `/hora` y los tuyos propios) y plantillas con variables.
- Historial de versiones local con diff y vista de cambios sin guardar.
- Corrector ortográfico nativo, con sugerencias por clic derecho.
- Temporizador **Pomodoro** con notificación de fin de fase, minutos configurables.
- Controlar el reproductor multimedia del sistema (play/pausa/siguiente) vía `playerctl` — solo Linux.
- Editar tablas Markdown ya escritas: agregar fila/columna o alinear, desde el menú contextual.

### Personalización
27 temas de color (incluido uno de Kingdom Hearts), tipografía y tamaño de fuente del editor (con zoom rápido por `Ctrl+scroll`), ancho de tabulación, autoguardado configurable, y cuatro modos de vista: normal, enfoque, lectura y **Live Preview** (el Markdown se ve renderizado mientras escribís, salvo en la línea del cursor). Al cerrar la ventana MK puede quedar en la bandeja (para que suenen los recordatorios) y arrancar con el sistema. ⚙ Ajustes (`Ctrl+,`) es un panel con secciones y buscador; la barra superior puede ir **solo con íconos**, con texto o mixta, u **ocultarse** hasta acercar el mouse, y los botones que no uses se esconden (y se ejecutan igual desde Ajustes).

## Documentación

| Archivo | Para qué sirve |
|---|---|
| [`MANUAL.md`](./MANUAL.md) | Guía completa: cómo usar cada función, paso a paso |
| [`Guias/`](./Guias/README.md) | Una guía especializada por función: cómo usarla y para qué sirve (Home y Bases de datos con dos guías cada una) |
| [`COMANDOS.md`](./COMANDOS.md) | Referencia rápida de todos los atajos de teclado |
| [`OBJETIVOS.md`](./OBJETIVOS.md) | Hoja de ruta: qué está hecho y qué falta (corto, mediano y largo plazo), tachado a medida que se cumple |

## Cómo correrla

```bash
npm install
npm start
```

## Tests

Suite de humo que lanza la app real en un perfil aislado y corre checks dentro de la ventana (nada de mocks):

```bash
npm run test:unit  # pruebas unitarias (Node, sin Electron, menos de 1 s): fechas y recurrencias del Home,
                   # tareas 📅 de notas, CSV, gráficos, rutas autorizadas, JSON atómico, índice, catálogo de mascotas
npm test           # suite completa (Electron real + perfil aislado)
npm run lint       # ESLint (no-undef/no-unused-vars)
npm run bench      # rendimiento: arranque, carpeta de 3000 notas, nota de 5000 líneas
```

`npm run bench` genera una carpeta y una nota grandes, las mide con la app real y compara con `test/bench-baseline.json` (marca ⚠ lo que empeoró más de un 30 %). `npm run bench -- --save` guarda la medición como referencia nueva; `-- --strict` sale con error si algo empeoró. Los tiempos dependen de la máquina: sirve para comparar antes y después de un cambio en la misma computadora.

La lógica pura compartida entre la ventana y las pruebas vive en `src/shared/` (se carga como `<script>` y también con `require`).

Correr esto antes de tocar algo grande — cubre bugs reales que ya pasaron en este proyecto (guardado multi-pestaña, dropdowns que ignoraban `[hidden]`, etc.). Se corre solo en cada push/PR vía [GitHub Actions](.github/workflows/ci.yml).

## Empaquetar (AppImage)

```bash
npm run dist
```

Genera `dist/MK-<version>.AppImage`, standalone (incluye Electron + dependencias).

## Versiones y releases

MK usa versionado semántico (`mayor.menor.parche`); los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md). La versión instalada se ve en **Ajustes → Sistema**, donde también se puede buscar una versión nueva (o activar el aviso al iniciar: viene apagado y es la única consulta a internet de MK aparte del correo; nunca descarga ni instala nada sola).

Para publicar una versión: escribir sus notas en `CHANGELOG.md` y

```bash
npm version menor        # o mayor / parche: sube package.json, hace commit y etiqueta vX.Y.Z
git push --follow-tags   # la etiqueta dispara .github/workflows/release.yml
```

El workflow corre lint y tests, compila el AppImage y crea la release en GitHub con las notas de esa versión del CHANGELOG.

## Instalar en tu usuario (menú de aplicaciones)

```bash
npm run dist && npm run install-desktop
```

Copia el AppImage a `~/.local/share/mk/MK.AppImage`, instala el ícono y el lanzador del menú (`~/.local/share/applications/mk-editor.desktop`, con copia `.bak` del anterior) y, si "Iniciar con el sistema" está activado, lo apunta ahí. Desde entonces MK no depende de la carpeta del proyecto. Para actualizar, repetir el mismo comando. Usa la misma carpeta de datos que `npm start` (`~/.config/md-editor-local`).

## Stack

Electron 44 · CodeMirror 5 · marked · KaTeX · DOMPurify · highlight.js · lucide · mermaid · diff (Myers) · jszip · sql.js (bases de datos) · xterm.js + node-pty (terminal).

Word/PDF: `mammoth` + `turndown` (leer `.docx`), `docx` (escribir `.docx`), `pdf-lib` (operaciones de página), `pdfjs-dist` (render de PDF para subrayar).

Todo se carga como `<script>` suelto desde `node_modules` (sin bundler, sin webpack/vite) — cada librería expone su propio global (`marked`, `mammoth`, `docx`, etc.). Las pesadas (Mermaid, docx, mammoth, xterm) se cargan recién cuando se usan (`src/lazyload.js`).

## Estructura

```
MK/
├── src/
│   ├── main.js         # proceso principal: arranque, ventana, config/sesión/Home, protocolo md-local://
│   ├── mainctx.js       # (main) estado compartido: ventana, config, modo test
│   ├── ipc-files.js     # (main) abrir/guardar, historial de versiones, árbol, crear/mover/borrar
│   ├── ipc-notes.js     # (main) búsqueda, etiquetas, wikilinks, backlinks, grafo, Kanban de carpeta
│   ├── ipc-export.js    # (main) CSV, PDF, docx, HTML, EPUB, Anki
│   ├── ipc-system.js    # (main) git y reproductor del sistema (playerctl)
│   ├── folderwatch.js   # (main) vigila la carpeta abierta con fs.watch
│   ├── folderindex.js   # (main) índice en memoria de las notas: solo se relee lo que cambió
│   ├── dbengine.js      # (main) bases de datos con sql.js en <carpeta>/.mk/
│   ├── ptyhost.js       # (main) pseudo-terminales (node-pty) de la terminal integrada
│   ├── traymode.js      # (main) bandeja del sistema y arranque con el sistema
│   ├── preload.js       # bridge seguro (contextIsolation) → window.mdEditor
│   ├── index.html       # carga las libs + todos los scripts del renderer
│   └── *.js              # un archivo por feature (kanban, graph, docximport, pdfpages, secondarypane, ...), cada uno en su propia IIFE
├── test/
│   ├── run.js             # arranca Electron con MK_TEST=1 y perfil aislado, arma los fixtures (incluye .docx reales)
│   └── renderer-checks.js  # los checks en sí, corren dentro de la ventana
├── Ejemplos/               # archivos de muestra para probar cada función en vivo
├── Guias/                  # guías especializadas por función (cómo usar / para qué sirve)
├── .github/workflows/ci.yml # lint + test en cada push/PR
├── package.json
├── OBJETIVOS.md          # hoja de ruta (se tacha lo cumplido)
├── MANUAL.md             # guía de uso completa
└── COMANDOS.md           # referencia rápida de atajos
```

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`.
- `sandbox: true`: el preload solo usa módulos de Electron (rutas con un helper propio; highlight.js y el portapapeles van por el proceso principal).
- Content Security Policy: solo scripts locales de MK, nada inline, sin conexiones a internet.
- Assets locales se sirven vía protocolo custom `md-local://` (no `webSecurity: false`).
- **Rutas validadas en el proceso principal** (`src/pathguard.js`): la ventana solo puede leer, escribir o borrar dentro de lo que el usuario abrió (la carpeta, archivos elegidos en diálogos, arrastrados o de la sesión). `md-local://` tampoco sirve archivos de afuera. Lo rechazado queda en `~/.config/md-editor-local/logs/mk.log`.
- Límite conocido: la terminal integrada ejecuta lo que sea; la defensa contra una ventana comprometida es la CSP + sandbox + DOMPurify.
