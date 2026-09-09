# Resumen — MK, Editor de Markdown Local

App de escritorio (Electron) para editar Markdown y LaTeX en local. Sin servidor, sin cuenta, sin conexión a internet.

## Qué es

Un editor tipo IDE liviano: sidebar de carpetas + editor (CodeMirror) + preview en vivo, pensado para notas personales con soporte real de imágenes/vídeo/PDF/LaTeX embebidos, y funciones de organización tipo Obsidian (etiquetas, wikilinks, backlinks) sin depender de ningún servicio externo.

## Funciones

**Editor y archivos**
- Pestañas múltiples, autoguardado configurable (por pestaña, no global), restauración de sesión al reabrir.
- Nuevo / Abrir / Guardar / Guardar como + plantillas (apuntes, documentación, trabajo universitario, README, fórmulas).
- Crear, renombrar y eliminar archivos/carpetas desde el sidebar (clic derecho).
- Sidebar de árbol de carpetas con icono por extensión (lucide) o icono personalizado por archivo (picker con buscador sobre ~1500 iconos).
- Drag & drop de imágenes/vídeo/PDF al editor (se copian a `assets/` y se inserta el Markdown).
- Menú contextual del editor: copiar/cortar/pegar + insertar título, tabla, enlace, imagen, código, callout.
- Autocompletado de palabras ya usadas en el documento (`Ctrl+Space` o automático).

**Preview y contenido**
- Render Markdown en vivo (debounce 150ms) con tablas, callouts (`[!NOTE]`, `[!TIP]`, etc.) y resaltado de código.
- LaTeX: `$...$` / `$$...$$` con KaTeX; archivos `.tex` con su propio modo de resaltado.
- Imágenes y vídeo embebidos (`![[archivo]]`), PDF a pantalla completa o inline.
- Etiquetas `#tag` (pill en el preview) y wikilinks `[[Nota]]` (link clicable que resuelve el archivo por nombre).
- Panel de etiquetas de toda la carpeta y panel de backlinks (qué archivos enlazan al activo).
- Índice del documento (TOC) y vista de cambios (diff) contra el último guardado.

**Navegación y productividad**
- Command Palette (`Ctrl+Shift+P`) con todos los comandos de la app.
- Búsqueda global de texto en los archivos de la carpeta abierta (`Ctrl+Shift+F`).
- Modo enfoque (solo editor) y modo lectura (solo preview).
- 26 temas de color (claro/oscuro + 24 temas conocidos tipo Dracula, Nord, Gruvbox, etc.).

**Exportar y distribuir**
- Exportar a HTML standalone o PDF.
- Empaquetado como AppImage (`npm run dist`) con icono y tipos MIME (`.md`/`.tex`) propios.
- Abrir MK haciendo doble clic en un `.md`/`.tex` desde el explorador de archivos.

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`; `sandbox: false` solo para que `preload.js` use `require('path')`/`highlight.js`/`clipboard`.
- Assets locales servidos vía protocolo custom `md-local://`, nunca `webSecurity: false`.
- Con una carpeta abierta, las rutas de assets no pueden escapar de ella (bloquea `../../etc/passwd` y similares).
- HTML del preview sanitizado con DOMPurify antes de insertarse en el DOM.

## Stack

Electron 32 · CodeMirror 5 · marked · KaTeX · DOMPurify · highlight.js · lucide.

## Arquitectura

- `src/main.js` — proceso principal: ventana, IPC (archivos, config, sesión, búsqueda, etiquetas, backlinks, gestión de archivos), protocolo `md-local://`.
- `src/preload.js` — bridge seguro (`contextIsolation`) que expone `window.mdEditor`.
- `src/index.html` + `src/*.js` — renderer sin bundler ni framework: un archivo por feature, cada uno en su propia IIFE, comunicándose entre sí de forma explícita vía `window.md*` (`mdTabs`, `mdState`, `mdSearch`, `mdTags`, `mdBacklinks`, `mdSidebar`, `mdCommandPalette`, `mdIconPicker`, etc.).
- `test/` — suite de humo (`npm test`) que lanza la app real con un perfil aislado y corre ~19 checks dentro de la ventana.

## Estado del proyecto

Con control de versiones (`git init` hecho). Ver [`MANUAL.md`](./MANUAL.md) para la guía de uso, [`ESTADO.md`](./ESTADO.md) para el detalle feature por feature y las limitaciones conocidas, y [`MEJORAS.md`](./MEJORAS.md) para el roadmap de mejoras pendientes.
