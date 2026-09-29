# Gráficos

Esta carpeta trae una base de datos **Gastos** (19 gastos de julio a octubre) con gráficos ya armados.

1. Abrí esta carpeta en MK (**Carpeta** → `Ejemplos/`).
2. Paleta (`Ctrl+Shift+P`) → **"Bases de datos"** → **Gastos** en la lista de la izquierda.
3. Mirá las pestañas de vistas:

| Vista | Qué muestra |
|---|---|
| **Tabla** | Los gastos, uno por fila |
| **Por categoría** | 📊 Torta: cuánto se fue en Comida, Transporte, Casa, Ocio, Salud |
| **Por mes** | 📊 Barras: total gastado cada mes |
| **Calendario** | Cada gasto en su día (arrastralo para cambiarle la fecha) |
| **Sin pagar** | Tabla filtrada: solo los que tienen "Pagado" sin marcar, ordenados por fecha |

## Probá

- En **Por categoría**, cambiá **Tipo** a *Barras* y **Medir** a *Promedio de Monto*.
- En **Por mes**, cambiá **Por** a *Semana*.
- Agregá un gasto en la **Tabla** y volvé al gráfico: se actualiza solo.
- Pasá el mouse por una barra o porción: muestra el valor exacto. **Ver tabla** debajo muestra todos los números.

## Gráficos dentro de una nota

Un bloque `chart` convierte una tabla en gráfico (miralo en el preview o en Live Preview):

```chart
tipo: barras
título: Horas de estudio por materia
| Materia | Horas |
|---|---|
| Álgebra | 12 |
| Historia | 7,5 |
| Física | 9 |
| Inglés | 4 |
```

```chart
tipo: líneas
tiempo: sí
título: Pasos por día
| Día | Pasos |
|---|---|
| Lun | 6.200 |
| Mar | 8.400 |
| Mié | 5.100 |
| Jue | 9.800 |
| Vie | 7.300 |
```

```chart
tipo: torta
| Gasto | € |
|---|---|
| Alquiler | 650 |
| Comida | 280 |
| Transporte | 60 |
| Ocio | 90 |
```

## Estadísticas del Home

El **Home** (`Ctrl+Shift+H`) también tiene gráficos: botón **📈** → tu semana, tu mes, racha y hábitos.

Guía: [`../Guias/graficos.md`](../Guias/graficos.md).
