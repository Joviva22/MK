# IA en la terminal (Claude Code, Gemini CLI, Codex)

**Para qué sirve:** trabajar con una IA sobre tus notas o tu código **sin salir de MK**: pedirle que resuma un apunte, corrija un texto, explique un programa o lo modifique — con el archivo ya cargado como contexto.

## Requisitos

Tener instalada al menos una de estas IAs de terminal (con tu cuenta iniciada):

| IA | Comando |
|---|---|
| Claude Code | `claude` |
| Gemini CLI | `gemini` |
| Codex | `codex` |

MK no instala nada ni maneja claves: abre la IA en su [terminal integrada](terminal.md), como si la abrieras vos.

## Cómo abrirla

| Desde | Qué pasa |
|---|---|
| **Clic derecho en un archivo** del sidebar → **🤖 Abrir con Claude Code / Gemini CLI / Codex** | Pestaña nueva de terminal (con el nombre de la IA), en la carpeta del archivo; la IA arranca con un mensaje que le presenta el archivo y espera tus instrucciones |
| **Clic derecho en una carpeta** (o la raíz) | La IA arranca en esa carpeta, sin mensaje inicial |
| Botón **IA ▾** de la barra | Lo mismo sobre el **archivo que tenés abierto** (si tiene cambios sin guardar, los guarda antes) |
| Paleta (`Ctrl+Shift+P`) → "IA: abrir …" | Igual que el botón |

## Ejemplos de pedidos

Con un apunte abierto en Claude o Gemini:

- *"Resumilo en 10 puntos."*
- *"Armá 15 tarjetas de pregunta/respuesta con formato `## Pregunta` para exportar a Anki."*
- *"Corregí la ortografía sin cambiar el estilo."*
- *"Agregá una tabla comparando los tres autores."*

Con un programa (`.py`, `.c`…):

- *"Explicame qué hace la función `calcular`."*
- *"¿Por qué falla con listas vacías? Arreglalo."*

Si la IA **modifica el archivo** mientras lo tenés abierto en MK, la pestaña se **recarga sola** (si no tenías cambios propios); si sí tenías, queda marcada con **⚠** y al guardar te pregunta qué versión dejar — nunca se pisan en silencio.

## Consejos

- Cada IA abre en **su propia pestaña**: podés tener Claude y Gemini a la vez sobre la misma nota y comparar.
- **Doble clic en el nombre** de la pestaña para renombrarla (ej. "Claude – resumen").
- Para trabajar con **varios archivos**, abrí la IA sobre la **carpeta** (clic derecho en la carpeta).
- Revisá los cambios con **🔀 Ver cambios** o el [historial de versiones](historial-y-git.md) antes de darlos por buenos.

## Límites

- Necesitan internet y tu cuenta de cada servicio (las IAs, no MK).
- Si una no está instalada, la terminal muestra `command not found`.
