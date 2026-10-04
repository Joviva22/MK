# Pizarra Excalidraw local

Paleta (`Ctrl+Shift+P`) → **Pizarra: nueva Excalidraw (local)**. También puedes abrir un archivo `.excalidraw` desde la carpeta o el diálogo de archivos (Todos los archivos).

Dibuja, escribe, conecta formas y añade imágenes. **Guardar** pide una ruta la primera vez; **Guardar como** permite crear otra copia. El formato `.excalidraw` conserva elementos e imágenes, para seguir editándolo después. `Ctrl+S` dentro del panel guarda; `Ctrl+Shift+S` abre Guardar como.

El guardado es manual: guarda antes de cerrar. Cambiar de dibujo o cerrar pregunta antes de descartar cambios. Al intentar salir de MK con cambios pendientes se bloquea la salida: vuelve a la pizarra y guarda o ciérrala confirmando el descarte.

Si el archivo cambió fuera de MK, el guardado avisa y no lo sobrescribe. Usa Guardar como para conservar tu versión. Se emplean las copias locales de historial y escritura atómica de MK. Límite de archivo: 25 MB; máximo 50 000 elementos.

La integración usa el componente abierto de Excalidraw, no Excalidraw+. No requiere pago, cuenta ni conexión. Motor y fuentes se incluyen localmente y se cargan al abrir la primera pizarra; no se habilitan colaboración online, IA ni contenido web incrustado. La política de seguridad de MK no se amplía.

La edición usa un panel independiente. Puedes mostrar la pizarra dentro de Markdown con `![[esquema.excalidraw]]`: [Materiales incrustados](materiales-incrustados.md). Todavía no hay pestañas de dibujos, edición directa dentro de la nota, exportación de dibujos ni autoguardado.
