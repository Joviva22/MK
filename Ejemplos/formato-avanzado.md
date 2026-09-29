# Formato avanzado

Todo lo que MK entiende además del Markdown básico. Mirá esta nota en el **preview** (a la derecha) o en **Live Preview** (`Ctrl+Shift+L`).

## Callouts

> [!NOTE]
> Una nota informativa.

> [!TIP]
> Un consejo útil.

> [!IMPORTANT]
> Algo que no hay que olvidar.

> [!WARNING]
> Cuidado con esto.

> [!CAUTION]
> Esto puede salir mal.

## Resaltar, etiquetar y enlazar

- ==Texto resaltado== con `==dos iguales==`.
- #etiquetas: clic en 🏷 (o `Ctrl+Shift+T`) para verlas todas.
- [[live-preview]]: enlace a otra nota por su nombre (clic para abrirla).

## Tareas

- [ ] Clic en la casilla del preview: cambia el `[ ]` de esta línea.
- [x] Esta ya está hecha.

## Fórmulas (LaTeX)

En línea: la ecuación cuadrática es $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.

En bloque:

$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$

## Tabla

| Ingrediente | Cantidad | Precio |
|---|---:|---:|
| Harina | 1 kg | 1,20 € |
| Huevos | 6 | 2,10 € |
| Leche | 1 l | 0,95 € |

Clic derecho **dentro** de la tabla → *Agregar columna acá*, *Agregar fila acá*, *Alinear tabla*.

## Código con resaltado

```python
def saludo(nombre):
    return f"Hola, {nombre}"
```

Guía: [`../Guias/markdown-y-formato.md`](../Guias/markdown-y-formato.md).
