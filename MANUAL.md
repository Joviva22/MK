# Manual de uso — MK

Guía completa de cómo usar MK. Para instalar/correr la app ver [`README.md`](./README.md); para saber qué está hecho y qué no, [`ESTADO.md`](./ESTADO.md).

> Esta guía se actualiza cada vez que se agrega una función nueva a MK — si ves algo en la app que no está acá, avisá.

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [El editor y las pestañas](#2-el-editor-y-las-pestañas)
3. [Formato Markdown](#3-formato-markdown)
4. [Fórmulas matemáticas (LaTeX)](#4-fórmulas-matemáticas-latex)
5. [Imágenes, vídeo y PDF](#5-imágenes-vídeo-y-pdf)
6. [Etiquetas y wikilinks](#6-etiquetas-y-wikilinks)
7. [El sidebar: organizar tus archivos](#7-el-sidebar-organizar-tus-archivos)
8. [Buscar cosas](#8-buscar-cosas)
9. [Historial de versiones](#9-historial-de-versiones)
10. [Modos de vista](#10-modos-de-vista)
11. [Personalizar MK](#11-personalizar-mk)
12. [Exportar](#12-exportar)
13. [Ver cambios sin guardar](#13-ver-cambios-sin-guardar)
14. [Menú contextual del editor](#14-menú-contextual-del-editor)
15. [Plugins y comunidad](#15-plugins-y-comunidad)
16. [Todos los atajos de teclado](#16-todos-los-atajos-de-teclado)

---

## 1. Primeros pasos

Al abrir MK por primera vez te encontrás con una pestaña en blanco. Tenés tres formas de empezar:

- **📁 Carpeta** (toolbar, arriba a la izquierda): abre una carpeta de tu sistema y la muestra como árbol en el panel izquierdo (el "sidebar"). Es la forma recomendada de trabajar — la mayoría de las funciones (etiquetas, backlinks, búsqueda, mover archivos) necesitan una carpeta abierta para tener sentido.
- **📄 Nuevo ▾**: crea una pestaña nueva. El desplegable trae plantillas listas — Markdown vacío, Apuntes, Documentación, Trabajo universitario, README, Fórmulas matemáticas — cada una con una estructura de encabezados típica para ese uso.
- **Abrir**: abre un único archivo (`.md`, `.markdown`, `.txt`, `.tex`, o cualquier otro con "Todos los archivos") con el diálogo nativo del sistema.

MK recuerda la última carpeta que abriste y la vuelve a mostrar automáticamente la próxima vez que abrís la app, junto con todas las pestañas que tenías abiertas (con o sin guardar).

También podés hacer doble clic en un `.md`/`.tex` desde el explorador de archivos de tu sistema para que se abra directo en MK.

## 2. El editor y las pestañas

El editor (columna del medio) es donde escribís. A la derecha se ve el **preview**: el resultado renderizado, actualizado en vivo mientras escribís.

- Podés tener **varias pestañas abiertas** a la vez (fila arriba del editor). Un punto (`●`) junto al nombre indica cambios sin guardar.
- `Ctrl+W` cierra la pestaña activa (pide confirmación si tiene cambios sin guardar). `Ctrl+Tab` / `Ctrl+Shift+Tab` cicla entre pestañas.
- **Autoguardado**: por defecto guarda cada 1 segundo, pero solo si la pestaña ya tiene una ruta en disco (una pestaña "Sin título" no se autoguarda hasta que la guardes vos una vez). Podés cambiar el intervalo o desactivarlo del todo desde ⚙ **Ajustes** → *Autoguardado*.
- Si cerrás MK con cambios sin guardar, al volver a abrirla te pregunta si querés **restaurar** esos cambios o **descartarlos** y volver a la versión guardada en disco.
- Los archivos `.tex` se abren automáticamente con resaltado de sintaxis LaTeX en vez de Markdown.

**Autocompletado**: mientras escribís, MK sugiere palabras que ya usaste antes en el mismo documento (no es un diccionario ni completa sintaxis Markdown, solo palabras repetidas). Aparece solo después de 2 letras o más, o lo podés forzar vos con `Ctrl+Space`.

**Índice del documento**: botón ☰ en la toolbar, o `Ctrl+Shift+O`. Abre un panel flotante con todos los encabezados del documento activo (organizados por nivel, H1/H2/H3); clic en uno hace scroll directo hasta ahí en el preview.

## 3. Formato Markdown

MK soporta Markdown estándar — encabezados (`#`, `##`, `###`...), **negrita** (`**texto**`), *cursiva* (`*texto*`), listas, citas (`>`), y además:

**Tablas**, con estilo automático (encabezado resaltado, filas alternadas):

```markdown
| Columna 1 | Columna 2 |
| --------- | --------- |
| dato      | dato      |
```

**Bloques de código**, con resaltado de sintaxis automático según el lenguaje:

````markdown
```js
const x = 1;
```
````

**Callouts** (recuadros destacados para notas, avisos, etc.):

```markdown
> [!NOTE]
> Esto es una nota.

> [!TIP]
> Un consejo.

> [!WARNING]
> Cuidado con esto.

> [!IMPORTANT]
> Algo importante.

> [!CAUTION]
> Algo serio.
```

Cada tipo tiene su propio color e ícono en el preview.

## 4. Fórmulas matemáticas (LaTeX)

Se renderizan con KaTeX:

- **Inline**: `$x^2 + y^2 = z^2$` → se muestra dentro del párrafo.
- **En bloque**: `$$\sum_{i=1}^n x_i$$` → se muestra centrada, más grande.

Los archivos `.tex` completos también se editan con resaltado de sintaxis LaTeX (no Markdown) — útil si estás escribiendo un documento LaTeX entero, no solo fórmulas sueltas dentro de una nota.

## 5. Imágenes, vídeo y PDF

**Imágenes**, con Markdown normal — las rutas relativas se resuelven contra la ubicación del archivo actual:

```markdown
![descripción](ruta/a/imagen.png)
```

**Vídeo y PDF embebidos**, con una sintaxis propia (dos corchetes):

```markdown
![[video.mp4]]
![[documento.pdf]]
```

**Formas de insertar estos elementos sin escribir la sintaxis a mano:**

- **Arrastrar y soltar** un archivo desde el explorador de tu sistema al editor: lo copia a una carpeta `assets/` junto al archivo actual e inserta el Markdown correspondiente automáticamente.
- **Arrastrar una fila del sidebar** (un archivo que ya está en tu carpeta abierta) directo al editor: inserta el link/embed apuntando a donde ya está el archivo, sin copiarlo de nuevo.
- Desde el [menú contextual](#14-menú-contextual-del-editor) del editor: "Insertar imagen".

**Ver una imagen o un PDF sueltos**: hacé clic en el archivo desde el sidebar (no hace falta que esté referenciado en ningún `.md`) — se muestra a pantalla completa en el panel de preview. Con un PDF podés navegarlo con el visor nativo; con una imagen, se centra y ajusta al espacio disponible.

## 6. Etiquetas y wikilinks

Pensadas para organizar y conectar notas dentro de una misma carpeta (estilo Obsidian/Roam).

**Etiquetas** — escribí `#` pegado a una palabra en cualquier parte del texto:

```markdown
Esta nota es sobre #proyecto y #urgente.
```

Se muestran como una "pill" resaltada en el preview. (Un `## Encabezado` nunca se confunde con etiqueta — el `#` de etiqueta no puede tener otro `#` justo antes.)

- **Ver todas las etiquetas de la carpeta**: botón 🏷 en la toolbar, o `Ctrl+Shift+T`. Lista cada etiqueta con cuántas veces aparece en total; hacer clic en una dispara una búsqueda global de esa etiqueta.

**Wikilinks** — enlace directo a otra nota por nombre de archivo, sin tener que escribir la ruta:

```markdown
Ver también [[Otra nota]]
[[Otra nota|con texto distinto al del link]]
```

Al hacer clic, MK busca un archivo con ese nombre en la carpeta abierta y lo abre. Si no lo encuentra, el link se marca visualmente como roto.

- **Backlinks** — "¿qué otros archivos enlazan a este?": botón 🔗 en la toolbar, o `Ctrl+Shift+B`, con el archivo que te interesa abierto y activo. Lista cada archivo que tiene un `[[Nombre]]` apuntando al actual, con la línea exacta; clic en un resultado te lleva directo ahí.

Los `#tag`/`[[wikilink]]` dentro de bloques de código (\`\`\`) o código inline (\`así\`) no se activan — se tratan como texto literal, no como etiquetas/links reales.

## 7. El sidebar: organizar tus archivos

Con una carpeta abierta, el panel izquierdo muestra el árbol de archivos:

- **Clic en una carpeta**: expande/colapsa. El ícono cambia entre carpeta cerrada y abierta.
- **Clic en un archivo**: lo abre (Markdown/LaTeX/texto en una pestaña; PDF/imagen a pantalla completa en el preview).
- **"↑ .."** arriba del todo: sube a la carpeta padre de la que tenés abierta, sin pasar por el diálogo de "Abrir carpeta".

**Clic derecho** en cualquier archivo, carpeta, o la raíz misma, abre un menú con:

- **Nuevo archivo... / Nueva carpeta...** (en carpetas y en la raíz): pide un nombre y lo crea ahí mismo.
- **Cambiar icono...**: abre un buscador sobre ~1500 íconos (los mismos [lucide](https://lucide.dev) que usa toda la app) para ese archivo en particular. "Quitar icono personalizado" vuelve al ícono automático según la extensión.
- **Renombrar...**
- **Eliminar**: pide confirmación; se manda a la papelera del sistema (se puede restaurar desde ahí) salvo que la papelera no esté disponible, en cuyo caso borra directo.

**Mover un archivo o carpeta**: arrastralo y soltalo sobre otra carpeta (o sobre la raíz, o sobre "↑ .." para subirlo un nivel). No se puede mover una carpeta dentro de sí misma.

Si renombrás o movés un archivo que tenías abierto en una pestaña, esa pestaña se actualiza sola para seguir apuntando al lugar correcto (así "Guardar" no crea un archivo viejo por error).

## 8. Buscar cosas

- **Búsqueda global** (🔍 en la toolbar, o `Ctrl+Shift+F`): busca un texto en todos los archivos de la carpeta abierta (`.md`, `.markdown`, `.txt`, `.tex`), hasta 200 resultados. Clic en un resultado abre el archivo y salta directo a esa línea.
- **Paleta de comandos** (⌘ en la toolbar, o `Ctrl+Shift+P`): lista todo lo que podés hacer en MK — nuevo, abrir, guardar, exportar, cambiar de tema, alternar vistas, ver etiquetas/backlinks/historial — con filtro por texto a medida que escribís. Navegás con las flechas y confirmás con Enter.

## 9. Historial de versiones

Cada vez que se guarda un archivo (autoguardado incluido), MK respalda el contenido *anterior* antes de pisarlo — hasta 20 versiones por archivo, guardadas fuera del proyecto (en la carpeta de configuración de la app, no junto a tus notas).

Para ver o recuperar una versión anterior: paleta de comandos → **"Ver versiones anteriores..."**. Elegís una fecha/hora de la lista y su contenido reemplaza lo que tenés en el editor (podés deshacer con `Ctrl+Z` si te arrepentís, antes de guardar).

## 10. Modos de vista

- **🎯 Modo enfoque / lectura** (botón en la toolbar, o `Ctrl+Shift+E` / `Ctrl+Shift+R`): el mismo botón cicla entre tres estados — normal, enfoque (solo editor, sin sidebar ni preview) y lectura (solo preview).
- **`F11` — pantalla completa / escritura sin distracciones**: pone la ventana en pantalla completa real y oculta la toolbar y la barra de estado, dejando solo sidebar/editor/preview según el modo en que estés. Volvés a pulsar `F11` para salir.

## 11. Personalizar MK

Desde ⚙ **Ajustes**:

- **Autoguardado**: desactivado, cada 1s, cada 5s, cada 30s.
- **Tamaño de fuente** del editor: 12 a 18px.
- **Tipografía** del editor: JetBrains Mono, Fira Code, Consolas, o la monoespaciada del sistema.
- **Ancho de tabulación**: 2, 4 u 8 espacios.
- **Ajuste de línea**: activar/desactivar el word-wrap.

Desde 🎨 **Tema**: 26 temas de color — Claro, Oscuro, y 24 más conocidos (Dracula, Nord, Gruvbox, Monokai, Solarized, One Dark Pro, Tokyo Night, Catppuccin, Rosé Pine, GitHub Dark/Light, y otros). Se guarda tu elección para la próxima vez.

Todos estos ajustes se guardan automáticamente y se recuerdan entre sesiones.

## 12. Exportar

Desde ⬇ **Exportar**:

- **A HTML**: un archivo `.html` standalone (con el CSS embebido adentro), que se puede abrir en cualquier navegador sin depender de MK.
- **A PDF**: renderizado directo a PDF.

Las fórmulas matemáticas y el resaltado de código se ven un poco distintos al exportar (una hoja de estilos simplificada, no la de la app) — es un compromiso consciente para no tener que arrastrar fuentes/librerías completas al archivo exportado.

## 13. Ver cambios sin guardar

Botón 🔀 en la toolbar: compara el contenido actual del editor contra la última versión guardada en disco de ese mismo archivo, línea por línea — verde lo agregado, rojo lo borrado. Necesita que el archivo ya tenga una versión guardada en disco con la que comparar.

## 14. Menú contextual del editor

Clic derecho dentro del editor:

- **Copiar / Cortar / Pegar / Seleccionar todo**
- **Insertar título (H2)**
- **Insertar tabla**
- **Insertar enlace**
- **Insertar imagen**
- **Insertar bloque de código**
- **Insertar cita / callout**

Cada inserción deja el cursor listo para seguir escribiendo en el lugar justo (por ejemplo, "Insertar enlace" selecciona la parte de la URL para que la pegues encima).

## 15. Plugins y comunidad

Botón 🧩 en la toolbar (o desde la paleta de comandos): por ahora es un panel informativo — MK todavía no tiene un sistema real de plugins de terceros (es una decisión de seguridad consciente: cargar código ajeno en una app con acceso a tus archivos no es algo para improvisar). El panel queda preparado para el día que eso exista, y mientras tanto lista ideas de plugins interesantes agrupadas por categoría:

- **Escritura y edición**: corrector ortográfico en español, snippets de texto (abreviaturas propias), plantillas con variables (`{{fecha}}`, `{{titulo}}`).
- **Organización y visualización**: vista de grafo de wikilinks, tablero Kanban a partir de listas de tareas, nota diaria automática.
- **Exportar e integraciones**: exportar a EPUB, sincronización con git al guardar, exportar a tarjetas de memoria (tipo Anki).
- **Para quienes programan**: diagramas como código (Mermaid/PlantUML) en el preview, ejecutar bloques de código tipo notebook.

## 16. Todos los atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+N` | Nuevo documento |
| `Ctrl+O` | Abrir archivo |
| `Ctrl+S` | Guardar |
| `Ctrl+Shift+S` | Guardar como |
| `Ctrl+W` | Cerrar pestaña activa |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Pestaña siguiente / anterior |
| `Ctrl+Shift+P` | Paleta de comandos |
| `Ctrl+Shift+F` | Búsqueda global |
| `Ctrl+Shift+T` | Etiquetas de la carpeta |
| `Ctrl+Shift+B` | Backlinks del archivo activo |
| `Ctrl+Shift+O` | Índice del documento |
| `Ctrl+Shift+E` | Modo enfoque |
| `Ctrl+Shift+R` | Modo lectura |
| `F11` | Pantalla completa / escritura sin distracciones |
| `Ctrl+Space` | Autocompletado |
| `Escape` | Cerrar el panel/menú/diálogo que esté abierto |

Estos atajos funcionan sin importar qué parte de la app tenga el foco (editor, sidebar, buscador, etc.), no solo con el cursor en el editor.
