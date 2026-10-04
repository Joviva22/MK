# PDFs y pizarras dentro de las notas

En una nota Markdown guardada, pulsa `Ctrl+Shift+P` → **Insertar PDF o pizarra en la nota**. Elige **Todos los archivos** en el diálogo para ver PDFs y `.excalidraw`. El archivo debe estar dentro de la carpeta abierta; si la nota está fuera de ella, se usa la carpeta de la propia nota.

También puedes escribir:

```md
![[apuntes.pdf]]
![[apuntes.pdf#page=12]]
![[dibujos/esquema.excalidraw]]
![[apuntes.pdf#page=2|Tema de cachés]]
```

Son referencias a archivos separados, no copias dentro del Markdown. Las rutas son relativas a la nota; los espacios se escriben normalmente, no como `%20`. Para incrustar usa nombres sin `#` ni corchetes. Mover o borrar el archivo puede romper su referencia.

## PDF

Preview y Live Preview muestran una página con **Anterior/Siguiente**. Navegar no cambia el `#page` escrito en la nota: edita ese número para conservar otra página inicial.

**Abrir PDF** lleva a esa página en las herramientas de PDF de MK, donde puedes seleccionar texto, crear citas y anotar. El bloque incrustado es una vista de página, no un editor ni una capa de selección de texto. Las herramientas respetan los cambios pendientes de un PDF ya abierto y requieren tener activo el módulo PDF.

## Pizarra

La pizarra muestra una imagen de su versión guardada. **Editar pizarra** abre Excalidraw; al guardar, las vistas visibles se actualizan sin cambiar el texto de la nota. Los cambios todavía sin guardar no se muestran en la miniatura.

**Actualizar** vuelve a leer el archivo; úsalo si lo cambiaste con otra aplicación. La edición sigue en el panel independiente, no directamente dentro del bloque.

## Live Preview y recursos

Cuando el cursor está en la línea de la referencia, aparece la sintaxis para editarla. En las demás líneas se muestra el bloque con controles. Las referencias escritas dentro de bloques de código permanecen como ejemplos, sin cargar archivos.

Los bloques se cargan cerca de la pantalla, con un máximo de dos trabajos simultáneos. Al salir de la zona visible o retirar un bloque se cancelan renders y se liberan PDF y canvas; al volver pueden cargarse de nuevo.

Límites de la vista incrustada: PDF de hasta 50 MB; pizarras de hasta 25 MB y 5000 elementos. El editor de pizarra conserva su límite propio de 50 000 elementos. Imágenes de pizarra deben estar embebidas como datos, no cargarse desde servidores externos.

Las referencias no autorizan rutas: abre la carpeta o elige el archivo para conceder permiso si hace falta. No se permiten rutas fuera de la carpeta aplicable ni URLs remotas como archivos incrustados. El HTML de una nota tampoco puede declarar otra carpeta o fabricar permisos para este visor.

## Exportación

Al exportar se conservan enlaces al PDF o dibujo, no un visor interactivo ni una instantánea incrustada. Si compartes una nota/exportación, comparte también los archivos referenciados manteniendo su ubicación relativa.
