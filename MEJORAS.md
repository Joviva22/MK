# Cosas que mejoraría en MK

Opinión propia, no pedida por ninguna feature en curso. Ordenado por impacto real, no por lo divertido que sea implementarlo.

## Hechas

- ~~**Inicializar git.** `git init` + primer commit (37 archivos) hecho. `.gitignore` excluye `node_modules/` y `dist/`.~~
- ~~**Icono personalizado por archivo se rompe al mover/renombrar.** Ahora se guarda por ruta relativa a la raíz (no absoluta) en `config.json` — sobrevive a mover/renombrar la carpeta entera. Sigue perdiéndose si renombrás el archivo suelto desde fuera de MK (renombrar/mover desde el sidebar sí migra la clave); no se agregó hash de contenido, quedó fuera de alcance.~~
- ~~**`#tag` y `[[wikilink]]` no distinguen bloques de código.** Arreglado con la misma técnica de `extractMath`: el código (fenced e inline) se extrae a placeholders antes de aplicar tags/wikilinks y se restaura después, tanto en el preview (`preview.js`) como en el escaneo de toda la carpeta (`tags:list`/`backlinks:list` en `main.js`).~~
- ~~**AppImage sin `mimeTypes` ni icono propio.** `package.json` → `build.linux` ahora tiene `mimeTypes: ["text/markdown", "text/x-markdown"]` e `icon: "build/icon.png"` (icono placeholder generado, 512×512). Verificado en el `.desktop` embebido del AppImage reconstruido.~~
- ~~**Crear/renombrar/borrar archivos desde el sidebar.** Clic derecho en una carpeta (o en la raíz) → "Nuevo archivo.../Nueva carpeta...". Clic derecho en cualquier archivo/carpeta → "Renombrar.../Eliminar" (con confirmación). El icono personalizado migra de clave al renombrar y se limpia al eliminar.~~
- ~~**Sin backup/versionado del autoguardado.** Cada `Guardar` (autoguardado incluido) respalda el contenido previo en `userData/backups/` (hasta 20 versiones por archivo) antes de pisarlo. "Ver versiones anteriores..." en la paleta de comandos las lista y permite traer una al editor. No hay diff entre versiones ni limpieza si el archivo original se borra — quedó simple a propósito.~~
- ~~**Sin ESLint ni TypeScript.** `eslint.config.js` (flat config) con `no-undef`/`no-unused-vars` sobre `src/` y `test/`, `npm run lint`. Encontró y arregló un `URL` mal declarado como global en la config antes de estabilizarse en 0 errores (15 warnings de `catch (e)` sin usar, dejados como están a propósito — no ameritan el churn de tocar 15 bloques).~~
- ~~**Ajustes de editor inexistentes.** Dropdown ⚙ ahora tiene tamaño de fuente, tipografía, ancho de tabulación y ajuste de línea, todos persistidos en `config.json` y aplicados a CodeMirror en caliente.~~
- ~~**Restricción de rutas solo con carpeta abierta.** Un archivo suelto (sin carpeta) ahora restringe los assets a su propio directorio en vez de no restringir nada.~~
- ~~**Diff es O(n·m) hecho a mano.** Reemplazado por el paquete `diff` (algoritmo de Myers, el mismo que usa git) — `Diff.diffLines` cargado como script suelto igual que las demás libs.~~
- ~~**`fs:delete` no usa la papelera del sistema.** Ahora usa `shell.trashItem`; si falla (sin gio/kioclient/trash-cli, o moviendo entre sistemas de archivos distintos — lo vi fallar así en este mismo entorno de pruebas) cae de vuelta a `fs.rmSync` para no dejar la operación a medias.~~
- ~~**Clic en un link deja la ventana en blanco.** Ningún `<a>` del preview tenía manejador — el clic navegaba la propia ventana de Electron fuera de `index.html`. Ahora `preview.js` intercepta todo clic: externos van a `shell.openExternal` (validado a solo http/https/mailto), relativos abren el archivo local como pestaña; `main.js` además bloquea cualquier `will-navigate`/ventana nueva como red de seguridad extra a nivel de la ventana.~~
- ~~**Abrir un archivo de extensión desconocida cuelga la app.** Se leía cualquier archivo como utf-8 a ciegas — un binario (imagen suelta, zip, etc.) se convertía en una "línea" de miles de caracteres basura que colgaba a CodeMirror al renderizarla. `file:read` ahora olfatea binario (byte NUL, heurística de git) antes de devolver el contenido; si es binario, se muestra un aviso en el editor en vez de abrirlo (con `filePath: null` para que "Guardar" no pueda pisar el binario original).~~
- ~~**Ver imágenes.** Clic en una imagen del sidebar ahora la muestra en el preview (mismo mecanismo que el PDF a pantalla completa) en vez de intentar abrirla como texto.~~

## Ideas descartadas (por ahora)

- **Sistema de plugins de verdad (JS de terceros).** Se pidió explícitamente, pero al preguntar por el alcance el usuario eligió el panel informativo (opción segura) en vez de un cargador de JS real — cargar código de terceros en una app con acceso a disco es una decisión de seguridad seria que no se debe improvisar. El panel "Plugins y comunidad" (🧩) queda como placeholder honesto; si más adelante se quiere un sistema real, la forma más segura sería scripts locales en una carpeta `plugins/` (no descargados de internet), con una API explícita y limitada (hooks tipo `onRender`/`onSave`, no acceso libre a `require`/`fs`), revisados a mano antes de habilitarse.

## Prioridad baja / a futuro

1. **Migrar de `window.md*` + scripts sueltos a ES modules.** El patrón actual (cada archivo en su IIFE, comunicación por `window.mdX`) ya no tiene el riesgo de colisión de antes, pero sigue siendo más implícito que `import`/`export` reales. No urge — funciona bien — pero facilitaría el crecimiento futuro.
2. **Exportar a PDF/HTML no embebe KaTeX real.** Usa una hoja de estilos simplificada; las fórmulas se ven aproximadas. Decisión consciente en su momento para no arrastrar fuentes, pero vale la pena revisar si molesta en la práctica.
3. **Sin CI.** Los checks de `npm test` (y ahora `npm run lint`) solo corren si alguien se acuerda de correrlos a mano. Con git y GitHub ya en pie, un workflow de Actions simple lo resolvería sin mucho esfuerzo.
4. **Historial de versiones sin diff ni límite de espacio real.** Guarda copias completas (no deltas) y el tope es "20 por archivo", no un tamaño total — en un proyecto con muchos archivos grandes podría acumular bastante en `userData`.
5. **La detección de binario es una heurística.** Byte NUL en los primeros 8000 bytes (lo mismo que usa git) — no es perfecta, pero es la misma que usan herramientas ya probadas.
