# Terminal, F5 e IA

## Ejecutar código con F5

1. Abrí `sintaxis.py` (o `sintaxis.sh`, `sintaxis.c`, `sintaxis.cpp`, `Sintaxis.java`) desde el sidebar.
2. Apretá **F5** (o el botón ▶ de la barra): MK lo guarda y lo corre en la **terminal integrada**, abajo.
3. `` Ctrl+` `` (o `Ctrl+Ñ`) muestra/oculta la terminal.

## Abrir una IA sobre un archivo

Si tenés instalada alguna IA de terminal (`claude`, `gemini`, `codex`):

1. Clic derecho en `formato-avanzado.md` → **🤖 Abrir con Claude Code** (o Gemini CLI / Codex).
2. Se abre una pestaña de terminal con la IA, que ya sabe de qué archivo hablás.
3. Pedidos para probar:
   - *"Resumí esta nota en 5 puntos."*
   - *"Agregá un callout [!TIP] con un consejo al final."*
   - *"Convertí la tabla de ingredientes a formato CSV."*

Si la IA cambia el archivo mientras lo tenés abierto, MK lo recarga solo (o lo marca con ⚠ si tenías cambios sin guardar).

## Un botón que ejecuta comandos

```run
título: ¿Qué hay en esta carpeta?
ls -la
```

La primera vez te muestra el comando y pide confirmación.

## Más cosas de la terminal

- Clic derecho en una carpeta → **Abrir terminal aquí**.
- `Ctrl+F` con el foco en la terminal: buscar en la salida.
- Doble clic en el nombre de una pestaña: renombrarla.
- **Pantalla dividida**: `Ctrl+Shift+5` (o ◫) abre otra terminal al lado. Probá: a la izquierda `python3 -m http.server`, a la derecha `curl localhost:8000`.
- Lo que crees o borres desde la terminal (`touch nueva.md`, `rm`, `git checkout`) aparece en el árbol de archivos **solo**, sin 🔄.

Guías: [`../Guias/terminal.md`](../Guias/terminal.md) · [`../Guias/ia-en-la-terminal.md`](../Guias/ia-en-la-terminal.md).
