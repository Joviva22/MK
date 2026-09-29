# Tablero Kanban

**Para qué sirve:** ver una nota de tareas como tablero de columnas (Por hacer / Haciendo / Hecho) y mover tarjetas con el mouse — sin bases de datos, el tablero *es* el Markdown.

## Cómo
1. Escribí una nota así:
   ```markdown
   ## Por hacer
   - [ ] Escribir el resumen
   ## Haciendo
   - [ ] Armar la presentación
   ## Hecho
   - [x] Investigar
   ```
2. Paleta (`Ctrl+Shift+P`) → **"Ver tablero Kanban"**.
3. **Clic** en tarjeta: marcar/desmarcar. **Arrastrar**: cambiar de columna (reescribe la nota).

## Modo "Carpeta completa"
Junta todas las columnas del mismo nombre de **todas** tus notas (ej. todos los `## Por hacer`) en un solo tablero; cada tarjeta muestra de qué archivo viene.

**Arrastrar también funciona acá**: la tarjeta se mueve de columna **dentro de su propio archivo**. Si ese archivo no tiene la columna destino (ej. no tiene `## Hecho`), MK la crea al final del archivo.

## Usos
- Tablero de un proyecto dentro de su propia nota.
- Modo carpeta: "¿qué tengo pendiente en todos mis proyectos?".
- Columnas libres: `## Ideas`, `## Esperando respuesta`, `## Bloqueado`.

## Kanban vs. otras opciones
| Kanban | [Home](home-para-que-sirve.md) | [Tablero de base de datos](bases-de-datos-como-usar.md#7-vistas) |
|---|---|---|
| Por **estado**, dentro de notas | Por **fecha**, calendario | Por estado, con campos extra (fechas, números, relaciones) |

## Límites
Solo encabezados `##` (nivel 2) son columnas.
