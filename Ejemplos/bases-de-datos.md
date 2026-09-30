# Bases de datos relacionales (tipo Notion)

Este ejemplo ya tiene datos reales cargados: dos bases de datos, **Proyectos** y **Tareas**, relacionadas entre sí. Se guardan en `.mk/databases.sqlite3` dentro de esta carpeta (no en este archivo).

Abrí la paleta de comandos (`Ctrl+Shift+P`) → **"Bases de datos"**.

## Qué mirar

1. **Proyectos**: columna `Estado` (selección única, con color) y `Fecha límite` (fecha). Tres filas: "Rediseño web", "Migración de base de datos", "Documentación de la API".
   - `Tareas` — columna de relación que **apareció sola**: es el espejo automático de la relación que se armó del lado de Tareas (ver abajo). Las relaciones son de dos vías: enlazá desde cualquiera de las dos bases, se ve reflejado en ambas.
   - `Cantidad de tareas` — **rollup**: cuenta las filas de `Tareas` enlazadas a cada proyecto, usando esa columna espejo.
2. **Tareas**: pasá a esta base en la lista de la izquierda.
   - `Prioridad` — selección única (Baja/Media/Alta).
   - `Hecha` — casilla.
   - `Proyecto` — **relación** a la base Proyectos: clic en la celda para ver/cambiar a qué proyecto pertenece cada tarea. Cambiarla acá también actualiza la columna `Tareas` del lado de Proyectos.
   - `Resumen` — **fórmula**: `prop("Nombre") + " — " + prop("Prioridad") + (prop("Hecha") ? " (lista)" : "")`. Se recalcula sola; cambiá la prioridad o marcá "Hecha" y mirá cómo cambia el texto.
3. Arriba de la tabla, junto a "Tabla", hay una segunda pestaña **"Tablero"**: agrupa las tareas por `Prioridad` en columnas, arrastrables.

## La base, dentro de esta nota

Un bloque `database` muestra la base acá mismo (en el preview o en Live Preview) y **se edita ahí**: clic en una celda para cambiarla, o tildá "Hecha" directamente.

```database
base: Tareas
filas: 10
```

Probá cambiar `base:` por `Proyectos`. Las vistas Tablero, Calendario y Galería se muestran como tabla (con sus filtros); las vistas Gráfico, como gráfico — ver `graficos.md`.

## Para armar una base desde cero

- **"+ Vista"** para agregar tabla/tablero/galería.
- **"+ Columna"** (o clic en un encabezado existente) para tipar una columna: texto, número, fecha, casilla, selección única/múltiple, relación, fórmula, rollup o fecha de creación.
- Rollup: agrega/edita una columna tipo **Rollup** eligiendo una columna de relación ya creada, una columna de la base destino, y una agregación (suma, promedio, cantidad, etc).
- **"+ Fila"** y clic en cada celda para cargar datos.

Ver `MANUAL.md` para más detalle.
