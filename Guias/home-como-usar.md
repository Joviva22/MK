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
6. **Editarla**: clic en la tarea → se abre el editor (ver abajo).
7. **Renombrarla rápido**: doble clic en el título → escribí → `Enter` (`Escape` cancela).

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
| **Fecha** | Cambiarla a mano; vaciarla la manda a "Sin fecha" (en una recurrente se llama **Empieza**) |
| **Hora** | Opcional. Las tareas con hora se ordenan por hora dentro del día y la muestran en azul |
| **Aviso** | Notificación del sistema: a la hora, o 5 / 15 / 30 / 60 min antes (necesita hora) |
| **Repetir** | Todos los días · Días hábiles · Semanal (elegís los días) · Mensual · Anual |
| **Hasta** | Último día de la repetición (vacío = para siempre) |
| **Prioridad** | Alta / Media / Baja — define el color y el orden dentro del día |
| **Notas** | Detalle libre; se ve al pasar el mouse sobre la tarea |

Botones: **Guardar**, **Cancelar** (o `Escape`), **Eliminar** (pide confirmación) y **→ Mañana** (la pasa a mañana; en una recurrente, solo ese día). En **Atrasadas** también está **A mañana**, para mover todas juntas.

## Tareas recurrentes 🔁

Para hábitos y tareas fijas (gimnasio lunes y jueves, pagar el alquiler cada mes, repasar todos los días):

1. Creá la tarea en el primer día en que va a ocurrir.
2. Clic en ella → **Repetir** → elegí la frecuencia. En **Semanal** tildá los días (Lun … Dom).
3. Opcional: **Hasta** para que termine en una fecha.
4. **Guardar**. Aparece con 🔁 en todos los días que corresponde, en la semana y en el calendario.

Cómo se comporta:

- **Tildar** marca solo *ese día* como hecho; las demás repeticiones siguen pendientes.
- **Editar** (título, hora, prioridad, notas, frecuencia) cambia *toda la serie*.
- **Arrastrar** una repetición a otro día mueve solo ese día: se separa de la serie como tarea común.
- **Eliminar este día** saca solo esa repetición; **Eliminar serie** borra todas.
- Las repeticiones pasadas sin tildar no cuentan como **Atrasadas** (si no, una tarea diaria llenaría la lista).

## Recordatorios 🔔

**Aviso del mismo día (según la hora de la tarea):**

1. Poné una **Hora** en la tarea.
2. Elegí **Aviso (según la hora)**: a la hora, o unos minutos antes.
3. A esa hora aparece una notificación del sistema con el título (clic → abre el Home).

**Aviso automático 1 semana antes:** arriba en el Home, **🔔 1 semana antes, a las 09:00** (activado por defecto) avisa de todo lo que tenga fecha —tareas del Home salvo las recurrentes, tareas 📅 de notas y fechas de bases de datos— 7 días antes. Destildalo para apagarlo o cambiá la hora. Ver [recordatorios.md](recordatorios.md).

**Avisos anticipados ("faltan N días"):**

1. En el editor de la tarea, **Avisos anticipados → + Agregar aviso**.
2. Elegí cuántos días antes (el mismo día, 1, 2, 3, 5 días, **1 semana**, **2 semanas** o **1 mes**) y **a qué hora** te avisa ese día. Atajo: **+ 1 semana antes** agrega directo "1 semana antes, a las 09:00".
3. Podés poner varios: por ejemplo *7 días antes a las 09:00*, *3 días antes a las 09:00* y *1 día antes a las 20:00*.

La notificación dice qué y cuándo:

> 🔔 **Faltan 3 días para Entregar TP**
> Viernes, 2 de octubre a las 18:30

(1 día antes dice *"Mañana: …"* y el mismo día *"Hoy a las 18:30: …"*). No hace falta que la tarea tenga hora: sin hora, el aviso muestra solo el día. La tarjeta muestra 🔔 si tiene algún aviso.

- Funcionan con MK abierto, **aunque el Home esté cerrado** (MK revisa cada 30 segundos).
- **Y con la ventana cerrada**: cerrar MK lo deja en la **bandeja del sistema** (ícono de MK junto al reloj) y los avisos siguen sonando. Para salir de verdad: `Ctrl+Q` o clic derecho en el ícono de la bandeja → **Salir de MK**. Se desactiva en ⚙ Ajustes → "Al cerrar, seguir en la bandeja".
- **Iniciar con el sistema**: ⚙ Ajustes → "Iniciar MK con el sistema (en la bandeja)". MK arranca oculto al iniciar sesión, así los avisos suenan aunque no lo abras. Para verlo: clic en el ícono de la bandeja, o abrí MK normalmente.
- Si MK estaba **cerrado del todo** (con `Ctrl+Q`) a la hora del aviso, al abrirlo te avisa solo si pasaron menos de 10 minutos; los más viejos se descartan para no llenarte de notificaciones.
- Una tarea ya tildada no avisa. En una recurrente, avisa antes de cada repetición.

**Cuando suena un aviso**, además de la notificación del sistema aparece una tarjeta abajo a la derecha de MK:

> 🔔 **Hoy a las 18:30: Entregar TP de Historia**
> Martes, 29 de septiembre a las 18:30
> **✓ Hecho** · Posponer: **10 min** · **1 hora** · **Mañana 9:00** · ✕

- **✓ Hecho**: tilda la tarea (o marca la casilla de la fila, si viene de una base de datos).
- **Posponer**: vuelve a avisar en 10 minutos, 1 hora o mañana a las 9:00, marcado *"(pospuesto)"*. Se guarda: si cerrás MK y lo abrís después de esa hora, te avisa al abrir.
- **✕**: descarta la tarjeta. Clic en el título (o en la notificación del sistema) trae MK al frente y abre el Home o la base de datos.

Las notificaciones del sistema en Linux no permiten botones, por eso las acciones están en la tarjeta de MK.
- Mismos avisos para filas de [bases de datos](bases-de-datos-como-usar.md#avisos-en-columnas-fecha) con fecha.

## El panel lateral

Todo lo del panel lateral depende del período que estés mirando: los objetivos y notas de la *semana 40* son distintos de los de la *semana 41*, y los del *mes de septiembre* distintos de los de *octubre*.

- **Progreso**: barra con `X de Y tareas hechas (Z%)` del período visible.
- **Objetivos**: metas de la semana o del mes (no son tareas con día, son "lo que quiero lograr"). Escribí en "+ Agregar objetivo" y `Enter`; tildalos al cumplirlos; **×** para borrarlos.
- **Notas**: texto libre del período (reflexión, ideas, pendientes sueltos). Se guarda solo mientras escribís.
- **Atrasadas**: aparece solo si hay tareas sin terminar con fecha anterior a hoy. **"Pasar a hoy"** las mueve todas a hoy de un clic.
- **Sin fecha**: bandeja de tareas sin día asignado. Agregalas con "+ Tarea sin fecha", y **arrastralas a un día** cuando decidas cuándo hacerlas. También podés arrastrar una tarea de un día hasta acá para "desprogramarla".

## Tareas escritas en tus notas 📅

Cualquier tarea de una nota `.md` de la carpeta abierta con una fecha así:

```markdown
- [ ] Entregar TP de Historia 📅 2026-10-01
```

aparece ese día en el Home (chip con 📄), con el header **"Tareas de notas"** tildado.

- **Tildarla** desde el Home escribe `[x]` en la línea real del archivo (si está abierto en el editor, cambia el editor y lo guarda el autoguardado).
- **Arrastrarla a otro día** cambia su `📅 fecha` en el archivo. Soltarla en **Sin fecha** le saca la fecha (deja de aparecer en el Home).
- **Clic en el texto** abre la nota.
- Vale en cualquier nivel de lista (`-` o `*`, con sangría). El emoji 📅 se escribe con el selector de emojis del sistema (en Linux suele ser `Ctrl+.` o `Super+.`), o copiándolo de acá.

## Nota enlazada a una tarea

En el editor de tarea, **Nota enlazada**: escribí el nombre de una nota de la carpeta (se autocompleta). La tarea muestra un 📄: clic abre esa nota. Ideal para "Estudiar Álgebra" → nota `Algebra-resumen`.

## Pomodoro sobre una tarea 🍅

En el editor de tarea, **⏱ Pomodoro** arranca un foco con esa tarea: la barra de estado muestra `🍅 Foco 24:59 · Título`. Al terminar cada foco suma un 🍅 a la tarea y te pregunta si la terminaste — si decís que sí, se tilda sola.

## Plan de hoy → nota diaria 📝

Botón **"Plan de hoy → nota diaria"** en el panel lateral: abre (o crea) la [nota diaria](nota-diaria.md) y agrega una sección `## Plan del día` con todas las tareas de hoy como checklist (con hora, las de tus notas y las de bases de datos). Si lo apretás de nuevo, solo agrega lo que falta — no duplica.

## Integración con Bases de datos

Con una carpeta abierta y **"Fechas de bases de datos"** tildado, cada fila de una base de datos que tenga una columna de tipo **Fecha** aparece en ese día como un chip con borde punteado (`▤ Nombre de la fila`).

- **Arrastrala a otro día** para cambiar su fecha en la base (soltarla en **Sin fecha** la vacía). Para editar el resto de sus campos, clic en ella.
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
| Doble clic en el título | Renombrar en el lugar |
| Clic en tarea | Editar (hora, aviso, repetición, prioridad, notas, nota enlazada, ⏱ Pomodoro) |
| Clic en número del día (Mes) | Ir a esa semana |
| `Escape` | Cierra el editor de tarea, o el Home |

## Estadísticas 📈

Botón **📈** en la cabecera del Home:

- **Esta semana** y **Este mes**: tareas hechas de las planificadas (con %).
- **Racha**: días seguidos (hasta hoy) con al menos una tarea hecha.
- **Atrasadas**: cuántas quedaron sin hacer.
- **Tareas hechas por semana** (últimas 8) y **Pendientes por prioridad** (con los mismos colores que las tarjetas).
- **Hábitos**: cada tarea recurrente con su racha 🔥 (veces seguidas que la cumpliste) y el cumplimiento de los últimos 30 días.

`Escape` o × lo cierra.

## Dónde se guarda

Por defecto en `home.json`, dentro de la carpeta de configuración de MK: `~/.config/md-editor-local/home.json` (la misma para la versión de desarrollo y el AppImage). Es un JSON simple: podés respaldarlo copiándolo.

**Guardarlo en tu carpeta de notas** — ⚙ Ajustes → **"Guardar el Home en la carpeta abierta (.mk/)"**:

- Las tareas pasan a `<tu carpeta>/.mk/home.json`: **viajan con git** y con tus copias de seguridad, y se sincronizan entre computadoras si sincronizás la carpeta.
- La primera vez, la carpeta arranca con las tareas que ya tenías.
- **Cada carpeta tiene su propio Home**: al abrir otra carpeta, el Home muestra las tareas de esa.
- Al desactivarlo, las tareas vuelven a la configuración de la app tal como estaban.
