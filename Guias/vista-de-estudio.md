# Vista de estudio: PDF, nota y pizarra

## Para qué sirve

Mantiene una nota editable a la izquierda y un PDF a la derecha. Puedes mostrar una pizarra editable debajo del PDF para resolver ejercicios mirando el enunciado, tomando apuntes y dibujando esquemas.

Se reutilizan los visores de MK, no se crean copias de los archivos. Hay **un único editor de notas**: cambiar de pestaña cambia la nota activa, no crea un segundo editor Markdown.

## Abrirla

1. Abre tu nota Markdown.
2. Pulsa `Ctrl+Shift+P` y busca **Estudio: vista dividida PDF, nota y pizarra**.
3. Usa **Abrir PDF…** y elige el documento. Si el diálogo no lo muestra, selecciona **Todos los archivos**.
4. Usa **Abrir pizarra…** para un `.excalidraw` existente o **Nueva pizarra** para comenzar uno.
5. Arrastra el separador vertical para cambiar el ancho del panel. El PDF se ajusta al ancho; al redimensionar se limpia la selección de texto, no las anotaciones.

Desde **Home → Estudio**, **Vista dividida · PDF, nota y pizarra** abre el primer material de cada tipo vinculado a la asignatura. **Estudiar este tema en vista dividida** usa los materiales de ese tema. Si hay varios del mismo tipo, elige otro con los botones de apertura. Si falta alguno, puedes abrirlo después; la nota activa se conserva si no hay un apunte vinculado.

## Llevar texto del PDF al apunte

1. Asegúrate de tener activa la pestaña Markdown de destino.
2. En el PDF activa **Seleccionar** y arrastra sobre el texto original.
3. Pulsa **Añadir al final de nota abierta**.
4. MK añade una cita y un enlace al PDF con su página de origen. El PDF permanece visible y no se sustituye el contenido anterior de la nota.

**Crear nota con selección** crea una pestaña nueva si prefieres separar el extracto. Las notas se guardan mediante el flujo habitual de MK; una nota nueva necesita una ruta antes de guardarse. El botón de añadir no permite escribir sobre una pestaña que no sea Markdown.

Los PDFs escaneados sin texto extraíble necesitan OCR externo: MK no inventa una selección de texto. Las citas apuntan al archivo original; moverlo puede romper el enlace y abrirlo requiere que su carpeta esté autorizada.

## Mantener el contexto

Cambiar de pestaña o volver a abrir el mismo PDF en esta vista conserva su página y anotaciones en memoria. Abrir un PDF diferente solicita confirmación si hay anotaciones pendientes. **Guardar como…** guarda el PDF editado en un archivo nuevo; conservarlo en el panel no sustituye ese guardado antes de salir de MK.

**Ocultar pizarra** da más espacio al PDF sin desmontar ni descartar el dibujo. **Mostrar pizarra** lo recupera. La pizarra tiene su propio **Guardar**; una nueva requiere elegir un archivo `.excalidraw`.

## Cerrar y límites

Pulsa **✕** en la cabecera del panel derecho. Si la pizarra tiene cambios sin guardar, cancelar la confirmación mantiene la vista abierta. Guarda la pizarra antes de cerrar si quieres conservar los cambios. El PDF y sus anotaciones permanecen en el visor en memoria; no se guardan automáticamente en disco.

La vista usa el espacio del panel secundario de referencia, por lo que ambos no se muestran a la vez. Al cerrarla vuelve el modo de edición anterior, salvo que hayas elegido otro modo mientras estudiabas. Las rutas siguen sujetas a los permisos de MK. No hay sincronización en la nube ni restauración de esta disposición tras reiniciar.

Ejemplo: [sesión de estudio con materiales](../Ejemplos/Estudio/vista-dividida.md). Más detalles: [PDF](pdf-como-usar.md), [Excalidraw](excalidraw.md) y [temas](comprension-y-resumen.md).
