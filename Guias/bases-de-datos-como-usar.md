# Bases de datos — cómo usarlas

Guía paso a paso de las **bases de datos relacionales** de MK (estilo Notion). Para ideas de *para qué* usarlas, ver [`bases-de-datos-para-que-sirve.md`](bases-de-datos-para-que-sirve.md). Hay un ejemplo con datos ya cargados en [`../Ejemplos/bases-de-datos.md`](../Ejemplos/bases-de-datos.md).

## Antes de empezar

- **Necesitás una carpeta abierta** (botón **Carpeta**). Las bases se guardan dentro de ella, en `.mk/databases.sqlite3` (un archivo SQLite real).
- Cada carpeta tiene sus propias bases: abrir otra carpeta muestra otras bases.
- Si usás git, ese archivo se versiona junto con tus notas.

## Abrir el panel

Paleta de comandos (`Ctrl+Shift+P`) → **"Bases de datos"**. `Escape` o clic afuera lo cierra.

```
┌──────────────┬───────────────────────────────────────────────┐
│ Bases de   + │ [Nombre de la base]                        🗑 │
│ datos        │ ▤ Tabla  ▥ Tablero  + Vista                   │
│ ▸ Proyectos  │ [Filtrar filas...]      + Columna   + Fila    │
│ ▸ Tareas     │ ┌──────┬──────────┬────────┬──────┐           │
│              │ │Nombre│Prioridad │Proyecto│ ...  │           │
│              │ └──────┴──────────┴────────┴──────┘           │
└──────────────┴───────────────────────────────────────────────┘
```

## 1. Crear una base

1. Botón **+** arriba de la lista de la izquierda.
2. Escribí el nombre en el cuadro de arriba (se guarda al salir del cuadro).
3. Para borrarla entera: **🗑** (pide confirmación, no se puede deshacer).

## 2. Columnas (propiedades)

**+ Columna** (o **+** al final de los encabezados) crea una columna. **Clic en un encabezado** la edita: nombre, tipo y opciones, o **Eliminar**.

| Tipo | Guarda | Ejemplo |
|---|---|---|
| **Texto** | Texto libre | Nombre, descripción |
| **Número** | Número | Precio, horas, puntos |
| **Fecha** | Día (`AAAA-MM-DD`) | Fecha límite — ¡aparece en el calendario del [Home](home-como-usar.md)! |
| **Casilla** | Sí / No | Hecha, pagado |
| **Selección única** | Una opción de una lista, con color | Estado: Pendiente / En curso / Listo |
| **Selección múltiple** | Varias opciones | Etiquetas: urgente, cliente, idea |
| **Relación** | Enlaces a filas de **otra base** | Tarea → Proyecto |
| **Fórmula** | Se calcula sola desde otras columnas | `prop("Precio") * prop("Cantidad")` |
| **Rollup** | Resume columnas de las filas relacionadas | Suma de horas de las tareas de un proyecto |
| **Fecha de creación** | Automática, cuándo se creó la fila | — |

**Selección única / múltiple**: al configurar la columna, escribí las opciones **una por línea**. Cada una recibe un color.

> La **primera columna** es el "título" de la fila: es lo que se muestra cuando otra base la enlaza por relación. Conviene que sea de tipo Texto.

## 3. Filas

- **+ Fila** agrega una fila vacía.
- **Clic en una celda** para editarla (según el tipo: escribir, elegir fecha, tildar, elegir opción...).
- **Arrastrá una fila** para reordenarla.
- **×** al final de la fila la borra.
- **Clic derecho** en una fila (o tarjeta del tablero/galería) → **Duplicar fila** (copia valores y relaciones, queda justo debajo), abrir la fila completa o eliminarla.
- **Ancho de columna**: arrastrá el borde derecho del encabezado; doble clic en ese borde vuelve al ancho automático. Se guarda en la vista.
- **Filtrar filas...**: escribí y quedan solo las filas donde alguna columna contenga ese texto.

## Ordenar y filtrar

Los dos se guardan **en la vista**: una vista "Pendientes" puede tener su filtro y otra "Todo" ninguno.

**Ordenar** — clic en el encabezado de una columna:

- **↑ Ordenar ascendente** / **↓ Ordenar descendente**. El encabezado muestra la flecha.
- **Quitar orden** vuelve al orden manual.
- **✎ Editar columna...** abre la configuración de siempre.
- Números se ordenan como números, fechas por fecha, selección única según el orden de sus opciones. Las celdas vacías van siempre al final.
- Con un orden activo no se puede arrastrar filas (el orden lo decide la columna).

**Filtros por campo** — botón **Filtros** (junto al buscador):

1. **+ Agregar filtro** → elegí columna, condición y valor.
2. Podés sumar varios: la fila tiene que cumplir **todos**.
3. **×** quita un filtro. El botón muestra cuántos hay activos: `Filtros (2)`.

| Tipo de columna | Condiciones |
|---|---|
| Texto, fórmula, relación | contiene · no contiene · es igual a · vacío · no vacío |
| Número, rollup | = · ≠ · > · < · ≥ · ≤ · vacío · no vacío |
| Fecha, fecha de creación | es · antes de · después de · **es hoy** · **antes de hoy (vencida)** · **hoy o después** · **esta semana** · vacía · no vacía |
| Casilla | está marcada · no está marcada |
| Selección única | es · no es · vacía · no vacía |
| Selección múltiple | contiene · no contiene · vacía · no vacía |

El buscador de texto de al lado sigue funcionando y se combina con los filtros.

**Ejemplo:** vista "Esta semana" = filtro `Fecha límite` *esta semana* + `Hecha` *no está marcada*, ordenada por `Fecha límite` ↑.

## 4. Relaciones entre bases

Es lo que las hace *relacionales*: conectar filas de una base con filas de otra.

1. En la base **Tareas**, creá una columna tipo **Relación** y elegí la base destino **Proyectos**.
2. Clic en la celda de relación → aparece un buscador con las filas de Proyectos → elegí una o varias.
3. **Es de dos vías**: en **Proyectos** aparece sola una columna espejo (ej. "Tareas") con las tareas enlazadas. Cambiar el vínculo de un lado actualiza el otro.
4. Borrar la columna de relación borra también su espejo.

## 5. Fórmulas

Columna tipo **Fórmula** → escribí una expresión JavaScript. Leé otras columnas con `prop("Nombre de columna")`.

| Fórmula | Resultado |
|---|---|
| `prop("Precio") * prop("Cantidad")` | Total |
| `prop("Nombre") + " — " + prop("Prioridad")` | Texto combinado |
| `prop("Hecha") ? "✅" : "⏳"` | Ícono según la casilla |
| `Math.round(prop("Horas") / 8)` | Días de trabajo |
| `prop("Etiquetas").length` | Cuántas etiquetas tiene |

- Se recalculan solas al cambiar cualquier dato.
- Si la expresión tiene un error, la celda muestra `#ERROR`.
- `Math` está disponible. Selección múltiple y relación devuelven listas; casilla devuelve `true/false`.

## 6. Rollups

Resumen de las filas relacionadas. Al crear una columna tipo **Rollup** elegís:

1. **Columna de relación** (de esta base).
2. **Columna a agregar** (de la base destino).
3. **Agregación**: Cantidad, Suma, Promedio, Mínimo, Máximo o Valores únicos.

Ejemplo: en Proyectos, `Rollup(Tareas → Horas, Suma)` = horas totales del proyecto.

> Necesitás al menos una columna de Relación antes de crear un Rollup.

## 7. Vistas

Una base puede tener varias vistas de los mismos datos. **+ Vista** → Tabla, Tablero o Galería. **Clic derecho** en la pestaña de una vista → opciones / **Eliminar vista** (siempre queda al menos una).

| Vista | Cómo se ve | Uso |
|---|---|---|
| **▤ Tabla** | Filas y columnas, edición celda por celda | Cargar y revisar datos |
| **▥ Tablero** | Columnas tipo Kanban agrupadas por una **Selección única** | Flujos de estado: arrastrá tarjetas entre columnas para cambiar el valor |
| **▦ Galería** | Tarjetas | Colecciones: libros, recetas, contactos |
| **📅 Calendario** | Mes con las filas en su fecha | Entregas, eventos, turnos: arrastrá una fila a otro día para cambiarle la fecha; doble clic en un día crea una fila con esa fecha |

- En Calendario: clic derecho en la pestaña → **"Fecha según"** para elegir qué columna Fecha usa. Respeta los filtros de la vista.
- En Tablero: clic derecho en la pestaña → **"Agrupar por"** para elegir qué columna de selección define las columnas.
- En Tablero y Galería, clic en una tarjeta abre el **editor de fila completa** con todos los campos.

## Avisos en columnas Fecha

Clic en el encabezado de una columna **Fecha** → **Editar columna** → **Avisos → + Agregar aviso**: cuántos días antes (el mismo día, 1, 2, 3, 5, 7, 14, 30) y a qué hora. Vale para **todas las filas** de esa columna:

> 🔔 **Mañana: Informe final**
> Jueves, 1 de octubre · Base de datos: Proyectos · Entrega

- Si la base tiene una columna **Casilla** y la fila está marcada, no avisa.
- Suena con MK abierto (aunque el panel esté cerrado); los cambios en las bases se toman en hasta 2 minutos.
- Clic en la notificación abre la base de datos. En la tarjeta de aviso de MK: **✓ Hecho** marca la casilla de la fila, y se puede **posponer** (10 min, 1 hora, mañana 9:00).

## CSV: importar y exportar

**Exportar** — botón **⇩ CSV** (arriba a la derecha): guarda la **vista actual** (con sus filtros y orden) como `.csv`, listo para abrir en Excel, LibreOffice o Google Sheets (con tildes bien).

**Importar** — botón **⇪ CSV** (arriba de la lista de bases): crea una **base nueva** con el nombre del archivo.

- Primera fila = nombres de columna. La primera columna queda como título (texto).
- Detecta el separador solo: coma, punto y coma (Excel en español) o tabulador.
- Adivina el tipo de cada columna: **número** (`1.234,5` o `1,234.5`), **fecha** (`2026-10-03` o `03/10/2026`), **casilla** (sí/no, true/false, x), **selección única** (pocos valores que se repiten, ej. Estado) o **texto**.
- Después podés cambiar cualquier tipo con clic en el encabezado → Editar columna.

## 8. Ver fechas en el calendario

Cualquier columna **Fecha** hace que la fila aparezca en el calendario del [Home](home-como-usar.md#integración-con-bases-de-datos) (con "Fechas de bases de datos" tildado). Clic en ella desde el Home te trae de vuelta a esta base.

## Receta rápida: Proyectos + Tareas

1. Base **Proyectos**: `Nombre` (texto), `Estado` (selección: Pendiente, En curso, Terminado), `Fecha límite` (fecha).
2. Base **Tareas**: `Nombre` (texto), `Hecha` (casilla), `Horas` (número), `Proyecto` (relación → Proyectos).
3. En Proyectos aparece la columna espejo `Tareas`. Agregá `Horas totales` = Rollup(Tareas → Horas, Suma) y `Nº tareas` = Rollup(Tareas → cualquier columna, Cantidad).
4. En Proyectos, **+ Vista → Tablero** agrupado por `Estado`.
5. Abrí el **Home**: las fechas límite ya están en el calendario.
