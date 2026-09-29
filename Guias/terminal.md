# Terminal integrada

**Para qué sirve:** usar la terminal sin salir de MK — correr `git`, `npm`, scripts, compilar un `.c` o un `.py` que estás escribiendo, instalar paquetes — igual que la terminal de VS Code.

## Abrir y cerrar

| Cómo | Qué hace |
|---|---|
| `` Ctrl+` `` (o `Ctrl+Ñ` en teclado español) | Muestra / oculta el panel |
| Botón de terminal en la toolbar | Igual |
| Paleta → "Terminal: mostrar/ocultar" o "Terminal: nueva terminal" | Igual / abre otra |
| **✕** del panel | Oculta el panel (las terminales **siguen corriendo**) |
| **×** de una pestaña | Cierra esa terminal (mata el proceso) |

## Cómo funciona

- Es una terminal **real** (pseudo-terminal): usa tu shell (`$SHELL`: bash, zsh, fish…) con tu configuración, colores y alias.
- Arranca en la **carpeta abierta** en MK (si no hay ninguna, en tu carpeta personal).
- Programas interactivos funcionan: `vim`, `nano`, `htop`, `less`, `git log`, `python` interactivo, `ssh`.
- **Varias terminales**: botón **+**, cada una en su pestaña (`1: zsh`, `2: zsh`…). **Doble clic en el nombre** de una pestaña para renombrarla ("servidor", "git"…).
- **Alto del panel**: arrastrá el borde de arriba. Se recuerda.
- Usa una fuente **Nerd Font** si tenés alguna instalada (JetBrainsMono / FiraCode / MesloLGS Nerd Font), así los prompts con íconos (Powerlevel10k, Starship) se ven bien.
- Sigue los colores del **tema** de MK (fondo, texto, cursor), con una paleta de colores ANSI distinta para temas claros y oscuros, para que todo se lea bien.

## Ejecutar el archivo actual (F5)

Con un archivo de código abierto, **F5** (o el botón ▶ de la toolbar, o la paleta → "Ejecutar archivo actual") lo **guarda** y lo corre en la terminal, en su carpeta:

| Archivo | Comando |
|---|---|
| `.py` | `python3 archivo.py` |
| `.sh`, `.bash` | `bash archivo.sh` |
| `.js`, `.mjs` | `node archivo.js` |
| `.c` | `gcc archivo.c -o /tmp/mk-run-archivo && /tmp/mk-run-archivo` |
| `.cpp`, `.cc`, `.cxx` | igual con `g++` |
| `.java` | `java Archivo.java` |
| `.rb`, `.go` | `ruby` / `go run` |

Si el programa pide datos (`input()`, `scanf`), escribilos en la terminal.

## Abrir con IA (Claude Code, Gemini CLI, Codex)

Si tenés instaladas las IAs de terminal (`claude`, `gemini`, `codex`), MK las abre en la terminal integrada ya apuntando a tu archivo:

| Dónde | Qué hace |
|---|---|
| Clic derecho en un **archivo** del sidebar → **🤖 Abrir con Claude Code / Gemini CLI / Codex** | Pestaña nueva (con el nombre de la IA) en la carpeta del archivo; la IA arranca con un prompt que le presenta el archivo (`@notas.md`) y espera tus instrucciones |
| Clic derecho en una **carpeta** (o la raíz) | La IA arranca en esa carpeta, sin prompt |
| Botón **IA ▾** de la toolbar, o paleta → "IA: abrir …" | Lo mismo sobre el archivo que tenés abierto (si tiene cambios sin guardar, los guarda antes) |

- Cada IA queda en su propia pestaña: podés tener Claude y Gemini a la vez sobre la misma nota.
- Corren con **tus** cuentas y configuración, como si las abrieras vos en una terminal; MK no maneja claves ni manda nada por su cuenta.
- Si alguna no está instalada, la terminal dice `command not found`.

## Abrir terminal en una carpeta

Clic derecho en una carpeta del sidebar → **"Abrir terminal aquí"** (en un archivo, abre en su carpeta).

## Copiar y pegar

| Atajo | Acción |
|---|---|
| `Ctrl+Shift+C` | Copiar la selección |
| `Ctrl+Shift+V` | Pegar |

## Buscar en la salida

`Ctrl+F` con el foco en la terminal (o 🔍 en la cabecera) abre un buscador: escribí y se selecciona la coincidencia; `Enter` / `Shift+Enter` siguiente / anterior, `Escape` cierra. Útil para encontrar un error en la salida larga de un build.

`Ctrl+C` sin Shift es el de siempre en una terminal: **corta el programa** que está corriendo.

## Atajos de MK con el foco en la terminal

Con el cursor en la terminal, las teclas van **al shell**, no a MK: `Ctrl+W` borra una palabra (no cierra tu pestaña del editor), `Ctrl+R` busca en el historial, `Ctrl+L` limpia la pantalla. Excepciones que siguen yendo a MK: `` Ctrl+` ``/`Ctrl+Ñ`, `Ctrl+Shift+P` (paleta), `Ctrl+Shift+H` (Home) y `F11`. Para volver al editor, hacé clic en él.

## Usos típicos

- **Git a mano**: `git status`, `git log --oneline`, `git push` mientras escribís.
- **Programar**: escribís `sintaxis.py` en el editor → `python sintaxis.py` en la terminal. Lo mismo con `gcc sintaxis.c && ./a.out`.
- **Proyectos web**: `npm run dev` en una terminal, y otra libre para comandos.
- **Convertir documentos**: `pandoc nota.md -o nota.docx`.
- **Buscar en tus notas**: `grep -rn "parcial" .`

## Seguridad

Es una terminal con **tus permisos**, igual que cualquier otra: lo que ejecutes ahí puede modificar o borrar archivos. Solo la ventana principal de MK puede abrir terminales (no el contenido que se muestra en el preview).

## Límites

- Las terminales no se restauran al reabrir MK (el historial del shell sí, porque lo guarda tu shell).
- Sin pantalla dividida dentro del panel (una terminal visible a la vez).
