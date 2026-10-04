# Personalizar atajos de MK

## Para qué sirve

En **Ajustes → Atajos** puedes cambiar 23 acciones de archivos, pestañas, búsqueda, vistas y paneles. Las combinaciones originales están en [Todos los atajos](atajos.md); ese documento muestra los valores predeterminados, no una configuración personalizada.

## Cambiar una combinación

1. Abre Ajustes con el botón de engranaje y selecciona **Atajos**.
2. Selecciona el campo de la acción, por ejemplo **Abrir nota por nombre**.
3. Pulsa la combinación que quieres usar, por ejemplo `Ctrl+Alt+J`. El campo graba la pulsación: no necesitas escribir el nombre de las teclas.
4. Revisa el mensaje. Si la combinación ya pertenece a otra acción o está reservada, debes cambiarla antes de guardar.
5. Pulsa **Guardar atajos**. Aparecerá **Atajos guardados y activos** cuando MK confirme el cambio en disco. Se aplica inmediatamente y se conserva al reiniciar.

Mientras estás grabando una combinación, no se ejecuta la acción correspondiente. `Tab` cambia de campo y `Escape` permite cerrar Ajustes. Usa Ctrl/Alt y una tecla, o F1–F12; no se asignan letras sin modificadores ni AltGr, para no interferir con la escritura. En teclados que emulan AltGr mediante Ctrl+Alt, elige otra combinación disponible.

## Conflictos y protección

No se permiten dos acciones con la misma combinación, aunque pertenezcan a módulos apagados: sus datos y asignaciones se conservan para cuando los vuelvas a activar. Para intercambiar dos atajos, modifica ambos campos y guarda el conjunto cuando no haya conflictos.

Salir (`Ctrl+Q`), copiar, pegar, cortar, deshacer y otros atajos de edición, zoom, terminal y sistema permanecen reservados. Esta primera entrega no personaliza teclas locales de la terminal, Excalidraw, navegación por flechas o formato del texto.

La terminal mantiene su búsqueda con `Ctrl+F` y sus teclas de consola; Excalidraw mantiene su guardado con `Ctrl+S`. Los atajos de paleta, Home y pantalla completa siguen disponibles en esos contextos. Los módulos apagados no se activan mediante atajos personalizados.

MK detecta sus conflictos y reservas conocidas. El escritorio puede interceptar otras combinaciones antes de que lleguen a la app; si una no se graba o no llega, elige otra.

## Quitar, restaurar o descartar

- **Quitar**, o `Backspace`/`Supr` dentro del campo, deja la acción sin atajo. Guarda para aplicarlo.
- **Predeterminado** restaura solo ese campo, como cambio pendiente. Guarda para aplicarlo.
- **Restaurar todos** guarda y activa inmediatamente las combinaciones originales.
- **Descartar cambios** elimina el borrador pendiente y recupera las combinaciones que están activas.

Cerrar Ajustes no guarda por sí solo el borrador. Si falla el guardado, los atajos anteriores siguen activos; conserva el borrador y pulsa **Guardar atajos** de nuevo después de resolver el error. No reinicies con cambios pendientes si quieres conservarlos.

El botón de Ajustes siempre permite volver al panel, aunque quites su atajo. Los cambios se guardan en la configuración de MK, no en una nota ni en un Home concreto; entran en el respaldo de configuración. Una configuración corrupta o con conflictos usa los valores predeterminados con aviso en esta sección.

Ejemplo: [probar atajos personalizados](../Ejemplos/atajos-personalizados.md).
