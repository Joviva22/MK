# PDF — cómo usarlo

Guía paso a paso de todo lo que MK hace con PDFs: **escribir encima, completar formularios, subrayar** y **operaciones de páginas** (unir, separar, rotar, marca de agua). Para ideas de *para qué* sirve cada cosa, ver [`pdf-para-que-sirve.md`](pdf-para-que-sirve.md).

> **Regla de oro:** MK nunca modifica tu PDF original. Todo termina en **"Guardar como..."**, que crea un PDF nuevo.

## Dos herramientas

| Herramienta | Botón | Para |
|---|---|---|
| **PDF: subrayar y escribir** | 🖊 en la barra, paleta → "PDF: subrayar y escribir", o **clic derecho en un PDF del sidebar → "Escribir / subrayar en este PDF"** | Escribir texto encima, completar formularios, subrayar |
| **Operaciones de páginas** | 🗂 en la barra, o paleta → "Operaciones de páginas PDF..." | Unir, separar, rotar, reordenar, borrar páginas, marca de agua, firma en una esquina |

## 1. Escribir en un PDF

1. Abrí el PDF (**Abrir PDF...**, o clic derecho en el archivo del sidebar).
2. Arriba, elegí **T Escribir**.
3. Elegí el **tamaño** de letra (8 a 32 puntos) y el **color**.
4. **Hacé clic** en la página, donde quieras que empiece el texto → aparece un cuadro con el cursor.
5. Escribí. `Enter` hace otra línea. `Escape` termina de editar.

Mientras escribís:

| Querés | Cómo |
|---|---|
| **Moverlo** | Pasá el mouse por el cuadro → arrastrá la agarradera azul **⠿** |
| **Cambiarle tamaño o color** | Hacé clic adentro del cuadro y cambiá tamaño/color arriba |
| **Borrarlo** | Botón rojo **×** del cuadro, o borrá todo su texto |
| **Editarlo después** | Clic adentro del texto |
| **Otra página** | ◀ / ▶ — lo escrito en cada página se mantiene |

La letra es **Helvetica**: acentos, ñ, ¿ ¡ y € funcionan. Los emojis y otros alfabetos (griego, chino…) salen como `?` al guardar.

## 2. Completar un formulario PDF

Si el PDF tiene **campos rellenables** (los formularios oficiales, inscripciones, solicitudes suelen tenerlos), al abrirlo aparece a la derecha el panel **Formulario (N campos)**:

- **Campos de texto** → escribí.
- **Casillas** → tildá.
- **Listas** → elegí una opción.

Al guardar, los valores quedan **dentro de los campos** del formulario (siguen siendo editables en cualquier lector de PDF).

> ¿El formulario no tiene campos rellenables (es un PDF "plano" o escaneado)? Usá **T Escribir** y escribí encima de cada línea.

## 3. Subrayar

1. Elegí **🖍 Subrayar**.
2. **Arrastrá** el mouse sobre el texto → queda un resaltado amarillo.
3. **Deshacer subrayado** quita el último de la página.

## 4. Guardar

**Guardar como...** → elegí dónde. MK arma un PDF nuevo con **todo junto**: subrayados, textos y formulario.

- Nombre sugerido: `tu-archivo-editado.pdf` (o `-subrayado.pdf` si solo subrayaste).
- Si todavía no agregaste nada, te avisa en vez de guardar una copia igual.
- Lo que no guardaste se pierde al cerrar el panel o abrir otro PDF.

## 5. Operaciones de páginas (🗂)

| Acción | Cómo |
|---|---|
| Rotar una página | ⟲ / ⟳ en su fila |
| Borrar una página | ✕ en su fila |
| Reordenar | Arrastrá las filas |
| Unir con otro PDF | **Unir con otro PDF...** (se agrega al final) |
| Marca de agua | Escribí el texto → **Aplicar a todas las páginas** |
| Texto o firma en una esquina | Texto + página + esquina → **Insertar** |
| Separar páginas | Rango (ej. `1-3,5`) → **Extraer y guardar como...** |
| Guardar todo | **Guardar como...** |

> Para escribir en un **lugar exacto** de la página, usá **T Escribir** (sección 1), que es más preciso que "Texto o firma en una esquina".

## Atajos y gestos

| Gesto | Resultado |
|---|---|
| Clic en la página (modo Escribir) | Nuevo cuadro de texto |
| Arrastrar ⠿ | Mover el texto |
| Arrastrar sobre la página (modo Subrayar) | Subrayado |
| `Escape` dentro de un cuadro | Termina de escribir |
| `Escape` fuera de un cuadro | Cierra el panel |

## Límites

- No se puede **cambiar el texto que ya viene impreso** en el PDF (un PDF guarda letras posicionadas, no texto editable). Sí se puede tapar con un subrayado o escribir al lado.
- Con páginas **rotadas** internamente (`/Rotate`), la posición de lo agregado puede quedar corrida.
- No hay firma dibujada a mano (todavía): la firma es texto.
