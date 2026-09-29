# Editor y pestañas

**Para qué sirve:** escribir cómodo y rápido — varias notas abiertas a la vez, sin perder nada, con ayudas de escritura.

## Pestañas
- Varias abiertas a la vez; `●` junto al nombre = cambios sin guardar.
- `Ctrl+Tab` / `Ctrl+Shift+Tab`: siguiente / anterior. `Ctrl+W`: cerrar (pide confirmar si hay cambios).
- Si MK se cierra con cambios sin guardar, al reabrir te ofrece **restaurar** o **descartar**.

## Guardado
- `Ctrl+S` guardar, `Ctrl+Shift+S` guardar como.
- **Autoguardado** cada 1 s por defecto (⚙ Ajustes para cambiarlo o apagarlo). Solo en pestañas que ya tienen archivo en disco.
- Cada guardado respalda la versión anterior → [historial-y-git.md](historial-y-git.md).

## Ayudas de escritura

| Función | Cómo |
|---|---|
| **Autocompletado** | Sugiere palabras ya usadas en el documento (2+ letras, o `Ctrl+Space`) |
| **Corrector ortográfico** | Subrayado rojo; clic derecho → sugerencias o "Agregar al diccionario" |
| **Snippets** | `/fecha`, `/hora` + espacio/Enter/Tab. Propios en ⚙ Ajustes: `/firma = Saludos, Juli` |
| **Índice del documento** | `Ctrl+Shift+O`: lista de encabezados, clic para saltar |
| **Menú contextual** | Clic derecho: insertar título, tabla, enlace, imagen, código, callout, resaltar |
| **Editar tablas** | Clic derecho *dentro* de una tabla: agregar columna/fila, alinear |
| **Tamaño de fuente** | `Ctrl+scroll`, `Ctrl+=`, `Ctrl+-`, `Ctrl+0` |

## Archivos de código
`.c`, `.cpp`, `.java`, `.py`, `.sh`, `.tex` se abren con su resaltado propio; en código el preview se oculta y el editor usa todo el ancho.

## Usos típicos
- Tomar apuntes en clase con `/fecha` y la plantilla *Apuntes*.
- Tener el enunciado en una pestaña y tu respuesta en otra (`Ctrl+Tab`), o mejor, en el [panel secundario](modos-de-vista.md).
- Firmas o textos repetidos como snippets.

## Límites
Checkbox clicable solo en el preview, no en el editor. Autocompletado no es diccionario: solo palabras del mismo documento.
