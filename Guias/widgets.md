# Widgets en notas

**Para qué sirven:** armar una nota "tablero" con datos **vivos** de MK — tus tareas, tu progreso, el total de una base, tu equipo de mascotas — que se actualizan solos. Se ven en el preview y en Live Preview.

## Cómo
Un bloque de código con lenguaje `widget`:

````markdown
```widget
tareas: hoy
```
````

| Widget | Qué escribir | Qué muestra |
|---|---|---|
| **Tareas** | `tareas: hoy` · `tareas: semana` · `tareas: atrasadas` | La lista de tareas del Home, con su hora, día y categoría. **Se tildan desde la nota** |
| **Progreso** | `progreso` | Tareas hechas esta semana, racha y atrasadas |
| **Total de una base** | `base: Gastos` + `suma: Monto` (o `promedio: Nota`, o nada para contar filas) + opcional `vista: Sin pagar` | Un número grande: la suma, el promedio o la cantidad de filas de esa vista (con sus filtros). Botón **Abrir** |
| **Mascotas** | `mascotas` | Tu equipo con su nivel. Botón **Mis mascotas** |

## Ejemplo: nota de inicio
````markdown
# Mi día

```widget
tareas: hoy
```

```widget
progreso
```

```widget
base: Gastos
vista: Sin pagar
suma: Monto
```
````

Un ejemplo listo para abrir: [`../Ejemplos/tablero.md`](../Ejemplos/tablero.md).

## Ver también
Tablas y gráficos de una base dentro de una nota: bloque `database` ([bases-de-datos-como-usar.md](bases-de-datos-como-usar.md#mostrar-una-base-dentro-de-una-nota)) y bloque `chart` ([graficos.md](graficos.md)).
