# Cosas que mejoraría en MK

Opinión propia, no pedida por ninguna feature en curso. Ordenado por impacto real, no por lo divertido que sea implementarlo.

## Prioridad alta

1. **Inicializar git.** Ahora mismo no hay control de versiones — 30+ archivos de código, cero historial, cero forma de revertir un cambio salvo pedírmelo a mí en la misma sesión. Es el mayor riesgo estructural del proyecto, más que cualquier feature que falte. `git init` + primer commit costaría minutos.
2. **Icono personalizado por archivo se rompe al mover/renombrar.** Se guarda por ruta absoluta en `config.json`; si el archivo cambia de nombre o carpeta, pierde el icono sin aviso. Guardar por (ruta relativa a la raíz + hash de contenido) o mostrar un aviso cuando un `fileIcons` quede huérfano sería más robusto.
3. **`#tag` y `[[wikilink]]` no distinguen bloques de código.** Un `#no-es-tag` dentro de \`código\` o \`\`\`fences\`\`\` se transforma igual. La solución es la misma técnica que ya usa `extractMath` (extraer código a placeholders antes del resto del pipeline, restaurar al final) — hoy tags/wikilinks corren antes que esa protección exista.
4. **AppImage sin `mimeTypes` ni icono propio.** El build de `npm run dist` funciona pero no registra `.md`/`.tex` como tipos manejados (`linux.mimeTypes` en `package.json`) ni tiene icono (usa el de Electron por defecto). Documentado en su momento en `PARA-CLAUDE-CODE.md` pero nunca se aplicó al config de `electron-builder`.
5. **Crear/renombrar/borrar archivos desde el sidebar.** Hoy la única forma de crear un archivo dentro de una carpeta es "Guardar como" apuntando ahí a mano; no hay clic derecho → nuevo archivo/carpeta, renombrar o borrar. Es la operación de gestión de archivos más básica que falta.

## Prioridad media

6. **Sin backup/versionado del autoguardado.** El autoguardado pisa el archivo en disco sin dejar rastro de versiones anteriores. Un historial local ligero (guardar las últimas N versiones en `userData`, o un simple `.bak` con timestamp) evitaría perder trabajo por un autoguardado con contenido no deseado.
7. **Sin ESLint ni TypeScript.** Varios de los bugs reales de esta sesión (colisión de globals entre scripts, variable sin declarar) los hubiera atrapado un linter básico en segundos en vez de requerir pruebas manuales. No hace falta TypeScript completo — un `eslint.config.js` con `no-undef` y `no-unused-vars` ya sería una red de seguridad barata.
8. **Ajustes de editor inexistentes.** Tamaño de fuente, tipografía, ancho de tabulación y word-wrap están fijos en `styles.css`/CodeMirror. Son ajustes típicos de cualquier editor y hoy no hay ningún panel para tocarlos.
9. **Restricción de rutas solo con carpeta abierta.** Si abrís un archivo suelto (sin carpeta), no hay ninguna restricción de rutas para sus assets. Podría restringirse igual al directorio del propio archivo aunque no haya carpeta abierta en el sidebar.
10. **Diff es O(n·m) hecho a mano.** Suficiente para notas normales, pero se nota con archivos largos. Un Myers diff real (o una dependencia chica tipo `diff`) escalaría mejor si algún día se usa con archivos grandes.

## Prioridad baja / a futuro

11. **Migrar de `window.md*` + scripts sueltos a ES modules.** El patrón actual (cada archivo en su IIFE, comunicación por `window.mdX`) ya no tiene el riesgo de colisión de antes, pero sigue siendo más implícito que `import`/`export` reales. No urge — funciona bien — pero facilitaría el crecimiento futuro.
12. **Exportar a PDF/HTML no embebe KaTeX real.** Usa una hoja de estilos simplificada; las fórmulas se ven aproximadas. Decisión consciente en su momento para no arrastrar fuentes, pero vale la pena revisar si molesta en la práctica.
13. **Sin CI.** Los 17 checks de `npm test` solo corren si alguien se acuerda de correrlos a mano. Con git ya en pie (punto 1), un hook de pre-commit o un workflow simple lo resolvería sin mucho esfuerzo.
