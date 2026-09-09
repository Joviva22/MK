# MK — Editor de Markdown Local

App de escritorio (Electron) para editar Markdown y LaTeX en local, sin internet, sin cuenta y sin depender de servicios externos.

## Qué hace

**Edición y organización**
- Editor (CodeMirror) + preview en vivo, con pestañas, autoguardado y restauración de sesión.
- Markdown con imágenes/vídeos/PDF embebidos, tablas, callouts, resaltado de código, subrayado (`==texto==`), y LaTeX (`$...$` / `$$...$$` vía KaTeX, archivos `.tex` con su propio modo de resaltado).
- Etiquetas `#tag` y wikilinks `[[Nota]]` con backlinks — navegar y organizar notas dentro de una carpeta.
- Sidebar de carpetas con icono personalizable por archivo, selección múltiple (Ctrl+clic) para mover/eliminar en bloque.
- **Panel secundario (split view)**: un segundo archivo (md/PDF/`.docx`/imagen) de solo lectura al lado del principal — clic en el título lo promueve a principal.
- Historial de versiones local con diff, vista de cambios sin guardar, corrector ortográfico con sugerencias.

**Word y PDF**
- Abrir `.docx`: se convierte a Markdown editable (mammoth + turndown), con tablas GFM. Exportar de vuelta a `.docx` real (librería `docx`).
- Operaciones de páginas PDF: unir, separar, rotar, reordenar, marca de agua, texto/firma (`pdf-lib`).
- Subrayar texto en PDF (arrastrar el mouse) y exportar a PDF/HTML/EPUB/tarjetas Anki.

**Herramientas integradas** (no plugins de terceros, todo built-in)
- Tablero Kanban (por archivo o carpeta completa), grafo de notas interactivo (zoom/pan/arrastrar nodos, posiciones persistidas), diagramas Mermaid (incluso con imágenes en los nodos), ejecutar bloques de código JS en un Web Worker aislado.
- Sincronización con git al guardar, o con control fino (elegir archivos + mensaje propio).
- Nota diaria, snippets de texto, plantillas con variables.
- Command Palette (`Ctrl+Shift+P`), búsqueda global (`Ctrl+Shift+F`), autocompletado.
- 26 temas de color.

Ver [`MANUAL.md`](./MANUAL.md) para la guía de uso completa (cómo usar cada función, paso a paso). Ver [`ESTADO.md`](./ESTADO.md) para el detalle completo de lo hecho, lo pendiente y las limitaciones conocidas. Ver [`MEJORAS.md`](./MEJORAS.md) para ideas de qué mejorar a futuro.

## Cómo correrla

```bash
npm install
npm start
```

## Atajos principales

| Atajo | Acción |
|---|---|
| `Ctrl+B` | Ocultar/mostrar el sidebar |
| `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` | Nuevo / Abrir / Guardar / Guardar como |
| `Ctrl+W` / `Ctrl+Tab` | Cerrar pestaña / ciclar pestañas |
| `Ctrl+Shift+P` | Paleta de comandos |
| `Ctrl+Shift+F` | Búsqueda global en la carpeta abierta |
| `Ctrl+Shift+T` | Etiquetas de la carpeta |
| `Ctrl+Shift+B` | Backlinks del archivo activo |
| `Ctrl+Shift+O` | Índice del documento |
| `Ctrl+Shift+E` / `Ctrl+Shift+R` | Modo enfoque / modo lectura |
| `Ctrl+Space` | Autocompletado |

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
├── .github/workflows/ci.yml # lint + test en cada push/PR
├── package.json
├── MANUAL.md             # guía de uso completa
├── ESTADO.md             # estado real y detallado del proyecto
└── MEJORAS.md             # qué mejoraría a futuro
```

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`.
- `sandbox: false` en el `BrowserWindow` — necesario para que `preload.js` use `require('path')`/`highlight.js`/`clipboard`.
- Assets locales se sirven vía protocolo custom `md-local://` (no `webSecurity: false`).
- Con una carpeta abierta, las rutas de assets no pueden escapar de ella (bloquea `../../etc/passwd` y similares).
