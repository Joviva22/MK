# Estado de MK

## Hecho

- ~~Editor Markdown local (Electron + CodeMirror + marked)~~
- ~~Nuevo / Abrir / Guardar / Guardar como + atajos (Ctrl+N/O/S/Shift+S)~~
- ~~Sidebar: árbol de carpetas, expandir/colapsar, iconos por extensión~~
- ~~Recordar última carpeta abierta entre sesiones~~
- ~~Imágenes en preview (rutas relativas resueltas)~~
- ~~Vídeos embebidos (`![[video.mp4]]`)~~
- ~~PDF: click en sidebar → preview a pantalla completa~~
- ~~PDF embebido inline (`![[doc.pdf]]`)~~
- ~~LaTeX: render de fórmulas `$...$` / `$$...$$` con KaTeX~~
- ~~Editar archivos `.tex` con resaltado de sintaxis (modo `stex`)~~
- ~~Protocolo `md-local://` seguro (sin `webSecurity: false`)~~
- ~~Tema claro/oscuro con paleta profesional~~
- ~~Barra de estado (modo, Ln/Col, UTF-8)~~
- ~~Sanitización HTML del preview (DOMPurify)~~
- ~~Placeholder para imágenes/vídeos rotos~~
- ~~Tabs de archivos (varios documentos abiertos, indicador `●`, `Ctrl+W`, `Ctrl+Tab`)~~
- ~~Paneles redimensionables (sidebar ↔ editor ↔ preview)~~
- ~~Autoguardado (por pestaña, solo si el archivo ya tiene ruta)~~
- ~~Restaurar sesión (todas las pestañas — con o sin guardar — se recuperan al reabrir la app)~~
- ~~Fix: bug de guardado multi-pestaña (el proceso principal guardaba según "el último archivo tocado" en vez de la pestaña realmente activa — podía sobrescribir el archivo equivocado)~~
- ~~Abrir MK haciendo doble clic en un `.md`/`.tex` (single-instance lock, reenvío por IPC a la ventana existente, `.desktop` registrado en `~/.local/share/applications`)~~
- ~~Fix: cursor invisible en modo oscuro (color fijo negro de CodeMirror)~~
- ~~Highlight de código en bloques \`\`\` (highlight.js, cargado desde preload.js porque el paquete npm no trae build de navegador)~~
- ~~Tablas con mejor estilo (header, zebra, hover, bordes redondeados)~~
- ~~Drag & Drop de imágenes/vídeos/PDF al editor (copia a `assets/` junto al archivo, inserta el markdown)~~
- ~~Autoguardado configurable (dropdown ⚙: desactivado/1s/5s/30s, persistido en config.json)~~
- ~~Diálogo "se encontraron cambios sin guardar: restaurar/descartar" al reabrir la app~~
- ~~Callouts (`[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`)~~
- ~~Índice/TOC del documento (botón ☰ / Ctrl+Shift+O, panel flotante, click hace scroll)~~
- ~~Modo enfoque (solo editor) y modo lectura (solo preview) — botón 🎯 / Ctrl+Shift+E / Ctrl+Shift+R~~
- ~~Plantillas de documento nuevo (vacío, apuntes, documentación, trabajo universitario, README, fórmulas)~~
- ~~Vista de cambios / diff contra la última versión guardada en disco (botón 🔀, diff por líneas tipo LCS)~~
- ~~Restricción de rutas del resolver de assets a la carpeta raíz abierta (bloquea `../../etc/passwd` y similares; sin carpeta abierta no hay restricción)~~
- ~~Exportar a HTML (standalone, CSS embebido)~~
- ~~Exportar a PDF (vía `printToPDF` en una ventana oculta)~~
- ~~26 temas de editor (Claro/Oscuro + los 24 de `Temas.md`: One Dark Pro, Dracula, Monokai, Gruvbox, Solarized Dark/Light, Nord, Ayu Dark/Mirage/Light, Palenight, Cobalt2, Tokyo Night, Catppuccin, Night Owl, Shades of Purple, Panda, Winter is Coming, Andromeda, Material, Horizon, Rosé Pine, GitHub Dark/Light), todos mapeados a los mismos 7 tokens CSS, elegibles desde dropdown y persistidos en config.json~~
- ~~Fix: bug de CSS real — `.modal-overlay` y `.dropdown-menu` tenían `display` fijo que ignoraba el atributo `hidden`, dejando el modal de restaurar sesión (y los 4 dropdowns del toolbar) siempre visibles/bloqueando la app~~
- ~~Menú contextual (click derecho) en el editor: copiar/cortar/pegar/seleccionar todo + inserción rápida de título (H2), tabla, enlace, imagen, bloque de código y callout, todo posicionado en el punto del click y con el cursor listo para escribir tras insertar~~
- ~~Aislamiento de scripts: los 15 archivos de `src/*.js` del renderer se envuelven cada uno en su propia IIFE (`(function () { 'use strict'; ... })();`) para que sus `const`/`let`/`function` de nivel superior dejen de filtrarse como globales del `window` — ya van 3 bugs de este tipo (`cm`, `VIDEO_EXT`, colisiones futuras). La comunicación entre archivos sigue siendo, como ya era, explícita vía `window.md*`~~
- ~~Suite de humo automatizada (`npm test` → `test/run.js` + `test/renderer-checks.js`): lanza la app real con `--user-data-dir` aislado y `MK_TEST=1`, corre checks dentro de la ventana (puente de preload, dropdowns/menú contextual respetando `[hidden]`, pestañas, abrir/editar/guardar con round-trip a disco, preview Markdown, KaTeX, restricción de rutas, cambio de tema, paleta de comandos, búsqueda global, autocompletado) y sale con código 0/1 — cubre exactamente las regresiones ya encontradas a mano en esta app~~
- ~~Panel de índice (☰) pegado al borde derecho (sin margen), justo al lado del scroll de la ventana~~
- ~~Scrollbar de la vista previa pegada al borde de la ventana: antes vivía en `#preview-pane` (centrado con `max-width:900px`), por lo que flotaba a mitad de pantalla en ventanas anchas; ahora el scroll vive en un `#preview-scroll` a todo lo ancho y `#preview-pane` solo centra el texto adentro~~
- ~~Iconos de [lucide](https://lucide.dev) (`npm install lucide`, build UMD cargado como script suelto igual que CodeMirror/KaTeX) reemplazando los emoji de la barra de herramientas (Carpeta, Nuevo, Abrir, Guardar, Guardar como, Exportar, Diff, Índice, Enfoque, Búsqueda, Paleta de comandos, Ajustes, Tema)~~
- ~~Command Palette (`Ctrl+Shift+P` o botón ⌘): lista todos los comandos de la app (nuevo/plantillas, abrir, guardar, exportar, temas, vistas, pestañas) armada en el momento a partir de los botones ya existentes, con filtro por texto, navegación con flechas y Enter~~
- ~~Búsqueda global en archivos del proyecto (`Ctrl+Shift+F` o botón 🔍): busca texto en todos los `.md`/`.markdown`/`.txt`/`.tex` de la carpeta abierta (hasta 200 resultados), clic en un resultado abre el archivo y salta a la línea~~
- ~~Autocompletado en el editor (`Ctrl+Space` o automático al escribir 2+ letras): sugiere palabras ya usadas en el documento (CodeMirror `anyword-hint`), recoloreado con los tokens de tema~~
- ~~Icono personalizado por archivo: click derecho en una fila del árbol → "Cambiar icono..." abre un picker con los ~1500 iconos de lucide (buscador por nombre, con scroll — antes el grid no estaba acotado en altura y se cortaba sin scrollbar), se aplica al árbol y se persiste en `config.json` (`fileIcons: {ruta: nombreIcono}`); "Quitar icono personalizado" para volver al icono por extensión~~
- ~~Iconos por defecto del árbol (por extensión: md, tex, js, html, css, json, pdf, imágenes, vídeo, audio; y carpetas) migrados de emoji a sus equivalentes lucide, consistentes con los del picker de iconos personalizados — carpeta muestra `folder`/`folder-open` según esté colapsada o expandida~~
- ~~Etiquetas `#tag`: se renderizan como pill en el preview (no confunde `## Encabezado` con etiqueta), y un panel (`Ctrl+Shift+T` o botón 🏷) lista todas las etiquetas únicas de la carpeta abierta con su conteo — clic en una dispara la búsqueda global de esa etiqueta~~
- ~~Wikilinks `[[Nota]]` / `[[Nota|texto]]`: se renderizan como link clicable que resuelve el archivo por nombre dentro de la carpeta abierta y lo abre (o se marca como roto si no existe)~~
- ~~Backlinks (`Ctrl+Shift+B` o botón 🔗): panel con todos los archivos de la carpeta que enlazan al archivo activo vía `[[NombreActivo]]`, clic en un resultado abre el archivo y salta a la línea~~
- ~~Empaquetado con electron-builder: `npm run dist` genera un AppImage standalone (`dist/*.AppImage`, ~110 MB, incluye Electron + todas las dependencias) que no depende de `node_modules/` como el lanzador actual — probado end-to-end (arranca, carga toda la UI, llega a ejecutar JS en la ventana)~~

## Por hacer

- [ ] Workspaces, graph view, plugins, sincronización
- [ ] Actualizar `bin/mk-editor` / el `.desktop` para apuntar al AppImage empaquetado en vez de `node_modules/electron` (opcional: solo vale la pena si se va a distribuir la app fuera de esta máquina)

## Notas / limitaciones conocidas

- Exportar a PDF/HTML usa una hoja de estilos propia simplificada (no la del preview real) — las fórmulas KaTeX se ven aproximadas porque no embebe `katex.min.css` ni sus fuentes (decisión consciente para no arrastrar fuentes al portar el HTML a otra máquina).
- El diff usa un algoritmo LCS línea a línea escrito a mano (sin dependencia nueva) — O(n·m), de sobra para notas pero no pensado para archivos enormes.
- Las paletas de los 24 temas de `Temas.md` son aproximaciones fieles reconstruidas de memoria, no los hex oficiales exactos de cada tema (no hay una fuente única/paquete npm con las 24 paletas listas). El resaltado de código (`.hljs-*`) usa colores fijos, no cambia por tema — sería bastante más trabajo (24 paletas de sintaxis en vez de 24 paletas de UI).
- La restricción de rutas solo aplica si hay una carpeta abierta en el sidebar; abrir un archivo suelto (sin carpeta) no restringe nada.
- La búsqueda global solo indexa `.md`/`.markdown`/`.txt`/`.tex` (coincide con lo editable en la app), es substring simple sin fuzzy matching, y corta a los primeros 200 resultados — de sobra para notas pero no para carpetas gigantes.
- El autocompletado es "anyword" (palabras ya escritas en el documento actual), no un diccionario ni snippets de Markdown/LaTeX.
- Los regex de etiquetas/wikilinks no distinguen bloques de código: un `#tag` o `[[link]]` dentro de \`código\` o \`\`\`fences\`\`\` también se transforma (limitación conocida, aceptable para notas normales).
- El icono personalizado se guarda por ruta absoluta en `config.json`; si movés o renombrás el archivo, pierde el icono (hay que asignarlo de nuevo).
- `dist/` (salida de `npm run dist`) no se versiona/limpia automáticamente — se regenera cuando haga falta, no hace falta conservarlo entre sesiones.
