# Markdown y formato

**Para qué sirve:** escribir texto con formato (títulos, listas, tablas, fórmulas, diagramas) usando solo el teclado, y que el preview lo muestre bonito.

## Lo básico

| Escribís | Resultado |
|---|---|
| `# Título`, `## Subtítulo` | Encabezados |
| `**negrita**`, `*cursiva*`, `~~tachado~~` | Formato |
| `- ítem` / `1. ítem` | Listas |
| `> cita` | Cita |
| `[texto](https://...)` | Enlace |
| `` `código` `` | Código en línea |
| `==resaltado==` | Fondo amarillo |

## Extras de MK

**Tareas clicables** — `- [ ] tarea`: en el preview el checkbox se tilda y MK reescribe la línea (`[x]`).

**Tablas** — con estilo automático. Crealas con clic derecho → *Insertar tabla* (pregunta filas/columnas).

**Callouts** — recuadros de color:
```markdown
> [!TIP]
> Un consejo.
```
Tipos: `NOTE`, `TIP`, `WARNING`, `IMPORTANT`, `CAUTION`.

**Fórmulas (LaTeX, con KaTeX)** — `$x^2$` en línea, `$$\sum_{i=1}^n x_i$$` en bloque.

**Diagramas Mermaid** — bloque ```` ```mermaid ````: flujo, secuencia, Gantt, etc. Se adaptan al tema. Ejemplos en [`../Ejemplos/diagramas-mermaid.md`](../Ejemplos/diagramas-mermaid.md).

**Ejecutar JavaScript** — bloque ```` ```js ```` → botón **▶ Ejecutar** en el preview. Muestra `console.log` y el valor de la última línea. Aislado en un Worker, corta a los 3 s.

**Código con resaltado** — ```` ```python ````, ```` ```js ````, etc.

## Para qué usar cada cosa
- **Callouts**: advertencias en documentación, "ojo en el examen" en apuntes.
- **Fórmulas**: apuntes de matemática/física (plantilla *Fórmulas matemáticas*).
- **Mermaid**: explicar procesos, cronogramas (Gantt), arquitecturas.
- **Ejecutar JS**: probar un cálculo rápido o un ejemplo de programación dentro de tus apuntes.
- **Tareas**: checklists dentro de un documento (y tablero con [Kanban](kanban.md)).

## Límites
Solo JavaScript se ejecuta (no Python ni otros). Fórmulas y código se ven algo más simples al exportar a HTML/PDF.
