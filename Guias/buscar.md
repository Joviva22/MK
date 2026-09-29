# Buscar cosas

**Para qué sirve:** encontrar al instante un texto, un archivo o un comando, aunque tengas cientos de notas.

| Herramienta | Atajo | Busca en | Ideal para |
|---|---|---|---|
| **Buscar y reemplazar** | `Ctrl+F` | El archivo actual | Corregir un nombre en todo el documento |
| **Búsqueda global** | `Ctrl+Shift+F` | Todo el texto de la carpeta | "¿Dónde anoté lo de...?" |
| **Abrir rápido** | `Ctrl+P` | Nombres de archivo | Saltar a una nota que sabés cómo se llama |
| **Paleta de comandos** | `Ctrl+Shift+P` | Acciones de MK | Usar una función sin buscar el botón |
| **Etiquetas** | `Ctrl+Shift+T` | `#etiquetas` de la carpeta | Ver todo lo marcado `#urgente` |
| **Backlinks** | `Ctrl+Shift+B` | Quién enlaza a la nota actual | Contexto de una nota |

## Detalles
- `Ctrl+F`: `Enter`/`Shift+Enter` siguiente/anterior; ⇄ abre reemplazar ("Reemplazar" o "Todo"). Funciona también en modo lectura. Si había texto seleccionado, arranca buscándolo.
- Búsqueda global: hasta 200 resultados en `.md`, `.txt`, `.tex`; clic abre el archivo en esa línea. Además busca en **Tareas del Home** (título y notas; clic abre el Home en esa semana con la tarea en edición) y en **Bases de datos** (cualquier campo, incluidas las etiquetas de selección; clic abre la base ya filtrada). Los resultados salen en tres secciones.
- `Ctrl+P`: `↑`/`↓` y `Enter`.
- **Rápida aunque tengas miles de notas**: MK guarda un índice en memoria de la carpeta abierta y solo relee lo que cambió (lo que guardás, o lo que cambia afuera: git, otra app, una IA). La primera búsqueda lee todo; las siguientes son casi instantáneas. Lo mismo vale para etiquetas, backlinks, grafo, Kanban de carpeta y tareas 📅 del Home.

## Límites
La búsqueda global no reemplaza. Solo mira `.md`, `.markdown`, `.txt` y `.tex`, y salta carpetas ocultas (`.git`, `.mk`). En bases de datos no busca dentro de fórmulas ni rollups (se calculan al abrir la base).
