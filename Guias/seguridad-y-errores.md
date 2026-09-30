# Seguridad, privacidad y errores

**Para qué sirve saberlo:** entender qué protege MK, qué hace si algo falla al guardar y dónde mirar si pasa algo raro.

## Privacidad

- Todo es **local**: tus notas son archivos `.md` en tu disco. No hay cuenta, ni nube, ni telemetría.
- MK no se conecta a internet por su cuenta. Solo carga imágenes `https://` que vos pongas en una nota, abre en el navegador los enlaces en los que hagas clic y, **si lo activás**, manda tus recordatorios por correo a tu propia dirección (Gmail, con la contraseña de aplicación cifrada en el llavero del sistema — ver [recordatorios.md](recordatorios.md#también-por-correo-gmail)).

## Qué te protege si abrís un `.md` ajeno

Un documento descargado podría traer HTML escondido. MK lo frena en varias capas:

| Capa | Qué hace |
|---|---|
| **Limpieza del HTML** (DOMPurify) | Quita scripts y atributos peligrosos del preview |
| **Content Security Policy** | Aunque algo se colara, la ventana no ejecuta scripts que no sean los de MK ni manda datos a internet |
| **Sandbox** | La ventana corre aislada del sistema; solo habla con MK por un canal con funciones concretas |
| **Rutas autorizadas** | La ventana solo puede leer, escribir o borrar dentro de **lo que abriste**: la carpeta abierta, archivos elegidos en "Abrir", arrastrados desde el explorador, pasados con "Abrir con MK" o de tu sesión anterior. Un documento no puede pedir, por ejemplo, `~/.ssh/…` |
| **Enlaces** | Solo abren `http(s)` y `mailto:` en tu navegador; nunca navegan la ventana de MK |

**Consecuencia práctica:** una imagen referenciada **fuera** de la carpeta abierta (por ejemplo `/home/vos/Imágenes/foto.png` desde una nota de otra carpeta) no se muestra. Copiala adentro de la carpeta: arrastrarla desde el explorador al editor (con la nota ya guardada) la copia sola a `assets/` junto a la nota.

**Límite honesto:** la **terminal integrada** ejecuta lo que escribas con tus permisos, como cualquier terminal. Por eso las capas de arriba están para que nada llegue a controlar la ventana.

## Si algo falla

- **No se pudo guardar** (disco lleno, sin permiso, carpeta borrada): aparece un aviso rojo abajo a la izquierda. La pestaña **sigue con tus cambios** y el autoguardado vuelve a intentar. No se pierde nada.
- **Base de datos o Home** que no se pudieron guardar: el mismo aviso.
- Los archivos de MK (bases de datos, tareas del Home, configuración, sesión) se guardan **de forma atómica**: primero a un temporal y después se reemplaza de una vez. Un apagón a mitad no los deja rotos.
- Si un archivo de configuración o del Home **ya estaba dañado**, MK no lo pisa: lo aparta como `…json.corrupt-<fecha>` (podés recuperarlo a mano) y arranca con uno limpio.
- Cada nota guardada deja antes una copia en el [historial de versiones](historial-y-git.md).

## El registro de errores

`~/.config/md-editor-local/logs/mk.log`: una línea por error, con fecha y dónde pasó (guardar, base de datos, rutas rechazadas, errores internos). Rota solo al pasar 1 MB (`mk.log.1`).

Si algo no funciona y querés reportarlo, ese archivo es lo más útil para adjuntar.

```bash
tail -20 ~/.config/md-editor-local/logs/mk.log
```
