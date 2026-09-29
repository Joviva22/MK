# Home — cómo usarlo

Guía paso a paso del **Home**, el planificador semanal y mensual de MK. Para ideas de *para qué* usarlo, ver [`home-para-que-sirve.md`](home-para-que-sirve.md).

## Abrir y cerrar

| Cómo | Qué hace |
|---|---|
| Botón **Home** (toolbar, arriba a la izquierda) | Abre el Home |
| `Ctrl+Shift+H` | Abre / cierra el Home |
| Paleta de comandos (`Ctrl+Shift+P`) → "Home: planificador semanal y mensual" | Abre el Home |
| `Escape`, botón **×** o clic fuera del panel | Cierra el Home |

Para que aparezca solo al abrir MK: ⚙ **Ajustes** → tildá **"Abrir Home al iniciar"**.

> No necesita carpeta abierta. Tus tareas son personales y se guardan en la configuración de la app (`home.json`), no dentro de tus notas — las ves igual abras la carpeta que abras.

## Las partes de la pantalla

```
┌───────────────────────────────────────────────────────────────────┐
│ Home  [Semana|Mes]  ‹ Hoy ›  Semana 40 · 28 sept – 4 oct   ☐ BD × │  ← cabecera
├──────────────┬────────────────────────────────────────────────────┤
│ Progreso     │  Lun   Mar   Mié   Jue   Vie   Sáb   Dom           │
│ Objetivos    │  ┌──┐  ┌──┐  ...                                   │
│ Notas        │  │  │  │  │        ← tareas de cada día            │
│ Atrasadas    │  +Agregar tarea                                    │
│ Sin fecha    │                                                    │
└──────────────┴────────────────────────────────────────────────────┘
   panel lateral            vista principal (semana o calendario)
```

- **Semana / Mes**: cambia entre la vista de 7 columnas y el calendario mensual.
- **‹ / ›**: semana (o mes) anterior / siguiente. **Hoy**: vuelve al período actual.
- **Fechas de bases de datos**: muestra también las filas de tus [bases de datos](bases-de-datos-como-usar.md) que tengan una columna *Fecha* (ver más abajo).

## Vista Semana

1. Cada columna es un día, de lunes a domingo. **Hoy** tiene el borde resaltado; sábado y domingo tienen fondo distinto.
2. Arriba de cada columna ves el número del día y un contador `hechas/total`.
3. **Agregar una tarea**: escribí en el cuadro "+ Agregar tarea" al pie del día y apretá `Enter`. El cuadro queda listo para escribir la siguiente. `Escape` lo vacía.
4. **Marcar como hecha**: tildá el checkbox de la tarea (se tacha y baja al final de la lista).
5. **Moverla a otro día**: arrastrala y soltala en otra columna.
6. **Editarla**: clic en el texto de la tarea → se abre el editor (ver abajo).

## Vista Mes (calendario)

1. Una grilla con todas las semanas del mes. Los días de otros meses aparecen atenuados.
2. Cada día muestra hasta **3 tareas**; si hay más aparece **"+N más"** (clic → te lleva a esa semana).
3. **Agregar una tarea**: **doble clic** en un hueco vacío del día → escribí → `Enter`.
4. **Mover**: arrastrá la tarea a otro día del calendario.
5. **Clic en el número del día**: salta a la vista Semana de esa fecha.
6. El color del borde izquierdo de cada tarea indica la prioridad: 🔴 alta · 🟡 media · 🟢 baja.

## El editor de tarea

Clic en cualquier tarea abre un cuadro con:

| Campo | Para qué |
|---|---|
| **Título** | El texto de la tarea (`Enter` guarda) |
| **Fecha** | Cambiarla a mano; vaciarla la manda a "Sin fecha" |
| **Prioridad** | Alta / Media / Baja — define el color y el orden dentro del día |
| **Notas** | Detalle libre; se ve al pasar el mouse sobre la tarea |

Botones: **Guardar**, **Cancelar** (o `Escape`) y **Eliminar** (pide confirmación).

## El panel lateral

Todo lo del panel lateral depende del período que estés mirando: los objetivos y notas de la *semana 40* son distintos de los de la *semana 41*, y los del *mes de septiembre* distintos de los de *octubre*.

- **Progreso**: barra con `X de Y tareas hechas (Z%)` del período visible.
- **Objetivos**: metas de la semana o del mes (no son tareas con día, son "lo que quiero lograr"). Escribí en "+ Agregar objetivo" y `Enter`; tildalos al cumplirlos; **×** para borrarlos.
- **Notas**: texto libre del período (reflexión, ideas, pendientes sueltos). Se guarda solo mientras escribís.
- **Atrasadas**: aparece solo si hay tareas sin terminar con fecha anterior a hoy. **"Pasar a hoy"** las mueve todas a hoy de un clic.
- **Sin fecha**: bandeja de tareas sin día asignado. Agregalas con "+ Tarea sin fecha", y **arrastralas a un día** cuando decidas cuándo hacerlas. También podés arrastrar una tarea de un día hasta acá para "desprogramarla".

## Integración con Bases de datos

Con una carpeta abierta y **"Fechas de bases de datos"** tildado, cada fila de una base de datos que tenga una columna de tipo **Fecha** aparece en ese día como un chip con borde punteado (`▤ Nombre de la fila`).

- Es **solo lectura** en el Home: no se arrastra ni se edita desde acá.
- Si la base tiene una columna **Casilla**, la fila aparece tachada cuando está marcada.
- **Clic en el chip** cierra el Home y abre esa base de datos para editarla.
- Si la base tiene varias columnas de fecha (ej. "Inicio" y "Entrega"), la fila aparece en cada fecha con el nombre de la columna al lado.

## Atajos y gestos — resumen

| Gesto | Resultado |
|---|---|
| `Ctrl+Shift+H` | Abrir/cerrar Home |
| `Enter` en "+ Agregar tarea" | Crear tarea en ese día |
| Doble clic en día del calendario | Crear tarea ahí |
| Arrastrar tarea | Cambiar de día / a "Sin fecha" |
| Clic en tarea | Editar |
| Clic en número del día (Mes) | Ir a esa semana |
| `Escape` | Cierra el editor de tarea, o el Home |

## Dónde se guarda

En `home.json`, dentro de la carpeta de configuración de MK (en Linux: `~/.config/md-editor-local/home.json`; en la versión empaquetada AppImage, `~/.config/MK/home.json`). Es un JSON simple: podés respaldarlo copiándolo.
