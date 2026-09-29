# Home — para qué sirve

El Home es tu **tablero de planificación personal**: responde de un vistazo *"¿qué tengo que hacer esta semana / este mes, y cómo voy?"*. Cómo se usa paso a paso: [`home-como-usar.md`](home-como-usar.md).

## La idea en una frase

Las notas de MK guardan **lo que sabés**; el Home organiza **lo que tenés que hacer y cuándo**.

## Semana vs. Mes: cuándo usar cada vista

| Vista | Pensada para | Pregunta que responde |
|---|---|---|
| **Semana** | Trabajo del día a día, ejecutar | "¿Qué hago hoy y mañana? ¿Qué muevo?" |
| **Mes** | Planificar con perspectiva, ver carga | "¿Qué semanas están cargadas? ¿Cuándo entrego?" |

Un ritmo que funciona bien:

1. **Inicio de mes** (vista Mes): anotá los **objetivos del mes** y poné en el calendario las fechas fijas (entregas, exámenes, reuniones).
2. **Inicio de semana** (vista Semana): escribí los **objetivos de la semana**, repartí tareas de "Sin fecha" en los días arrastrándolas.
3. **Cada día**: tildá lo hecho; lo que no llegaste, arrastralo a otro día.
4. **Fin de semana**: mirá la barra de **Progreso**, escribí en **Notas** qué salió bien/mal. Si quedaron **Atrasadas**, "Pasar a hoy" o reprogramalas.

## Casos de uso

### Estudiante
- Objetivos del mes: *"Aprobar parcial de Álgebra"*, *"Entregar TP de Historia"*.
- Calendario: fecha de cada examen y entrega (prioridad **alta**).
- Semana: bloques de estudio por día (*"Álgebra: ejercicios 1–10"*).
- Combinalo con: [Pomodoro](pomodoro-y-reproductor.md) para las sesiones, [Anki](exportar.md) para repasar.

### Trabajo / freelance
- Base de datos **Proyectos** con columna *Fecha límite* → las entregas aparecen solas en el calendario (ver [integración](home-como-usar.md#integración-con-bases-de-datos)).
- Home para las tareas concretas de cada día; la base de datos para el seguimiento del proyecto.
- Notas de la semana como mini-retrospectiva o resumen para el cliente.

### Vida personal
- Trámites, compras, turnos médicos, cumpleaños.
- "Sin fecha" como lista de *algún día*: cosas que querés hacer sin fecha fija.
- Objetivos del mes tipo hábitos: *"Correr 3 veces por semana"*.

## Home vs. otras funciones de MK

| Si querés... | Usá |
|---|---|
| Tareas con **fecha** y vista de calendario | **Home** |
| Tareas por **estado** (Por hacer / Haciendo / Hecho) dentro de una nota | [Kanban](kanban.md) |
| Registro o diario de lo que pasó en el día | [Nota diaria](nota-diaria.md) |
| Datos estructurados con relaciones (proyectos ↔ tareas ↔ clientes) | [Bases de datos](bases-de-datos-para-que-sirve.md) |
| Checklist dentro de un documento | `- [ ] tarea` en [Markdown](markdown-y-formato.md) |

Se complementan: la base de datos *Proyectos* pone las fechas grandes en el calendario del Home; el Home tiene las tareas chicas de cada día; la nota diaria guarda lo que pensaste mientras las hacías.

## Buenas prácticas

- **Pocas tareas por día** (3–5 importantes). Si un día desborda en la vista Mes ("+N más"), es señal de repartir.
- **Prioridad alta = no negociable.** Si todo es alta, nada lo es.
- **Objetivos ≠ tareas**: el objetivo es el resultado ("Lanzar la web"); las tareas son los pasos ("Escribir la página de inicio").
- **Usá "Sin fecha" sin culpa**: anotar sin decidir cuándo libera la cabeza; decidís el día al planificar la semana.
- **Revisá las Atrasadas** en vez de ignorarlas: reprogramar o borrar es mejor que acumular.

## Límites actuales

- Las tareas no se repiten solas (no hay tareas recurrentes).
- No hay recordatorios / notificaciones por fecha.
- Las filas de bases de datos se ven en el calendario pero se editan en el panel de Bases de datos.
- Las tareas del Home no son archivos `.md`: no aparecen en la búsqueda global ni en el Kanban.
