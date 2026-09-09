# MK — Editor de Markdown Local

App de escritorio (Electron) para editar Markdown y LaTeX en local, sin internet, sin cuenta y sin depender de servicios externos.

## Qué hace

- Editor (CodeMirror) + preview en vivo, con pestañas, autoguardado y restauración de sesión.
- Markdown con imágenes/vídeos/PDF embebidos, tablas, callouts, resaltado de código, y LaTeX (`$...$` / `$$...$$` vía KaTeX, archivos `.tex` con su propio modo de resaltado).
- Etiquetas `#tag` y wikilinks `[[Nota]]` con backlinks — navegar y organizar notas dentro de una carpeta.
- Sidebar de carpetas con icono personalizable por archivo (buscador sobre los iconos de [lucide](https://lucide.dev)).
- Command Palette (`Ctrl+Shift+P`), búsqueda global en la carpeta (`Ctrl+Shift+F`) y autocompletado en el editor.
- 26 temas de color, exportar a HTML/PDF, vista de cambios contra el último guardado.
- Menú contextual del editor, drag & drop de assets, abrir MK con doble clic en un `.md`/`.tex`.

Ver [`ESTADO.md`](./ESTADO.md) para el detalle completo de lo hecho, lo pendiente y las limitaciones conocidas. Ver [`MEJORAS.md`](./MEJORAS.md) para ideas de qué mejorar a futuro.

## Cómo correrla

```bash
npm install
npm start
```

## Atajos principales

| Atajo | Acción |
|---|---|
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
npm test
```

Correr esto antes de tocar algo grande — cubre bugs reales que ya pasaron en este proyecto (guardado multi-pestaña, dropdowns que ignoraban `[hidden]`, etc.).

## Empaquetar (AppImage)

```bash
npm run dist
```

Genera `dist/MK-<version>.AppImage`, standalone (incluye Electron + dependencias).

## Stack

Electron 32 · CodeMirror 5 · marked · KaTeX · DOMPurify · highlight.js · lucide.

## Estructura

```
MK/
├── src/
│   ├── main.js        # proceso principal: ventana, IPC, protocolo md-local://, búsqueda/tags/backlinks
│   ├── preload.js      # bridge seguro (contextIsolation) → window.mdEditor
│   ├── index.html      # carga las libs + todos los scripts del renderer
│   └── *.js             # un archivo por feature, cada uno en su propia IIFE
├── test/
│   ├── run.js            # arranca Electron con MK_TEST=1 y perfil aislado
│   └── renderer-checks.js # los checks en sí, corren dentro de la ventana
├── package.json
├── ESTADO.md            # estado real y detallado del proyecto
└── MEJORAS.md            # qué mejoraría a futuro
```

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`.
- `sandbox: false` en el `BrowserWindow` — necesario para que `preload.js` use `require('path')`/`highlight.js`/`clipboard`.
- Assets locales se sirven vía protocolo custom `md-local://` (no `webSecurity: false`).
- Con una carpeta abierta, las rutas de assets no pueden escapar de ella (bloquea `../../etc/passwd` y similares).
