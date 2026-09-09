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
- ~~Repo git inicializado (`git init` + `.gitignore` + commit inicial de 37 archivos) — el proyecto no tenía control de versiones~~
- ~~Icono personalizado por archivo guardado por ruta relativa a la raíz (no absoluta) — sobrevive a mover/renombrar la carpeta entera, y el renombrado desde el sidebar migra la clave automáticamente~~
- ~~`#tag` y `[[wikilink]]` ya no se activan dentro de \`código inline\` ni \`\`\`fences\`\`\` (mismo mecanismo de placeholders que `extractMath`), tanto en el preview como en el escaneo de toda la carpeta (etiquetas/backlinks)~~
- ~~AppImage con icono propio (`build/icon.png`) y `mimeTypes` (`text/markdown`, `text/x-markdown`) registrados en el `.desktop` embebido~~
- ~~Crear/renombrar/eliminar archivos y carpetas desde el sidebar (clic derecho en un archivo, una carpeta, o la raíz de la carpeta abierta), con confirmación antes de eliminar~~
- ~~Barra de menú nativa (Archivo/Editar/Ver) eliminada (`Menu.setApplicationMenu(null)`, ver `F11.md`)~~
- ~~`Ctrl+N/O/S/Shift+S` movidos de `extraKeys` de CodeMirror a un listener global del documento — antes solo funcionaban con el editor enfocado, ahora andan sin importar qué parte de la app tiene el foco~~
- ~~`F11` alterna pantalla completa real de la ventana + modo "escritura sin distracciones" (oculta toolbar y barra de estado) — vuelve a pulsarlo restaura todo~~
- ~~Sidebar: subir a la carpeta superior (fila "↑ .." arriba del árbol) — reabre el padre de la carpeta actual como nueva raíz, sin diálogo~~
- ~~Sidebar: mover archivos y carpetas arrastrándolos y soltándolos sobre otra carpeta (o la raíz) — migra el icono personalizado y actualiza la pestaña si el archivo movido está abierto~~
- ~~Historial local de versiones: cada `Guardar` respalda el contenido previo del archivo en `userData/backups/` (hasta 20 versiones por archivo) antes de pisarlo; "Ver versiones anteriores..." (paleta de comandos) las lista y permite traer una al editor~~
- ~~ESLint (`npm run lint`, config plana en `eslint.config.js`) con `no-undef`/`no-unused-vars` sobre `src/` y `test/` — pensado como red de seguridad barata contra el tipo de bugs reales que salieron en este proyecto (colisión de globals, variables sin declarar)~~
- ~~Ajustes de editor (dropdown ⚙): tamaño de fuente, tipografía, ancho de tabulación y ajuste de línea, antes fijos en CSS/CodeMirror, ahora configurables y persistidos en `config.json`~~
- ~~Restricción de rutas de assets aplica también sin carpeta abierta: un archivo suelto ahora restringe al directorio propio del archivo en vez de no restringir nada~~
- ~~Vista de cambios (diff) reemplazada de un LCS O(n·m) escrito a mano por el algoritmo de Myers real (paquete `diff`, el mismo que usa git) — escala mejor con archivos largos~~
- ~~Eliminar desde el sidebar manda a la papelera del sistema (`shell.trashItem`, se puede restaurar) en vez de borrar directo; si la papelera falla (sin gio/kioclient/trash-cli, o moviendo entre sistemas de archivos distintos) cae de vuelta a borrado directo para no dejar la operación a medias~~
- ~~Fix: clic en un link del preview dejaba la ventana en blanco (navegaba la propia ventana de la app fuera de `index.html`). Ahora todo `<a>` se intercepta: externos (http/mailto) se abren con el navegador/cliente del sistema (`shell.openExternal`, con `will-navigate`/`setWindowOpenHandler` como red de seguridad en `main.js`), relativos a otro archivo local lo abren como pestaña~~
- ~~Fix: abrir un archivo de extensión desconocida o binario (imagen suelta, .zip, etc.) colgaba la app — se decodificaba como utf-8 a ciegas y CodeMirror intentaba renderizar una "línea" de miles de caracteres basura. Ahora `file:read` olfatea contenido binario (byte NUL, la misma heurística de git) antes de devolverlo; si es binario, se abre una pestaña sin archivo real de por medio avisando "no se puede editar" (así "Guardar" no pisa el binario original)~~
- ~~Clic en una imagen (png/jpg/jpeg/gif/webp/bmp/svg) del sidebar la muestra en el preview en vez de intentar "editarla" como texto~~
- ~~Panel "Plugins y comunidad" (botón 🧩 o paleta de comandos): por ahora solo informa que no hay sistema de plugins todavía, con espacio preparado para cuando exista — no carga código de terceros (decisión consciente de seguridad, ver MEJORAS.md)~~
- ~~Arrastrar un archivo del árbol (sidebar) directo al editor inserta el link/embed de Markdown en el cursor, referenciándolo donde ya está (sin copiarlo a `assets/` — eso solo pasa al arrastrar algo de fuera de la app)~~

## Por hacer

- [ ] Workspaces, graph view, sincronización
- [ ] Sistema de plugins de verdad (cargar JS local de una carpeta `plugins/` con una API limitada tipo hooks `onRender`/`onSave`) — el panel actual es solo informativo, ver MEJORAS.md para por qué no se construyó ahora
- [ ] Actualizar `bin/mk-editor` / el `.desktop` para apuntar al AppImage empaquetado en vez de `node_modules/electron` (opcional: solo vale la pena si se va a distribuir la app fuera de esta máquina)

## Notas / limitaciones conocidas

- Exportar a PDF/HTML usa una hoja de estilos propia simplificada (no la del preview real) — las fórmulas KaTeX se ven aproximadas porque no embebe `katex.min.css` ni sus fuentes (decisión consciente para no arrastrar fuentes al portar el HTML a otra máquina).
- Las paletas de los 24 temas de `Temas.md` son aproximaciones fieles reconstruidas de memoria, no los hex oficiales exactos de cada tema (no hay una fuente única/paquete npm con las 24 paletas listas). El resaltado de código (`.hljs-*`) usa colores fijos, no cambia por tema — sería bastante más trabajo (24 paletas de sintaxis en vez de 24 paletas de UI).
- La búsqueda global solo indexa `.md`/`.markdown`/`.txt`/`.tex` (coincide con lo editable en la app), es substring simple sin fuzzy matching, y corta a los primeros 200 resultados — de sobra para notas pero no para carpetas gigantes.
- El autocompletado es "anyword" (palabras ya escritas en el documento actual), no un diccionario ni snippets de Markdown/LaTeX.
- El icono personalizado se guarda por ruta relativa a la raíz; si renombrás/movés el archivo desde fuera de MK (no desde el sidebar), pierde el icono igual. También puede colisionar si dos carpetas distintas abiertas en momentos distintos tienen un archivo con el mismo nombre relativo.
- `dist/` (salida de `npm run dist`) no se versiona/limpia automáticamente (está en `.gitignore`) — se regenera cuando haga falta.
- El icono de `build/icon.png` es un placeholder generado (fondo azul + "MK"), no un diseño real.
- Mover un archivo/carpeta con drag & drop en el sidebar no valida visualmente destinos inválidos mientras arrastrás (ej. una carpeta dentro de sí misma) — se bloquea recién al soltar, con un `alert()`.
- Renombrar/mover desde el sidebar actualiza la pestaña abierta si el archivo estaba abierto; si se renombra/mueve desde fuera de MK (el explorador de archivos del sistema) mientras está abierto, la pestaña sigue apuntando a la ruta vieja.
- El historial de versiones vive en `userData/backups/` (no en el proyecto), no tiene diff entre versiones (solo reemplaza el contenido del editor al restaurar) y no se limpia si borrás el archivo original.
- ESLint solo corre `no-undef`/`no-unused-vars` a mano (`npm run lint`) — no hay CI que lo corra automáticamente en cada cambio.
- La detección de binario (byte NUL en los primeros 8000 bytes) es una heurística, no perfecta: un archivo de texto raro con un byte NUL perdido se trataría como binario, y un binario sin bytes NUL en el muestreo inicial podría colarse como texto.
- El panel de plugins es puramente informativo — no hay forma de instalar nada todavía.
