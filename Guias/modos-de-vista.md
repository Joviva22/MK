# Modos de vista y panel secundario

**Para qué sirve:** adaptar la pantalla a lo que estás haciendo — escribir concentrado, leer, o consultar un archivo mientras escribís otro.

## Tres ejes independientes (se combinan)

| Eje | Control | Opciones |
|---|---|---|
| Sidebar | `Ctrl+B` | Visible / oculto |
| Principal | Botón de modo (muestra el modo actual: ícono y nombre), `Ctrl+Shift+E` / `Ctrl+Shift+R` / `Ctrl+Shift+L` | Normal · Enfoque (solo editor) · Lectura (solo preview) · **Live Preview** |
| Panel secundario | Clic derecho en archivo → "Abrir en panel secundario" | Cerrado / abierto |

Y `F11`: pantalla completa sin toolbar ni barra de estado.

## Live Preview: escribir viendo el resultado

Un cuarto modo, **además** de los otros tres (que siguen igual). `Ctrl+Shift+L`, el botón de modo (después de Lectura) o la paleta → "Modo Live Preview".

- Escribís en el mismo editor, pero la nota se ve **como en modo lectura**: encabezados grandes, **negrita**, *cursiva*, ~~tachado~~, enlaces, `#etiquetas`, `==resaltado==`, fórmulas, imágenes, tablas, separadores, citas y viñetas.
- **Solo la línea del cursor** muestra la sintaxis Markdown (`#`, `**`, `[texto](url)`...) para que la edites; al salir de la línea vuelve a verse renderizada.
- **Tablas y bloques `$$`**: se muestran crudos mientras el cursor esté en cualquiera de sus líneas.
- **Casillas** `- [ ]`: clic y se tildan (cambia el texto real).
- **Clic en una imagen, tabla o fórmula**: pone el cursor ahí para editarla. **Clic en un `[[wikilink]]`**: abre la nota (`Alt`+clic para editarlo).
- Sin números de línea y con ancho de lectura, como el preview.
- En archivos de código (`.py`, `.c`...) funciona como el modo enfoque.
- Los **callouts** `> [!NOTE]` y los **diagramas Mermaid** también se dibujan; con el cursor adentro se ven crudos para editarlos.

## Panel secundario
- Muestra md, PDF, `.docx` o imagen **de solo lectura** a la derecha.
- **Código / Vista**: ver el Markdown crudo o renderizado.
- **Clic en el título**: intercambia — ese archivo pasa a principal y el principal al secundario.
- Arrastrá el divisor para repartir el ancho.

## Combinaciones útiles
| Situación | Configuración |
|---|---|
| Escribir sin distracciones | `Ctrl+B` + Enfoque + `F11` |
| Escribir viendo cómo queda, sin pantalla dividida | Live Preview (`Ctrl+Shift+L`) |
| Resumir un PDF | PDF en panel secundario + principal en Enfoque |
| Repasar apuntes | Modo lectura + `Ctrl+scroll` para agrandar |
| Traducir / reescribir | Original en secundario (modo Código) + tu versión en principal |

## Límites
El secundario no se edita (MK tiene un solo editor).
