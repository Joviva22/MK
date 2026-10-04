# PDF — cómo usarlo

Guía paso a paso de todo lo que MK hace con PDFs: **seleccionar texto y llevarlo a apuntes, escribir encima, completar formularios, subrayar** y **operaciones de páginas** (unir, separar, rotar, marca de agua). Para ideas de *para qué* sirve cada cosa, ver [`pdf-para-que-sirve.md`](pdf-para-que-sirve.md).

> **Regla de oro:** MK nunca modifica tu PDF original. Todo termina en **"Guardar como..."**, que crea un PDF nuevo.

## Dos herramientas

| Herramienta | Botón | Para |
|---|---|---|
| **PDF: seleccionar, copiar, subrayar y escribir** | 🖊 en la barra, paleta → "PDF: seleccionar, copiar, subrayar y escribir", o **clic derecho en un PDF del sidebar → "Escribir / subrayar en este PDF"** | Seleccionar y citar texto, escribir encima, completar formularios, subrayar |
| **Operaciones de páginas** | 🗂 en la barra, o paleta → "Operaciones de páginas PDF..." | Unir, separar, rotar, reordenar, borrar páginas, marca de agua, firma en una esquina |

## 1. Escribir en un PDF

### Seleccionar texto y llevarlo a apuntes

En la herramienta 🖊, **Seleccionar** es el modo inicial. Arrastrá sobre el texto original y elegí **Copiar selección**, **Crear nota con selección** o **Añadir al final de nota abierta**. La última opción conserva todo el contenido previo de la nota Markdown activa.

Las notas reciben una cita y un enlace al PDF con su página. Al pulsarlo en el preview o en Live Preview, MK vuelve a esa página; en Live Preview, `Alt+clic` permite editar el enlace. El número corresponde a la posición de la página en el archivo, no a la numeración impresa.

Los enlaces usan una ruta absoluta local de MK (`md-local://file…#page=N`): si movés el PDF o llevás la nota a otro equipo, tendrás que actualizar la ruta. Los PDFs escaneados sin texto no permiten selección: **no hay OCR**. Seleccionar no crea subrayados ni cambia el PDF.

### Añadir texto

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
- Cerrar el panel o ir a una nota conserva las anotaciones durante la sesión. Al cambiar de PDF, MK pide confirmación si hay cambios sin guardar. Guardalos antes de cerrar la aplicación.

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
