# Tarjetas de ejemplo para PCP

En **Home → Estudio → Repaso y examen**, selecciona la asignatura de ejemplo y crea estas tarjetas manualmente. Este archivo no es un formato de importación automática.

## Tarjeta 1

**Pregunta:** ¿Qué garantiza la exclusión mutua sobre una sección crítica?

**Respuesta de referencia:** Que como máximo un hilo a la vez ejecuta la sección protegida por el mismo mecanismo de exclusión. No garantiza por sí sola ausencia de interbloqueo ni equidad.

## Tarjeta 2

**Pregunta:** ¿Cómo pueden dos incrementos concurrentes perder una actualización?

**Respuesta de referencia:** Ambos hilos leen el mismo valor inicial, calculan el mismo valor incrementado y lo escriben. Si las operaciones no están coordinadas, el resultado refleja un solo incremento en lugar de dos.

## Uso

Vincula ambas tarjetas al tema **Sección crítica**. Al crearlas estarán pendientes de repaso. Haz un intento en modo examen antes de mostrar la referencia; valórate según lo que hayas contestado, no según si reconoces la respuesta al leerla.

También puedes seleccionar un fragmento de [pcp-concurrencia.md](pcp-concurrencia.md) y usar **Crear desde selección de nota** para conservar un vínculo al apunte.
