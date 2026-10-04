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

1. Pulsa **Nueva** en la lista de la izquierda, o **Crear mi primera base** si todavía no tienes ninguna.
2. Elige **Lecturas**, **Proyectos**, **Estudio** o **Base vacía**, escribe un nombre y revisa la tabla de ejemplo. Puedes desmarcar **Incluir dos filas de ejemplo** para empezar sin registros.
3. Pulsa **Crear base**. Cancelar o Escape no crea datos. Después puedes cambiar el nombre en la cabecera y añadir o editar columnas.
4. **Guía rápida** explica filas, columnas, vistas y guardado. Para borrar la base entera usa **🗑**: pide confirmación y no se puede deshacer.

Una plantilla de **Lecturas** ya trae Título, Autor, Estado y Fecha. Añade una fila por libro o apunte. **Todo** muestra todos los registros; **Por estado** agrupa esos mismos registros en un tablero; **Pendientes** oculta los terminados. Los filtros no eliminan datos: el resumen indica cuántas filas coinciden y **Mostrar todas las filas** permite retirar el filtro.

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
- **Varias columnas**: con un orden puesto, clic en otra columna → **+ Después por esta ↑/↓** para desempatar (ej. Estado ↑ y después Fecha ↑). Los encabezados muestran el nivel: `↑1`, `↑2`.
- **Quitar orden** vuelve al orden manual (o **Quitar esta columna del orden**, si hay varias).
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
| **📊 Gráfico** | Barras, líneas o torta | Ver de un vistazo: gastos por categoría, tareas por estado, montos por mes |
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

## Vista Gráfico

**+ Vista → Gráfico**. Arriba del gráfico elegís:

| Control | Opciones |
|---|---|
| **Tipo** | Barras · Líneas · Torta |
| **Agrupar por** | Cualquier columna: selección (en el orden de sus opciones), texto, casilla (Sí/No), selección múltiple (cada etiqueta cuenta), o una **Fecha** |
| **Por** (solo con Fecha) | Día · Semana · Mes · Año — los períodos sin datos aparecen en 0 |
| **Medir** | Cantidad de filas · Suma de *columna numérica* · Promedio de *columna numérica* |

- Respeta los **filtros** de la vista: una vista "Gastos de septiembre" con su filtro grafica solo eso.
- Pasá el mouse por una barra, punto o porción para ver el valor exacto; **Ver tabla** muestra todos los números.
- Barras con categorías → horizontales, de mayor a menor. Con fechas → columnas verticales en orden cronológico. La torta junta en "Otros" lo que pase de 8 porciones.
- Se actualiza sola al cambiar las filas.

**Ejemplos:** gastos → Torta, agrupar por Categoría, medir Suma de Monto · proyectos → Barras por Estado, Cantidad · ventas → Líneas por Fecha (Mes), Suma de Importe.

## Mostrar una base dentro de una nota

Un bloque `database` en cualquier nota muestra una vista de una base (de la carpeta abierta):

````markdown
```database
base: Gastos
vista: Sin pagar
filas: 10
```
````

- `base:` nombre de la base (también sirve escribir solo el nombre en la primera línea).
- `vista:` qué vista mostrar (por defecto, la primera). Respeta sus **filtros y orden**; si es una vista **Gráfico**, dibuja el gráfico. Las vistas Tablero, Calendario y Galería se muestran como tabla.
- `filas:` cuántas filas como máximo (por defecto 20).
- **Se edita ahí mismo**: clic en una celda de texto, número, fecha o selección (o `Tab` hasta ella y `Enter`) para cambiarla; `Enter` guarda, `Esc` cancela; las casillas se tildan directo. Fórmulas, rollups y relaciones son de solo lectura. Tras guardar se redibuja (si una fila deja de cumplir los filtros de la vista, sale). El botón **Abrir** abre la base completa.
- Se ve en el preview y en Live Preview. Si el nombre no existe, te dice cuáles hay.

Ideal para una nota de proyecto que muestre sus tareas pendientes, o un resumen mensual con el gráfico de gastos.

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

### Vincular archivos

Añade una columna de tipo **Archivo**. En cada fila, pulsa **Elegir archivo** para vincular una nota, PDF, imagen o pizarra, y haz clic en su nombre para abrirlo. **Cambiar** selecciona otro archivo; **Ruta** permite escribir una ruta o dejarla vacía para quitar el vínculo. Quitar el vínculo no elimina el archivo.

Las rutas relativas parten de la carpeta de la base y se conservan al mover toda esa carpeta. Los archivos externos guardan su ruta absoluta. Al renombrar o mover archivos y carpetas desde MK, los vínculos se actualizan automáticamente. Si el cambio se hace fuera de MK, usa **Localizar archivo** o **Ruta** para repararlos. Los vínculos inexistentes muestran **No encontrado** y conservan la fila. Las columnas de Texto con rutas también ofrecen un botón para abrirlas.

### Ficha de cada fila

Pulsa **Abrir ficha** bajo el primer dato de una fila de la tabla, o abre una tarjeta del tablero, galería o calendario. La ficha reúne **Datos** y **Archivos vinculados**. Puedes editar y navegar con **Anterior** y **Siguiente** entre las filas visibles de la vista, respetando sus filtros y orden. **Cerrar** o Escape vuelve a la base. Si aún no tienes una columna Archivo, puedes añadirla desde la ficha.
