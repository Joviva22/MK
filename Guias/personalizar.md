# Personalizar MK

**Para qué sirve:** dejar MK a tu gusto — colores, tipografía, qué botones ver y cómo se comporta.

## ⚙ Ajustes (`Ctrl+,`)
Un panel con **secciones a la izquierda** y un **buscador** arriba: escribí "tab", "correo" o "bandeja" y aparecen solo esos ajustes (sin importar tildes). `Esc` o clic afuera cierra. Todo se guarda solo al cambiarlo.

| Sección | Qué tiene |
|---|---|
| **Editor** | Autoguardado (desactivado · 1 s · 5 s · 30 s), tamaño de fuente (o `Ctrl+scroll` / `Ctrl+=` / `Ctrl+-` / `Ctrl+0`), tipografía, tabulación, ajuste de línea, snippets (`/abrev = texto`) |
| **Apariencia** | Tema · **botones de la barra**: *Mixto* (como venía), *Solo íconos* (más limpio, entra en una línea) o *Con texto* · **ocultar la barra superior** (aparece al acercar el mouse arriba; `Ctrl+Shift+M`) · qué botones mostrar (▶ los ejecuta aunque estén ocultos) |
| **Notas** | Nota diaria: carpeta, formato del nombre y plantilla. Ver [nota-diaria.md](nota-diaria.md) |
| **Home y avisos** | Abrir el Home al iniciar, guardar el Home en la carpeta (`.mk/home.json`, viaja con git), minutos de Pomodoro. El aviso "1 semana antes" se maneja arriba en el Home |
| **Correo** | Recordatorios y resumen diario por Gmail, a tu propia dirección. Ver [recordatorios.md](recordatorios.md#también-por-correo-gmail) |
| **Terminal** | Shell (del sistema, bash, zsh, fish…). Ver [terminal.md](terminal.md) |
| **Módulos** | Apagar lo que no uses: Home, bases de datos, Kanban, grafo, etiquetas y backlinks, terminal e IA, herramientas de PDF, Pomodoro, reproductor. Desaparecen de la barra, la paleta y los menús, y sus atajos no hacen nada; **no se borra ningún dato** |
| **Sistema** | Git al guardar ([historial-y-git.md](historial-y-git.md)), seguir en la bandeja al cerrar (salir: `Ctrl+Q`), iniciar MK con el sistema, versión instalada y buscar versión nueva (aviso al iniciar opcional, apagado por defecto; ver [CHANGELOG](../CHANGELOG.md)), **respaldo** exportar/importar (ver abajo) |

## La barra de estado (abajo)
De izquierda a derecha: el tipo de archivo, **✓ Guardado / ● Sin guardar** (o ⚠ si cambió afuera), la **rama de git** de la carpeta (clic: commits eligiendo archivos), **palabras y caracteres** (de la selección si seleccionaste algo) y la posición del cursor.

## La barra superior
- El botón de **modo de vista** muestra en qué modo estás (ícono y nombre: Normal, Enfoque, Lectura, Live); clic pasa al siguiente.
- Un **punto de color** junto a un archivo del sidebar = tiene cambios sin guardar.
- Al guardar con `Ctrl+S`, la pestaña hace un destello corto para confirmarlo.
- Las animaciones son cortas y se desactivan solas si tu sistema tiene "reducir movimiento".

## 🎨 Temas
27 temas: Claro, Oscuro, Dracula, Nord, Gruvbox, Monokai, Solarized, One Dark Pro, Tokyo Night, Catppuccin, Rosé Pine, GitHub...

**Tema personalizado**: paleta → "Tema personalizado..." → elegí con selector de color los 7 colores (fondo, superficie, superficie 2, texto, texto tenue, borde, acento). Se aplica en vivo; **Guardar** para dejarlo.

## Sugerencias
- Mucho tiempo escribiendo de noche: tema oscuro de bajo contraste (Nord, Rosé Pine) + fuente 15–16 px.
- Toolbar cargada: ocultá lo que no usás; todo sigue en `Ctrl+Shift+P`.
- Presentar en pantalla compartida: tema claro + `Ctrl+=` un par de veces.

Todo se guarda solo y se recuerda entre sesiones.

## Respaldo y mudanza a otra computadora

**Ajustes → Sistema → Respaldo de MK** (o la paleta: *Respaldo: exportar todo* / *Respaldo: importar…*) guarda en un solo archivo `.mkbackup`:

- todos los ajustes (tema, barra, atajos, snippets, módulos, correo sin la contraseña, estado de las mascotas…);
- las tareas del Home;
- las imágenes de las mascotas.

No incluye tus notas ni las bases de datos: son archivos de la carpeta de notas (las bases están en `<carpeta>/.mk/databases.sqlite3`) y se copian con ella. Tampoco la **contraseña del correo**, que está cifrada con el llavero de este equipo: en el otro hay que volver a escribirla en Ajustes → Correo.

Al **importar**, MK muestra qué trae el respaldo y pide confirmación; antes de reemplazar nada guarda una copia de lo que había en `~/.config/md-editor-local/backups/antes-de-importar-<fecha>.mkbackup` (si te arrepentís, importás esa). Después se recarga sola. El tamaño de la ventana de este equipo se conserva.

## Bienvenida (primer arranque)

La primera vez que se abre MK en un equipo aparece una guía de tres pasos:

1. **Qué vas a usar**: *Escribir* (notas, etiquetas y enlaces), *Escribir y planificar* (más Home, recordatorios, Kanban y Pomodoro) o *Todo*. Solo apaga módulos: se cambia cuando quieras en Ajustes → Módulos.
2. **Tus notas**: crear `~/Documentos/Notas MK` con una nota de bienvenida, elegir una carpeta propia o dejarlo para después.
3. **Tres atajos**: `Ctrl+Shift+P` (paleta), `Ctrl+,` (ajustes) y `Ctrl+P` (abrir nota por nombre).

Si ya usabas MK (tenías una carpeta abierta) no aparece. Para verla otra vez: paleta → *Bienvenida: volver a ver la guía de inicio*.

## Elegir tema

**Ajustes → Apariencia → Tema** (o la paleta: *Tema: ver la galería de temas*) muestra la **galería de temas**: una tarjeta con los colores de cada uno y, arriba, una **vista previa** de cómo se ve MK —barra, archivos, editor con Markdown y la vista con título, texto secundario, enlace y botón—. Pasá el mouse (o el foco con Tab) por una tarjeta para verlo en la muestra sin cambiar nada; clic o Enter para usarlo. La tarjeta *Personalizado…* abre el editor de colores propios. Desde la paleta también: *Tema: Nord*, etc.

