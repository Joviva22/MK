# Optimización de CM6 — mediciones del 2026-10-03

## Primera pasada

Mediciones locales con `npm run bench`, mismos fixtures (3000 notas y un documento de unas 5000 líneas). La columna «antes» procede de `/tmp/mk-opt-before.log`; «después», de `/tmp/mk-opt-final2.log`. No se ha sustituido la referencia histórica del benchmark.

| Caso | Antes | Después |
| --- | ---: | ---: |
| Abrir nota de 5000 líneas | 807,4 ms | 671,5 ms |
| Insertar 100 caracteres, editor | 816,4 ms | 478,8 ms |
| Insertar 100 caracteres, Live Preview | 831,7 ms | 811,9 ms |
| Renderizar preview completo | 136,6 ms | 85,1 ms |

Estos valores son observaciones, no garantías: la carga del equipo y el trabajo asíncrono afectan al resultado. La pequeña diferencia de Live Preview no basta para afirmar una mejora general. La apertura grande y Live Preview siguen siendo más lentos que la referencia histórica de CM5; requieren más trabajo.

## Cambios aplicados

- Caché de texto por documento inmutable: varias lecturas del mismo contenido no repiten `toString()`.
- Caché de posiciones de clases por estado, evitando recorrer todas las decoraciones una vez por cada handle.
- Efectos agrupados por documento, incluidos documentos inactivos; eliminación de Live Preview y marcas del corrector por lotes.
- Respuestas del corrector invalidadas al editar o cambiar de pestaña, evitando aplicar un resultado antiguo sobre otra nota.
- Eventos `changes` de CM6 con rangos y texto reales.
- Actualización local de prosa ordinaria sin saltos ni delimitadores Markdown. La prueba de 600 líneas redibuja 3 unidades y no incrementa el contador de reconstrucciones completas.
- Cambios de estructura, bloques, delimitadores o saltos conservan la reconstrucción completa segura. No se afirma haber terminado la actualización incremental de todos los casos Markdown.
- Parseo de tokens acotado y cacheado por estado, con comprobación de formato lejos del principio del documento.

## Comprobaciones

`npm run test:cm6`: 49/49, incluidas actualización local, fallback estructural y formato en líneas lejanas. Entrega conjunta: integración 160/160, 18 archivos de pruebas unitarias y lint correctos.

## Siguiente trabajo de rendimiento

Medir por separado apertura, reconstrucción de Live Preview y escritura con distintos documentos (prosa, tablas y código). Mantener una comparación controlada de variantes y reducir el trabajo completo restante sin omitir formato ni marcas visibles.

## Segunda pasada — 2026-10-03

Se elimina la reconstrucción duplicada de Live Preview al activar pestañas, se evita reconfigurar un modo idéntico y se difiere el panel de preview oculto hasta volver a mostrarlo. La ruta activa se establece antes de cambiar de documento y la caché HTML distingue ruta de nota y carpeta. Las tablas, callouts y cuerpos de fences cerrados admiten ediciones locales conservando límites; los cambios estructurales siguen reconstruyendo todo.

Pruebas finales: integración 162/162, CM6 51/51, 18 archivos unitarios y lint correctos. Incluyen actualización de los tres tipos de bloque, fallback al romper una tabla, una sola reconstrucción al cambiar de pestaña y refresco del preview diferido.

Mediciones: `/tmp/mk-opt2-before.log` y `/tmp/mk-opt2-final.log` (última ejecución sin suites concurrentes). La apertura incluye abrir y cerrar; las nuevas mediciones desglosadas son una observación de apertura, no medianas.

| Caso | Antes | Después |
| --- | ---: | ---: |
| Abrir/cerrar nota de 5000 líneas | 819,9 ms | 641,2 ms |
| Insertar 100 caracteres, editor | 586,4 ms | 397,4 ms |
| Insertar 100 caracteres, Live Preview | 553,7 ms | 1023,6 ms |
| Preview completo | 88,7 ms | 84,4 ms |

Reconstrucción completa de Live Preview: 123,8 ms. Apertura desglosada: lectura 2,6 ms, creación del documento 6,0 ms, activación 357,4 ms (editor 14,1 ms y UI/preview 343,3 ms).

La escritura en Live Preview empeoró en esta ejecución: **no se considera resuelta la optimización general**. Los beneficios funcionales locales están comprobados, pero falta aislar trabajo de decoraciones, parseo y eventos al escribir antes de atribuir las diferencias a una causa. Se conserva la referencia histórica y el objetivo pendiente.

## Tercera pasada — bloqueos al editar texto con formato

Se corrige una causa concreta de tirones: escribir letras dentro de palabras con negrita, énfasis, enlaces o código inline obligaba a reconstruir toda la nota. Ahora se actualizan solo las unidades afectadas cuando se conserva el flanqueo de los delimitadores. También se admiten espacios y puntuación alejados de delimitadores en texto con formato; los destinos/títulos de enlaces conservan reglas más estrictas. Cambiar prefijos de listas/encabezados, delimitadores o estructura sigue usando el camino completo seguro.

Otras medidas aplicadas:

- Marcadores ocultos con `Decoration.replace` sin widgets vacíos en CM6.
- Caché de tokens por texto inmutable e idioma, reutilizable entre cambios de selección/decoraciones. Una actualización local solicita parseo hasta la línea necesaria, mientras la reconstrucción completa prepara el árbol con un único presupuesto acotado.
- Limpieza `clearOnEnter` limitada al rango del cursor, sin filtrar todas las marcas por cada selección.
- Liberación del DOM de lectura oculto en enfoque/Live Preview, incluyendo cambios de pestaña; refresco al mostrarlo de nuevo. PDFs y multimedia conservan su visor, y exportar/índice siguen pudiendo solicitar un preview actualizado.
- Perfilado opcional de tiempos del editor en el benchmark, sin activarlo en uso normal. Se añade medición repetible de edición con formato y entrada nativa simulada.

La comparación controlada usa el mismo fixture de 5000 líneas, restablecido antes de cada una de cinco ediciones de una palabra con negrita y posterior movimiento del cursor. Con el camino local desactivado: **102,9 ms**, una reconstrucción por edición (`/tmp/mk-live3-inline-before.log`). Activado, ejecución final: **22,0 ms**, ninguna reconstrucción en las cinco ediciones (`/tmp/mk-live3-final.log`). Reducción observada de aproximadamente el 79 % en este caso; no representa una mejora universal de escritura.

Entrada nativa simulada (`execCommand('insertText')`, 20 caracteres, esperando cada actualización de CM6 y un frame): mediana **14,4 ms**, máximo **23,9 ms**. Es una medición distinta del bucle histórico y no debe compararse directamente con él ni interpretarse como garantía de latencia.

El benchmark histórico sigue acumulando cientos de inserciones programáticas en una misma línea: **1070,1 ms por 100 caracteres en Live Preview**, frente a 780,7 ms en el perfilado inicial de esta pasada y 477,7 ms en la referencia histórica. El coste principal observado está dentro de la actualización visual/selección del navegador, no en los eventos de Live Preview. Se conserva esta regresión visible y **la optimización general permanece pendiente**. Las pruebas de aislamiento CSS no mejoraron los resultados y se retiraron; la captura temporal de CPU/layout también se retiró del proceso principal.

Comprobaciones finales: integración **163/163**, CM6 **57/57**, **18** archivos unitarios y lint correctos. Incluyen formato lejano, espacios, entrada nativa con acento, prefijos de listas, ocultación sin widgets, refresco del panel y fallback estructural.
