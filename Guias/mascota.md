# Mascotas

**Para qué sirven:** un equipo de criaturas que camina al pie de la ventana y **crece con lo que hacés**: cada tarea que tildás y cada Pomodoro que terminás les dan experiencia; suben de nivel, **evolucionan**, encuentran **huevos** con criaturas nuevas y, con constancia, **legendarias**. Se ponen tristes si tenés tareas atrasadas.

## Empezar
⚙ Ajustes (`Ctrl+,`) → **Mascota**. Arrancás con una; el resto se consigue jugando. **🐾 Mis mascotas** (en Ajustes, en la tarjeta de una mascota o en la paleta de comandos) abre tu colección.

## Cómo ganan experiencia

| Qué hacés | XP |
|---|---|
| Tildar una tarea del Home, una tarea `📅` de una nota o una **casilla de una fila de base de datos** | +10 a cada mascota del equipo (una vez por tarea/fila y día: tildar y destildar no suma de nuevo) |
| Terminar un Pomodoro de foco | +25 a cada mascota del equipo |
| Darle de comer (🍖 en su tarjeta) | +2, una vez por día y mascota |

Los **huevos** que tengas se incuban con esa misma experiencia. **Ocultas** (Ajustes → *Mostrar las mascotas* apagado) no pierden nada: **siguen ganando** experiencia, incubando y sumando logros.

Nivel = 1 + √(XP ÷ 15): el nivel 5 llega con unas 24 tareas; el 10, con unas 120. Evolucionan en el **nivel 5** y en el **10**.

## Equipo y colección
- Hasta **3 mascotas caminan juntas** (el equipo); la primera es la **líder** 👑. Las demás descansan en la colección 💤 (y no ganan experiencia hasta que vuelvan al equipo).
- En **🐾 Mis mascotas**: *Al equipo* / *Descansar*, *👑 Líder*, *Nombre*. Arriba ves cuántas tenés y cuántas criaturas de MK (y del juego) descubriste.

## Huevos 🥚
**Cada vez que una mascota evoluciona** (a la etapa 2 y a la 3) encuentra un huevo con una criatura **que todavía no tenés**. Nace a los **60 XP**; si hay lugar, se suma al equipo sola.

## Legendarias 🌟
No salen de evoluciones: se ganan con **logros**, y cada logro da un **huevo legendario** (nace a los **150 XP**):

| Logro | Qué pide |
|---|---|
| 🏆 Constancia | 7 días seguidos con al menos una tarea tildada |
| 🏆 Concentración | 50 Pomodoros terminados |
| 🏆 Incansable | 200 tareas tildadas |
| 🏆 Maestría | 3 mascotas en su etapa final |

El progreso de cada logro está en **🐾 Mis mascotas**. Las legendarias no evolucionan, son más grandes y brillan.

## Criaturas de MK
Siete líneas de 3 etapas y cuatro legendarias, todas propias:

| Tipo | Etapa 1 | Etapa 2 | Etapa 3 |
|---|---|---|---|
| 🔥 Fuego | Chispi | Chispón | Brasadrake |
| 💧 Agua | Gotín | Olaquín | Marejón |
| 🌱 Planta | Brotito | Hojarín | Robleón |
| ⚡ Eléctrico | Voltín | Voltarón | Tronador |
| ❄ Hielo | Copito | Escarchín | Glaciarca |
| 🪨 Roca | Guijarro | Peñasco | Montarón |
| 👻 Fantasma | Sombrín | Espectrín | Umbralord |
| 🌟 Legendarias | Aurorix (luz) · Tempusio (tiempo) · Titanor (tierra) · Nebulia (cosmos) | | |

## Personajes de un juego (RPG Maker / Pokémon Essentials)
- **Apariencia de la líder → De un juego (RPG Maker)…**: MK encuentra sola la carpeta `Graphics/Characters` si está en Descargas/Documentos (o **Elegir carpeta…**). Buscá una criatura (*charmander*, *eevee*…) y tu líder pasa a ser esa línea evolutiva (desde `PBS/pokemon.txt`; las ramas salen por separado), **conservando su nivel**. Camina con la animación del juego.
- **Origen de las crías → Del juego**: los huevos traen criaturas del juego; los **legendarios** salen de las marcadas como legendarias o singulares en su `PBS`.

MK copia solo los sprites de cada mascota a `~/.config/md-editor-local/pet/` (nada va a tus notas ni al repositorio). Son del juego y de sus dueños: para tu uso personal.

## Imágenes propias
**Apariencia de la líder → Imágenes propias** → **Etapa 1… / 2… / 3…** (PNG, **GIF animado**, WebP, JPG o SVG; hasta 5 MB). Si falta una etapa, usa la anterior. Mejor si mira **hacia la derecha** y con fondo transparente.

## Jugar con ellas
- **Clic**: corazones y su tarjeta (nivel, experiencia, cuándo evoluciona, ánimo, 🍖 Comer, ⚾ Pelota, 🐾 Mis mascotas).
- **Doble clic**: pelota; la busca la que esté más cerca.
- Sin tocarlas 10 minutos, **se duermen**. Con tareas atrasadas, 😟.
- **Dónde caminan**: al pie del sidebar (no tapan el texto) o por toda la ventana.

## Empezar de cero
Ajustes → Mascota → **Empezar de cero…** borra mascotas, huevos y logros (pide confirmación).

## Guiño a Kingdom Hearts: keyblades y Lucky Emblems

Con una imagen tuya de keyblades (un PNG con fondo transparente, una al lado de la otra, como `keyblades.png`), MK arma un **llavero**: **Ajustes → Apariencia → 🗝 Keyblades** → *Usar keyblades.png de Descargas* (si la encuentra) o *Elegir imagen…*. Se recorta sola y se copia **solo a tu configuración**: el arte es de Square Enix/Disney y no va al repositorio.

- **Llavero**: la primera keyblade es de regalo; las demás se desbloquean con hitos: 10 tareas, racha de 7 días, 25 Pomodoros, 100 tareas, racha de 30 días, 250 tareas, 100 Pomodoros, 500 tareas (y una más cada 250). Cuando ganás una aparece un aviso. Clic en una desbloqueada para **equiparla**. También se ve en la colección de mascotas.
- **La mascota la lleva**: la equipada acompaña a tu mascota principal.
- **Golpe al tildar**: al completar una tarea (Home, notas, bases de datos), un tajo corto con destello donde hiciste clic.
- **Cursor keyblade**: el puntero es la keyblade equipada, en diagonal como una flecha (dentro del texto sigue el cursor de escribir).
- **Tema Kingdom Hearts** (🎨 Tema): azul noche y dorado, con la keyblade equipada de marca de agua en el panel de archivos. Al elegirlo aparece un **Lucky Emblem**; y mientras lo tengas puesto hay **uno chiquito escondido** en algún lugar de la ventana (cambia de sitio cada vez que abrís MK). Si lo encontrás y le hacés clic, suma a tu cuenta.

Todo se prende y apaga por separado en Ajustes → Apariencia.

