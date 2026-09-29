# Recordatorios

**Para qué sirve:** que MK te avise antes de que se te pase algo — el mismo día, a la hora exacta o **días antes** ("faltan 3 días para…") — tanto para tareas del [Home](home-como-usar.md) como para fechas de tus [bases de datos](bases-de-datos-como-usar.md).

## Cuatro tipos de aviso

| Aviso | Dónde se configura | Ejemplo de notificación |
|---|---|---|
| **A la hora / minutos antes** | Editor de tarea → **Hora** + **Aviso (según la hora)** | 🔔 *En 15 min: Dentista* |
| **Días antes** (anticipado) | Editor de tarea → **Avisos anticipados → + Agregar aviso** | 🔔 *Faltan 3 días para Entregar TP* — *Viernes, 2 de octubre a las 18:30* |
| **Fechas de una base de datos** | Base de datos → clic en el encabezado de una columna **Fecha** → Editar columna → **Avisos** | 🔔 *Mañana: Informe final* — *Base de datos: Proyectos · Entrega* |
| **1 semana antes (automático)** | Nada: viene activado. Se apaga o se cambia la hora arriba en el Home: **🔔 1 semana antes, a las 09:00** | 🔔 *Falta 1 semana para Examen final* |

**1 semana antes, automático:** todo lo que tenga fecha —tareas del Home, tareas `📅` de tus notas y fechas de bases de datos (si están visibles en el Home)— te avisa 7 días antes, sin configurar nada tarea por tarea. No avisa dos veces si la tarea ya tiene su propio aviso de 7 días, ni en tareas recurrentes (una diaria avisaría todos los días). Si ese día abrís MK después de la hora, el aviso igual sale (no se pierde). Desde el aviso, **✓ Hecho** tilda también las tareas de notas (reescribe `- [ ]` → `- [x]` en el archivo).

## Paso a paso: "tengo que entregar algo el jueves a las 8"

1. **Home** (`Ctrl+Shift+H`) → vista Semana → en el **jueves** escribí la tarea y `Enter`.
2. Clic en la tarea:
   - **Hora**: `08:00`.
   - **Aviso (según la hora)**: *1 hora antes* → te avisa el jueves 7:00.
   - **Avisos anticipados → + Agregar aviso**: *3 días antes* a las *09:00*; otro: *1 día antes* a las *20:00*.
3. **Guardar**. La tarjeta muestra 🔔.

Vas a recibir: el lunes 9:00 *"Faltan 3 días para…"*, el miércoles 20:00 *"Mañana: …"* y el jueves 7:00 *"En 60 min: …"*.

## Cuando suena

Aparece la **notificación del sistema** y además una **tarjeta abajo a la derecha de MK**:

> 🔔 **Hoy a las 18:30: Entregar TP de Historia**
> Martes, 29 de septiembre a las 18:30
> **✓ Hecho** · Posponer: **10 min** · **1 hora** · **Mañana 9:00** · ✕

| Botón | Qué hace |
|---|---|
| **✓ Hecho** | Tilda la tarea (o marca la casilla de la fila de la base de datos) |
| **10 min / 1 hora / Mañana 9:00** | Vuelve a avisar más tarde, marcado *"(pospuesto)"* — se guarda aunque cierres MK |
| **✕** | Descarta la tarjeta |
| Clic en el título o en la notificación | Trae MK al frente y abre la tarea o la base |

(Los botones van en la tarjeta de MK porque en Linux las notificaciones del sistema no admiten botones.)

## ¿Tiene que estar MK abierto?

- MK revisa los avisos **cada 30 segundos**, aunque el Home esté cerrado.
- **Cerrar la ventana no cierra MK**: queda en la **bandeja del sistema** (ícono junto al reloj) y los avisos siguen sonando. Para salir de verdad: `Ctrl+Q` o menú de la bandeja → **Salir de MK**.
- **⚙ Ajustes → "Iniciar MK con el sistema"**: arranca oculto en la bandeja al iniciar sesión, así los avisos suenan aunque no lo abras.
- Si MK estaba **cerrado del todo** a la hora de un aviso, al abrirlo te avisa solo si pasaron menos de 10 minutos (los viejos se descartan para no llenarte de notificaciones). Los **pospuestos** sí suenan siempre al abrir.

## Detalles

- Una tarea **tildada** no avisa. En las **recurrentes**, avisa antes de cada repetición.
- En las bases de datos, si la base tiene una columna **Casilla** y la fila está marcada, no avisa.
- Los avisos anticipados miran hasta **30 días** hacia adelante.

## Próximamente

Avisos también **por Gmail** y un resumen diario por correo (está en [`OBJETIVOS.md`](../OBJETIVOS.md)).
