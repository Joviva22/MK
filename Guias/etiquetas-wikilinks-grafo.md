# Etiquetas, wikilinks, backlinks y grafo

**Para qué sirve:** convertir notas sueltas en una **red de conocimiento** — clasificarlas con etiquetas, enlazarlas entre sí y ver el mapa de conexiones (estilo Obsidian).

## Etiquetas
- Escribí `#proyecto`, `#urgente` en cualquier parte del texto.
- `Ctrl+Shift+T`: todas las etiquetas de la carpeta con su cantidad; clic → búsqueda global de esa etiqueta.

## Wikilinks
```markdown
Ver [[Otra nota]]
[[Otra nota|texto distinto]]
```
Clic → abre la nota por nombre (sin ruta). Si no existe, el enlace se ve roto.

## Backlinks
`Ctrl+Shift+B` con una nota abierta: qué otras notas la enlazan, con la línea exacta.

## Grafo de notas
Paleta → **"Ver grafo de notas"**. Cada nota es un punto; cada `[[enlace]]` **o link Markdown a otra nota** (`[texto](otra.md)`), una línea. Las notas con más enlaces se ven más grandes.
- Rueda: zoom · arrastrar fondo: mover · arrastrar nodo: reacomodar (se recuerda) · clic: abrir.
- **Pasar el mouse** por una nota resalta sus vecinas y atenúa el resto.
- **Clic derecho** en una nota: *Abrir*, *Abrir en el panel secundario*, *Ver backlinks*, *Solo esta y sus vecinas* (`Esc` vuelve a todas).
- Arriba: **buscar** (resalta; `Enter` abre la primera), filtrar por **#etiqueta** o por **carpeta**, y **ocultar las notas sin enlaces**.

## Cómo usarlo bien
- **Notas índice (MOC)**: una nota "Álgebra" que enlaza a todos los temas de la materia.
- **Etiquetas para estado/tipo** (`#pendiente`, `#idea`, `#resumen`), **wikilinks para relaciones de contenido**.
- Revisá los **backlinks** antes de escribir sobre un tema: quizás ya escribiste algo.
- El grafo muestra notas **huérfanas** (sin enlaces): buen momento para conectarlas.

Ejemplo con datos: `Ejemplos/grafo-*.md`.

## Límites
`#tag` y `[[link]]` dentro de código no cuentan. El zoom del grafo no se guarda.
