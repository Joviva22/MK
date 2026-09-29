# Herramientas PDF

**Para qué sirve:** hacer lo típico con PDFs sin instalar otro programa — escribir encima, completar formularios, unir, separar, rotar, firmar, marca de agua y subrayar.

> Guía completa paso a paso: [pdf-como-usar.md](pdf-como-usar.md) · ideas de uso: [pdf-para-que-sirve.md](pdf-para-que-sirve.md).

## Operaciones de páginas (🗂)
Paleta → "Operaciones de páginas PDF...". Todo en memoria; el original no se toca.

| Acción | Cómo |
|---|---|
| Rotar | ⟲ / ⟳ por página |
| Borrar página | ✕ |
| Reordenar | Arrastrar filas |
| Unir | "Unir con otro PDF..." (se agrega al final) |
| Marca de agua | Texto → "Aplicar a todas las páginas" |
| Texto / firma | Texto + página + esquina → "Insertar" |
| Separar | Rango (`1-3,5`) → "Extraer y guardar como..." |
| Guardar | "Guardar como..." a un archivo nuevo |

## Subrayar y escribir (🖊)
Botón 🖊, paleta → "PDF: subrayar y escribir", o **clic derecho en un PDF del sidebar → "Escribir / subrayar en este PDF"**.

| Modo | Cómo |
|---|---|
| **🖍 Subrayar** | Arrastrá el mouse sobre el texto → rectángulo amarillo. "Deshacer subrayado" saca el último |
| **T Escribir** | Clic en cualquier lugar de la página → cuadro de texto; escribí (Enter = otra línea). Tamaño y color arriba (se aplican al cuadro que estás editando y a los nuevos). Moverlo: arrastrá la agarradera ⠿. Borrarlo: × (o dejarlo vacío) |

**Formularios**: si el PDF tiene campos rellenables (un formulario oficial, una solicitud), aparece a la derecha **Formulario (N campos)**: completá los textos, tildá las casillas y elegí de las listas.

**Guardar como...** arma un PDF nuevo con todo (subrayados, textos y formulario) — el original no se toca. Se llama `nombre-editado.pdf` (o `-subrayado.pdf` si solo subrayaste).

- El texto usa Helvetica: acentos, ñ, ¿¡ andan; emojis y otros alfabetos salen como "?".
- Con páginas rotadas (`/Rotate`), la posición puede desalinearse.

## Usos
- Juntar escaneos de un trámite en un solo PDF.
- Firmar un contrato con tu nombre y fecha (**Escribir**, donde va la firma).
- Completar un formulario PDF (inscripciones, trámites) sin imprimirlo.
- Agregar notas y correcciones sobre un apunte o un paper.
- Marca de agua "BORRADOR" o "CONFIDENCIAL".
- Subrayar un paper y tenerlo al lado en el [panel secundario](modos-de-vista.md) mientras resumís.

## Límites
No se edita el texto ya impreso en el PDF. El subrayado es un rectángulo (puede desalinearse en páginas rotadas).
