# PCP: sección crítica y exclusión mutua

Apunte breve de ejemplo para vincular al tema **Sección crítica**.

## Ideas clave

Una sección crítica accede a un recurso compartido cuya actualización necesita coordinación. La exclusión mutua evita que dos hilos ejecuten simultáneamente la sección protegida por el mismo mecanismo.

Una condición de carrera ocurre cuando el resultado depende del orden de ejecución de operaciones concurrentes no coordinadas. Por ejemplo, dos hilos pueden leer el mismo contador, incrementarlo y escribir el mismo valor, perdiendo uno de los incrementos.

Un mutex protege la sección crítica; el acceso protegido debe usar el mismo mutex en todos los hilos relevantes. La exclusión mutua, por sí sola, no garantiza ausencia de interbloqueo ni equidad.

## Esquema

![[seccion-critica.excalidraw|Zona compartida protegida]]

La pizarra contiene una zona protegida: añade dos hilos y flechas en **Editar pizarra**. Guarda para actualizar su vista dentro de este apunte.

## Preguntas para practicar

1. ¿Por qué `contador++` puede perder actualizaciones si no hay coordinación?
2. ¿Qué debe ocurrir si dos hilos intentan entrar en la sección protegida a la vez?
3. ¿Por qué un programa con mutex todavía puede tener interbloqueos?

Las preguntas no son tareas completadas automáticamente ni tarjetas automáticas. Usa **Repaso y examen** para crear tarjetas, o Home para registrar ejercicios como tareas.

## Criterio de autoevaluación sugerido

- **Pendiente:** todavía no puedes explicar el problema sin consultar la nota.
- **Practicando:** entiendes la idea, pero necesitas practicar intercalaciones de operaciones.
- **Dominado:** puedes explicar una carrera, proponer protección y reconocer límites del mecanismo.

Estos criterios son una propuesta, no un resultado de evaluación automática.
