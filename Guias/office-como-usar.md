# Word, Excel y PowerPoint en MK

Usa **Nuevo → Documento de Word / Libro de Excel / Presentación de PowerPoint**, o abre un `.docx`, `.xlsx` o `.pptx` desde el explorador de MK. Cada documento tiene su pestaña y su editor visual. Todo funciona en local.

## Guardar y recuperar

**Guardar** (`Ctrl+S`) escribe el formato original del documento. **Guardar como** (`Ctrl+Shift+S`) elige otro nombre y mantiene el original. Si otro programa cambió el archivo, MK bloquea el guardado: usa Guardar como para conservar tu edición.

Antes del primer guardado de un Word importado, o de un Excel/PowerPoint con elementos de riesgo detectados, MK muestra una revisión de compatibilidad. Puedes cancelar, guardar una copia o continuar. La copia también tiene las limitaciones indicadas, pero conserva el original. El aviso se confirma para ese documento y se conserva en su recuperación; si se recarga una versión externa vuelve a revisarse.

Las ediciones pendientes se incluyen en la recuperación local de sesión. Al reabrir MK, elige conservarlas en el diálogo de recuperación. La copia de recuperación no sustituye al guardado del archivo. Si el documento no tenía cambios propios y cambió en disco, se abre la versión actual del disco. También se comprueba al volver a MK y cuando la carpeta vigilada comunica cambios. Con cambios propios se conserva tu edición y se indica que debes usar Guardar como.

**Deshacer** (`Ctrl+Z`) y **Rehacer** (`Ctrl+Y` o `Ctrl+Shift+Z`) funcionan en los tres editores. El historial conserva hasta 50 estados, con límites de memoria; los documentos grandes pueden conservar menos. Al recuperar la sesión se conserva también el historial si cabe en el límite de recuperación.

**Buscar en el documento** (`Ctrl+F`) encuentra texto de Word, valores y fórmulas en todas las hojas de Excel y contenido de todas las diapositivas. Usa Anterior/Siguiente o Enter para recorrer coincidencias; Shift+Enter retrocede y Escape devuelve el foco al documento.

**Búsqueda global** (`Ctrl+Shift+F`) reúne notas, tareas, filas de bases de datos y documentos Word, Excel y PowerPoint de la carpeta abierta. Los resultados de Office llevan al texto, la celda o la diapositiva. Busca el cuerpo del Word, valores y fórmulas de las hojas y textos de diapositivas; no incluye notas del presentador, texto de imágenes ni OCR. Se busca la versión guardada en disco. El primer recorrido puede tardar; las siguientes consultas reutilizan un índice en memoria y detectan cambios externos.

La búsqueda de Office omite carpetas ocultas, `node_modules`, `dist` y enlaces simbólicos. Está limitada a 500 documentos, 10.000 entradas del árbol, 200 resultados y archivos de 25 MB (100 MB descomprimidos). Si se alcanza un límite o no se puede leer un documento, se informa en los resultados. Para buscar más, abre una carpeta más pequeña.

## Word visual

Edita sobre la página: títulos, párrafos, negrita, cursiva, subrayado, tachado, fuente, tamaño, color, alineación y listas. Puedes insertar tablas, modificar sus celdas y añadir filas o columnas. Para añadir columnas a una tabla con celdas combinadas, crea primero una tabla simple.

Inserta una imagen local con **Imagen**. Haz clic sobre ella para cambiar su ancho o quitarla. Para crear un enlace, selecciona el texto y pulsa **Enlace**. **Convertir a nota** abre una copia en Markdown para usar las herramientas de notas; el documento Word permanece en su pestaña.

Se conservan estilos básicos, tablas combinadas e imágenes incrustadas. La disposición exacta de páginas puede cambiar. MK muestra un aviso al detectar encabezados/pies, notas al pie, comentarios, cambios controlados, columnas, campos automáticos, controles de contenido, marcadores o elementos avanzados que no conservará al reconstruir el Word. Para esos documentos, usa Guardar como.

Ejemplo: [informe completo](../Ejemplos/Word/proyecto-aula-verde.docx).

## Excel

Selecciona una celda y edita su **Valor / fórmula**, confirmando con Enter. También puedes hacer doble clic o pulsar F2 para escribir directamente en la celda. Las flechas y Tab permiten navegar. Ctrl+V pega tablas con filas y columnas.

Puedes añadir, renombrar o eliminar hojas, aplicar negrita, cursiva, fondo y formato numérico. En la caja **Celda**, escribe una dirección como `AA120` y pulsa Enter. La vista muestra bloques de 50 filas y 12 columnas para evitar cargar toda una hoja grande en pantalla; las demás celdas siguen en el libro.

Fórmulas admitidas en MK:

- Aritmética: `=C4*D4`, paréntesis, potencias y comparaciones.
- Rangos: `=SUM(E4:E8)` o `=SUMA(E4:E8)`.
- `AVERAGE/PROMEDIO`, `MIN`, `MAX`, `COUNT/CONTAR`.
- Condiciones: `=IF(E15>=0,"Dentro de presupuesto","Revisar")`, también `SI`.
- Redondeo: `=ROUND(C2/B2,3)`, también `REDONDEAR`.
- Referencias entre hojas: `='Presupuesto'!E12`.

Admite coma o punto decimal al introducir valores; las fórmulas utilizan punto decimal y separadores de argumentos con coma o punto y coma. Para introducir texto que empiece por `=`, pon un apóstrofo delante. Las fórmulas no admitidas se conservan y el libro solicita recálculo al abrirlo en Excel; MK muestra el error o el estado pendiente, sin inventar un resultado actualizado.

Los gráficos, macros, tablas dinámicas y vínculos externos no se editan y pueden perderse al escribir el libro. MK los detecta y muestra un aviso. El formato antiguo `.xls` y los libros cifrados no están admitidos.

Ejemplo: [presupuesto, calendario y seguimiento](../Ejemplos/Excel/proyecto-aula-verde.xlsx).

## PowerPoint

Selecciona una diapositiva en la lista y un texto o imagen en la vista previa. Edita el texto, su tamaño, color y alineación en el panel de propiedades. Arrastra los objetos para moverlos, o cambia su posición y dimensiones en pulgadas.

Añade textos, imágenes y diapositivas; duplica, elimina o reordena diapositivas. **Presentar** muestra la presentación dentro de MK; usa las flechas y Esc para salir.

La vista previa es simplificada: no reproduce fielmente diseños heredados, grupos, gráficos o animaciones. Esos elementos y las notas del archivo original se conservan al editar los textos y objetos compatibles. Al cambiar el texto de un cuadro, MK utiliza su estilo base; los estilos mezclados dentro de ese cuadro pueden unificarse. Las diapositivas duplicadas no copian las notas del presentador.

El formato antiguo `.ppt` y las presentaciones cifradas no están admitidos.

Ejemplo: [presentación de ocho diapositivas](../Ejemplos/PowerPoint/proyecto-aula-verde.pptx).

## Plantillas completas y ayuda

En **Nuevo → Plantillas completas** puedes elegir un informe de proyecto o acta de reunión (Word), presupuesto o calendario mensual (Excel), o una presentación de seis diapositivas (PowerPoint). Cada plantilla crea una pestaña independiente que puedes rellenar y guardar con otro nombre. Los campos entre corchetes indican qué completar; el presupuesto calcula importes con IVA y el total al cambiar cantidades y precios. El calendario usa el mes actual e incluye una hoja de tareas.

Pulsa **F1** o **Ayuda** para ver instrucciones y ejemplos según el documento abierto. Las herramientas de notas se ocultan mientras editas Office. **Herramientas** permite plegar la barra de formato de Word, Excel o PowerPoint; la preferencia se recuerda por formato. Guardar, deshacer, búsqueda y edición siguen disponibles. En Word, los controles específicos de tablas e imágenes aparecen al seleccionarlas. Los botones muestran una explicación al mantener el puntero sobre ellos.

Los controles de Office tienen un tamaño mínimo de 36 píxeles y un foco visible. Los diálogos de plantillas y ayuda se recorren con Tab y se cierran con Escape; el foco vuelve al control anterior. También se respeta la preferencia de contraste elevado del sistema.

La apertura muestra el estado de lectura y preparación. Word convierte su contenido y Excel lee y calcula el libro en trabajadores separados de la interfaz. El enriquecimiento de estilos de Word y la carga de diapositivas ceden tiempo a la interfaz. Excel muestra la cuadrícula por páginas. Se mantienen los límites de 25 MB por archivo, 100 MB descomprimidos y 300 diapositivas; la inserción final del contenido y las ediciones de libros muy grandes pueden todavía necesitar tiempo.
