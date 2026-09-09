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

## Prioridad baja / a futuro

1. **Migrar de `window.md*` + scripts sueltos a ES modules.** El patrón actual (cada archivo en su IIFE, comunicación por `window.mdX`) ya no tiene el riesgo de colisión de antes, pero sigue siendo más implícito que `import`/`export` reales. No urge — funciona bien — pero facilitaría el crecimiento futuro.
2. **Exportar a PDF/HTML no embebe KaTeX real.** Usa una hoja de estilos simplificada; las fórmulas se ven aproximadas. Decisión consciente en su momento para no arrastrar fuentes, pero vale la pena revisar si molesta en la práctica.
3. **Sin CI.** Los checks de `npm test` (y ahora `npm run lint`) solo corren si alguien se acuerda de correrlos a mano. Con git y GitHub ya en pie, un workflow de Actions simple lo resolvería sin mucho esfuerzo.
4. **Historial de versiones sin diff ni límite de espacio real.** Guarda copias completas (no deltas) y el tope es "20 por archivo", no un tamaño total — en un proyecto con muchos archivos grandes podría acumular bastante en `userData`.
