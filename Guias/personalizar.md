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
| **Sistema** | Git al guardar ([historial-y-git.md](historial-y-git.md)), seguir en la bandeja al cerrar (salir: `Ctrl+Q`), iniciar MK con el sistema |

## La barra de estado (abajo)
De izquierda a derecha: el tipo de archivo, **✓ Guardado / ● Sin guardar** (o ⚠ si cambió afuera), la **rama de git** de la carpeta (clic: commits eligiendo archivos), **palabras y caracteres** (de la selección si seleccionaste algo) y la posición del cursor.

## La barra superior
- El botón de **modo de vista** muestra en qué modo estás (ícono y nombre: Normal, Enfoque, Lectura, Live); clic pasa al siguiente.
- Un **punto de color** junto a un archivo del sidebar = tiene cambios sin guardar.
- Al guardar con `Ctrl+S`, la pestaña hace un destello corto para confirmarlo.
- Las animaciones son cortas y se desactivan solas si tu sistema tiene "reducir movimiento".

## 🎨 Temas
26 temas: Claro, Oscuro, Dracula, Nord, Gruvbox, Monokai, Solarized, One Dark Pro, Tokyo Night, Catppuccin, Rosé Pine, GitHub...

**Tema personalizado**: paleta → "Tema personalizado..." → elegí con selector de color los 7 colores (fondo, superficie, superficie 2, texto, texto tenue, borde, acento). Se aplica en vivo; **Guardar** para dejarlo.

## Sugerencias
- Mucho tiempo escribiendo de noche: tema oscuro de bajo contraste (Nord, Rosé Pine) + fuente 15–16 px.
- Toolbar cargada: ocultá lo que no usás; todo sigue en `Ctrl+Shift+P`.
- Presentar en pantalla compartida: tema claro + `Ctrl+=` un par de veces.

Todo se guarda solo y se recuerda entre sesiones.
