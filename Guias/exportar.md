# Exportar (e importar Word)

**Para qué sirve:** sacar tus notas de MK en el formato que te pidan — HTML, PDF, Word, EPUB o tarjetas de estudio — y traer documentos de Word para editarlos.

## ⬇ Exportar
| Formato | Resultado | Ideal para |
|---|---|---|
| **HTML** | Un `.html` autónomo con estilos | Publicar o compartir por web |
| **PDF** | PDF renderizado | Entregar trabajos, imprimir |
| **Word (.docx)** | `.docx` real (listas, tablas, imágenes, links) | Cuando te piden "en Word" |
| **EPUB** | Libro electrónico de la nota actual | Leer en e-reader |
| **Carpeta a EPUB (libro)** | Un capítulo por nota, portada opcional | Compilar apuntes o un libro |
| **Tarjetas Anki** | `.txt` Frente/Dorso | Estudiar con repetición espaciada |

### Anki
```markdown
## ¿Capital de Francia?
París.
```
Cada `##` es una tarjeta; el texto debajo, la respuesta. En Anki: Archivo → Importar → separador "Tabulador". Ejemplo: [`../Ejemplos/tarjetas-anki.md`](../Ejemplos/tarjetas-anki.md).

## Importar Word
Abrí un `.docx` (Abrir, sidebar o doble clic) → se convierte a Markdown en una pestaña nueva. Nunca pisa el original; para devolverlo en Word, exportá a `.docx`.

Imágenes y tablas largas se **pliegan** en el editor (`[imagen incrustada, ~106 KB]`); clic para verlas.

## Límites
Wikilinks, `#tags`, `==resaltado==`, LaTeX y Mermaid no se traducen a Word (quedan como texto). En "Carpeta a EPUB" Mermaid y resaltado de código no se dibujan.
