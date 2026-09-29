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

### Un segundo archivo al lado (split view)
El **panel secundario** muestra un segundo archivo (Markdown, PDF, `.docx` o imagen) de solo lectura junto al principal, del mismo ancho y con su propio divisor para repartir el espacio. Un clic en el título lo "promueve" a principal — sin necesidad de una segunda instancia del editor.

### Word y PDF
Abrir un `.docx` lo convierte a Markdown editable al vuelo (con tablas), y se puede exportar de vuelta a un `.docx` real. Del lado de PDF: unir, separar, rotar, reordenar páginas, agregar marca de agua o firma, y subrayar texto arrastrando el mouse. Exportar notas a PDF, HTML, EPUB o tarjetas de Anki.

### Herramientas integradas
Todo esto viene ya armado en la app, no son plugins de terceros:
- Tablero **Kanban** (por archivo o por carpeta completa) armado a partir de encabezados y listas.
- Diagramas **Mermaid**, incluso con imágenes propias adentro de los nodos.
- Ejecutar bloques de código JavaScript en un Web Worker aislado (sin acceso a tus archivos).
- Sincronización con **git** al guardar, automática o eligiendo a mano qué archivos entran en cada commit.
- Nota diaria, snippets de texto (`/fecha`, `/hora` y los tuyos propios) y plantillas con variables.
- Historial de versiones local con diff y vista de cambios sin guardar.
- Corrector ortográfico nativo, con sugerencias por clic derecho.
- Temporizador **Pomodoro** con notificación de fin de fase, minutos configurables.
- Controlar el reproductor multimedia del sistema (play/pausa/siguiente) vía `playerctl` — solo Linux.
- Editar tablas Markdown ya escritas: agregar fila/columna o alinear, desde el menú contextual.

### Personalización
26 temas de color, tipografía y tamaño de fuente del editor (con zoom rápido por `Ctrl+scroll`), ancho de tabulación, autoguardado configurable, y modo enfoque/lectura para escribir sin distracciones. Los botones de la toolbar que no uses se pueden ocultar desde ⚙ Ajustes (y ejecutar desde ahí igual, sin tener que mostrarlos primero).

## Documentación

| Archivo | Para qué sirve |
|---|---|
| [`MANUAL.md`](./MANUAL.md) | Guía completa: cómo usar cada función, paso a paso |
| [`Guias/`](./Guias/README.md) | Una guía especializada por función: cómo usarla y para qué sirve (Home y Bases de datos con dos guías cada una) |
| [`COMANDOS.md`](./COMANDOS.md) | Referencia rápida de todos los atajos de teclado |
| [`ESTADO.md`](./ESTADO.md) | Qué está hecho, qué falta, y limitaciones conocidas |
| [`OBJETIVOS.md`](./OBJETIVOS.md) | Hoja de ruta: objetivos de corto, mediano y largo plazo, tachados a medida que se cumplen |
| [`MEJORAS.md`](./MEJORAS.md) | Ideas de qué mejorar a futuro |

## Cómo correrla

```bash
npm install
npm start
```

## Tests

Suite de humo que lanza la app real en un perfil aislado y corre checks dentro de la ventana (nada de mocks):

```bash
npm test        # suite completa (Electron real + perfil aislado)
npm run lint     # ESLint (no-undef/no-unused-vars)
```

Correr esto antes de tocar algo grande — cubre bugs reales que ya pasaron en este proyecto (guardado multi-pestaña, dropdowns que ignoraban `[hidden]`, etc.). Se corre solo en cada push/PR vía [GitHub Actions](.github/workflows/ci.yml).

## Empaquetar (AppImage)

```bash
npm run dist
```

Genera `dist/MK-<version>.AppImage`, standalone (incluye Electron + dependencias).

## Stack

Electron 32 · CodeMirror 5 · marked · KaTeX · DOMPurify · highlight.js · lucide · mermaid · diff (Myers) · jszip.

Word/PDF: `mammoth` + `turndown` (leer `.docx`), `docx` (escribir `.docx`), `pdf-lib` (operaciones de página), `pdfjs-dist` (render de PDF para subrayar).

Todo se carga como `<script>` suelto desde `node_modules` (sin bundler, sin webpack/vite) — cada librería expone su propio global (`marked`, `mammoth`, `docx`, etc.).

## Estructura

```
MK/
├── src/
│   ├── main.js         # proceso principal: ventana, IPC, protocolo md-local://, búsqueda/tags/backlinks, git, PDF/docx
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
├── COMANDOS.md           # referencia rápida de atajos
├── ESTADO.md             # estado real y detallado del proyecto
└── MEJORAS.md             # qué mejoraría a futuro
```

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`.
- `sandbox: false` en el `BrowserWindow` — necesario para que `preload.js` use `require('path')`/`highlight.js`/`clipboard`.
- Assets locales se sirven vía protocolo custom `md-local://` (no `webSecurity: false`).
- Con una carpeta abierta, las rutas de assets no pueden escapar de ella (bloquea `../../etc/passwd` y similares).
