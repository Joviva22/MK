# Repaso espaciado y modo examen

Abre **Home → Estudio**, elige una asignatura y pulsa **Repaso y examen**. También está en la paleta (`Ctrl+Shift+P`) como **Estudio: tarjetas, repaso espaciado y modo examen**; usa la asignatura seleccionada en Estudio.

## Crear tarjetas desde tus apuntes

Selecciona un fragmento en una nota Markdown guardada. Abre el panel y pulsa **Crear desde selección de nota**: el texto se copia a la respuesta de referencia, para que escribas la pregunta y lo ajustes. **Guardar tarjeta** conserva el vínculo con la nota sin modificarla. También puedes crear tarjetas sin nota, editarlas o eliminarlas.

Pregunta y respuesta son texto literal, no HTML ejecutable ni Markdown renderizado. Límites: 8000 caracteres de pregunta y 16000 de respuesta. El borrador no se guarda hasta pulsar Guardar tarjeta. Al cerrar con un borrador se pide confirmación. Para abrir una nota de origen, MK debe tener autorizada su carpeta o archivo.

## Repasar

**Repasar pendientes** incluye las tarjetas de la asignatura cuya fecha ya venció; las nuevas están disponibles inmediatamente. Intenta recordar la respuesta, opcionalmente escríbela y pulsa **Mostrar respuesta**. Luego valórate:

- **Otra vez:** nuevo repaso dentro de 10 minutos; reinicia el intervalo.
- **Difícil:** dentro de un día.
- **Bien:** un día si es nueva; después duplica el intervalo anterior.
- **Fácil:** mínimo cuatro días; después triplica el intervalo anterior.

Los intervalos se limitan a 365 días. Los botones muestran el intervalo que se aplicará. Es una programación sencilla y local, no FSRS ni una predicción de cuánto sabes. Los días se calculan en calendario local; los diez minutos son tiempo real transcurrido.

El botón **Estudio** de Home muestra el número de repasos pendientes; se actualiza al abrir/cerrar el panel y cada minuto. No hay notificaciones del sistema en esta primera entrega.

## Modo examen y errores

**Modo examen** usa todas las tarjetas de la asignatura en orden aleatorio, no solo las vencidas. La referencia está oculta hasta que escribes un intento. Después de revelarla, ese intento queda bloqueado para comparar y marcar **Correcta** o **Incorrecta**. La corrección es tu autoevaluación, no una corrección automática.

Cada valoración guarda el intento, la pregunta, la fecha y el resultado. **Practicar errores** reúne tarjetas cuyo último resultado de examen fue incorrecto; al acertarlas en otro examen salen de esa lista. Un repaso acertado no elimina por sí solo un error de examen. El examen no altera las fechas del repaso espaciado.

## Datos y guardado

Tarjetas y resultados viven en el mismo Home que tus asignaturas y entran en su respaldo habitual. Renombrar una categoría conserva sus tarjetas porque se vinculan por identificador. Borrar una tarjeta no borra su nota ni su historial de resultados. Puedes consultar los últimos 20 resultados en el panel.

Cada tarjeta o valoración se confirma en disco antes de continuar. Si falla, queda pendiente en memoria y aparece **Reintentar guardado**; no vuelvas a valorar para duplicarlo. El panel no permite cerrar con ese guardado pendiente. Si cambias de Home durante el guardado, el reintento conserva el destino original.

Los resultados ya valorados sobreviven al reinicio. No se reanuda el punto exacto de una sesión ni se recuperan borradores o intentos sin valorar; guarda o valora antes de salir. No se incluyen todavía importación de mazos, tarjetas automáticas mediante IA ni exámenes con cronómetro.
