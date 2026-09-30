# Mascota

**Para qué sirve:** un compañero que camina al pie de la ventana y **crece con lo que hacés**: cada tarea que tildás y cada Pomodoro que terminás le dan experiencia, sube de nivel y **evoluciona**. Una forma simpática de ver tu avance (y de acordarte de las atrasadas: se pone triste).

## Activarla
⚙ Ajustes (`Ctrl+,`) → **Mascota** → *Mostrar la mascota*. Ahí también elegís especie, nombre y dónde camina.

## Especies
Criaturas propias de MK, cada una con 3 etapas:

| Especie | Etapa 1 | Etapa 2 (nivel 5) | Etapa 3 (nivel 10) |
|---|---|---|---|
| 🔥 Fuego | Chispi | Chispón | Brasadrake |
| 💧 Agua | Gotín | Olaquín | Marejón |
| 🌱 Planta | Brotito | Hojarín | Robleón |
| 🎮 De un juego (RPG Maker) | los personajes del juego, con su línea evolutiva | | |
| 🖼 Imágenes propias | tus imágenes | | |

Cambiar de especie **conserva el nivel**.

## Cómo gana experiencia

| Qué hacés | XP |
|---|---|
| Tildar una tarea del Home o una tarea `📅` de una nota | +10 (una vez por tarea y día: tildar y destildar no suma de nuevo) |
| Terminar un Pomodoro de foco | +25 |
| Darle de comer (🍖 en su tarjeta) | +2, una vez por día |

Nivel = 1 + √(XP ÷ 15): el nivel 5 llega con unas 24 tareas; el 10, con unas 120. Al subir de nivel te lo dice; al **evolucionar** brilla, cambia de forma y te llega una notificación.

## Jugar con ella
- **Clic**: corazones y su tarjeta (nivel, barra de experiencia, cuándo evoluciona, ánimo, botones Dar de comer / Pelota).
- **Doble clic**: le tirás la **pelota** y corre a buscarla.
- Si pasás mucho rato sin tocarla, **se duerme**.
- **Ánimo**: contenta, o 😟 *preocupada* si tenés tareas atrasadas (Home o notas). Se le pasa cuando las ponés al día.

## Dónde camina
- **Al pie del sidebar** (por defecto): no tapa el texto; el árbol de archivos deja lugar abajo.
- **Por toda la ventana**: camina por el borde inferior, sobre el editor.

## Personajes de un juego (RPG Maker / Pokémon Essentials)
Si tenés un juego hecho con RPG Maker (por ejemplo un fan-game de Pokémon con Essentials), MK puede usar sus personajes:

1. ⚙ Ajustes → **Mascota** → Especie **De un juego (RPG Maker)…**. Si la carpeta `Graphics/Characters` está en Descargas/Documentos, MK **la encuentra sola**; si no, **Elegir carpeta…**.
2. Buscá una criatura (*charmander*, *eevee*…). Si el juego trae `PBS/pokemon.txt`, cada opción es una **línea evolutiva** (Charmander → Charmeleon → Charizard; las ramas salen por separado: Eevee → Vaporeon, Eevee → Jolteon…).
3. Clic en la línea: la mascota pasa a ser esa criatura y **camina con la animación del juego** (de frente cuando está quieta, de costado al caminar). Evoluciona en los niveles 5 y 10 como siempre; si la línea tiene 2 etapas, la última se repite.

MK copia **solo esos 3 sprites** a `~/.config/md-editor-local/pet/` (nada va al repositorio ni a tus notas). Son del juego y de sus dueños: para tu uso personal.

## Personalizada: tus propias imágenes
Especie **Imágenes propias** → **Etapa 1… / Etapa 2… / Etapa 3…** y elegí una imagen para cada etapa (PNG, **GIF animado**, WebP, JPG o SVG; hasta 5 MB). Si falta una etapa, usa la anterior. Queda mejor si mira **hacia la derecha** (MK la da vuelta al caminar para el otro lado) y con fondo transparente.

Las imágenes se copian a `~/.config/md-editor-local/pet/`: quedan **solo en tu computadora**, no en tus notas ni en el repositorio. MK no trae ni descarga personajes de otras marcas (Pokémon, Digimon…): si usás imágenes así, es para tu uso personal y bajo tu responsabilidad.

## Límites
- Una mascota a la vez.
- Las tareas de bases de datos (casilla "Hecha") todavía no dan experiencia.
