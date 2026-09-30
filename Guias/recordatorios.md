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

## También por correo (Gmail)

Los mismos avisos te pueden llegar **por mail** (al celular, por ejemplo), y un **resumen diario** con lo de hoy, lo atrasado y lo de los próximos 7 días.

1. En tu cuenta de Google, con la verificación en 2 pasos activada, entrá a **myaccount.google.com/apppasswords** y creá una contraseña de aplicación llamada "MK" (16 letras). *No* es tu contraseña normal y la podés revocar cuando quieras.
2. En MK: **⚙ Ajustes → Correo (Gmail)**: tildá *Mandar los recordatorios por correo*, escribí tu dirección y la contraseña de aplicación → **Guardar**.
3. **Enviar prueba**: te llega "MK: correo de prueba". Si llega, listo.
4. Opcional: **Resumen diario a las 08:00** (cambiá la hora). Si abrís MK más tarde ese día, se manda igual (una vez por día).

| Detalle | |
|---|---|
| ¿A quién se manda? | Solo **a tu propia dirección**. MK no puede mandar correo a otros |
| ¿Dónde queda la contraseña? | Cifrada con el **llavero del sistema** (KWallet en KDE, GNOME Keyring). Nunca se muestra de nuevo. Sin llavero, MK no la guarda (no en texto plano) |
| ¿Hace falta MK abierto? | Sí, abierto o en la bandeja (como los avisos de pantalla) |
| Si Gmail la rechaza | Aviso rojo "Gmail rechazó la contraseña": creá otra y guardala. **Olvidar contraseña** la borra de MK |
| Tope | Como mucho 30 correos por hora (por si algo fallara en bucle) |

> ⚠️ Nunca pegues la contraseña de aplicación en un chat, un correo o una nota: si pasó, revocala en myaccount.google.com/apppasswords y creá otra.
