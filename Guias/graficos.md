# Gráficos

**Para qué sirve:** ver de un vistazo lo que hay en tus datos — cuánto gastaste por categoría, cuántas tareas hay en cada estado, cómo evoluciona algo mes a mes — sin exportar a Excel.

MK tiene gráficos en dos lugares:

| Dónde | Qué muestra |
|---|---|
| **Vista Gráfico** de una [base de datos](bases-de-datos-como-usar.md) | Lo que elijas de esa base |
| **📈 Estadísticas** del [Home](home-como-usar.md) | Tu avance: semana, mes, racha, hábitos |

## Vista Gráfico (bases de datos)

1. Abrí la base (paleta → "Bases de datos").
2. **+ Vista → Gráfico**.
3. Arriba del gráfico elegí:

| Control | Opciones | Ejemplo |
|---|---|---|
| **Tipo** | Barras · Líneas · Torta | Torta para "partes de un total" |
| **Agrupar por** | Cualquier columna | Categoría, Estado, Fecha |
| **Por** (si agrupás por Fecha) | Día · Semana · Mes · Año | Mes |
| **Medir** | Cantidad de filas · Suma de … · Promedio de … | Suma de Monto |

### Qué tipo elegir

| Querés ver... | Tipo | Agrupar por | Medir |
|---|---|---|---|
| Cuánto gastaste en cada categoría | **Torta** o **Barras** | Categoría | Suma de Monto |
| Cuántas tareas hay en cada estado | **Barras** | Estado | Cantidad de filas |
| Cómo cambian las ventas mes a mes | **Líneas** | Fecha → Mes | Suma de Importe |
| Nota promedio por materia | **Barras** | Materia | Promedio de Nota |
| Cuántas cosas terminaste por semana | **Barras** | Fecha → Semana | Cantidad de filas |

### Cómo leerlo

- **Pasá el mouse** por una barra, punto o porción: muestra el valor exacto.
- **Ver tabla** (debajo): todos los números.
- Las barras con categorías se ordenan **de mayor a menor**; con fechas, en **orden cronológico** y los períodos vacíos aparecen en **0**.
- La torta junta en **"Otros"** lo que pase de 8 porciones.
- Respeta los **filtros** de la vista: si la vista filtra "solo septiembre", el gráfico muestra solo septiembre.

## 📈 Estadísticas del Home

Botón **📈** en la cabecera del Home:

- **Esta semana / Este mes**: tareas hechas de las planificadas.
- **Racha**: días seguidos con al menos una tarea hecha.
- **Atrasadas**.
- **Tareas hechas por semana** (últimas 8) y **pendientes por prioridad**.
- **Hábitos**: por cada tarea recurrente, su racha 🔥 y el cumplimiento de los últimos 30 días.

## Límites

- Un gráfico mide **una sola cosa** (un eje): para comparar dos medidas distintas (ej. monto y cantidad), armá dos vistas Gráfico.
- Todavía no hay gráficos a partir de una **tabla Markdown** de una nota (está en [`OBJETIVOS.md`](../OBJETIVOS.md)).
