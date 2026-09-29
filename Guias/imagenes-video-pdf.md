# Fotos, video, audio y PDF

**Para qué sirve:** meter material visual en tus notas (capturas, diagramas, vídeos de clase, PDFs de referencia) y ver archivos sueltos sin salir de MK.

## Insertar

| Tipo | Sintaxis |
|---|---|
| Imagen | `![descripción](ruta/imagen.png)` |
| Video embebido | `![[video.mp4]]` |
| Audio embebido | `![[cancion.mp3]]` |
| PDF embebido | `![[documento.pdf]]` |

Rutas relativas al archivo actual.

## Sin escribir la sintaxis
- **Arrastrar desde el explorador del sistema** al editor → se copia a `assets/` junto a la nota y se inserta el enlace.
- **Arrastrar desde el sidebar** → enlaza el archivo donde ya está (no copia).
- Clic derecho → **Insertar imagen**.

## Formatos que abre

Clic en el archivo en el sidebar → se abre en el visor:

| Tipo | Extensiones |
|---|---|
| **Fotos** | png, jpg/jpeg, gif, webp, avif, apng, bmp, svg, ico (y tiff, heic: ver abajo) |
| **Video** | mp4, m4v, webm, mkv, mov, ogv (y avi, wmv, flv, mpg…: ver abajo) |
| **Audio** | mp3, wav, flac, ogg, opus, m4a, aac, weba (y wma, aiff, midi…: ver abajo) |

- Video y audio con controles, y se puede **adelantar/retroceder** aunque el archivo sea largo.
- Si un formato no se puede mostrar (depende del códec: TIFF, HEIC, AVI, WMV…), aparece **"Abrir con la aplicación del sistema"** en vez de una pantalla rota.
- Clic derecho en cualquier archivo → **Abrir con la aplicación del sistema** (por ejemplo, para editar una foto en tu editor de imágenes).
- También en el **panel secundario** (clic derecho → Abrir en panel secundario): escuchar un audio o ver un video mientras escribís.

## Ver archivos sueltos
Clic en una imagen o PDF del sidebar → se abre a pantalla completa en el preview (modo lectura). Para tenerlo **al lado** mientras escribís: clic derecho → *Abrir en panel secundario* ([modos-de-vista.md](modos-de-vista.md)).

## Usos típicos
- Apuntes con capturas de las diapositivas.
- Documentación con diagramas y un PDF de especificación embebido.
- Bitácora de proyecto con fotos.

## Ver también
Editar PDFs (unir, rotar, firmar, subrayar): [herramientas-pdf.md](herramientas-pdf.md).
