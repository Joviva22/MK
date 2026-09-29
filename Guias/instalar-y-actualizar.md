# Instalar, actualizar y fijar MK

**Para qué sirve:** tener MK como una aplicación más del sistema — en el menú, fijada en la barra de tareas, abriendo `.md` con doble clic y (si querés) arrancando sola para que suenen los recordatorios.

## Instalar (o actualizar)

Desde la carpeta del proyecto, en una terminal (puede ser la de MK):

```bash
npm install          # solo la primera vez, o si cambiaron dependencias
npm run dist         # arma dist/MK-1.0.0.AppImage (tarda un par de minutos)
npm run install-desktop
```

`install-desktop` deja todo dentro de tu usuario (sin `sudo`):

| Qué | Dónde |
|---|---|
| La app | `~/.local/share/mk/MK.AppImage` |
| El ícono | `~/.local/share/icons/hicolor/512x512/apps/mk-editor.png` |
| El lanzador del menú | `~/.local/share/applications/mk-editor.desktop` (guarda el anterior como `.bak`) |

Para **actualizar** después de cambios: repetí `npm run dist && npm run install-desktop`, y reiniciá MK (`Ctrl+Q` y abrirlo de nuevo).

Tus datos (tareas del Home, ajustes, sesión, historial de versiones) viven en `~/.config/md-editor-local` y **no se tocan** al instalar ni actualizar.

## Fijarlo en la barra de tareas (KDE Plasma)

1. Cerrá MK del todo: `Ctrl+Q` (cerrar la ventana solo lo manda a la bandeja).
2. Si había un ícono viejo fijado: clic derecho → **Desanclar**.
3. Abrí MK desde el **menú de aplicaciones** ("MK").
4. Clic derecho en su ícono de la barra → **Anclar al gestor de tareas**.

¿Aparece como "Electron" o con un ícono desconocido? Volvé a correr `npm run install-desktop` (renueva los cachés de íconos de KDE) y, si sigue, reiniciá el panel:

```bash
systemctl --user restart plasma-plasmashell
```

## Bandeja e inicio con el sistema

- **Cerrar la ventana** deja MK en la bandeja (junto al reloj): los [recordatorios](recordatorios.md) siguen sonando. **Salir de verdad**: `Ctrl+Q` o clic derecho en el ícono de la bandeja → **Salir de MK**.
- **⚙ Ajustes → "Al cerrar, seguir en la bandeja"**: desactivalo si preferís que cerrar sea salir.
- **⚙ Ajustes → "Iniciar MK con el sistema"**: arranca oculto en la bandeja al iniciar sesión.

## Versión de desarrollo

`npm start` corre MK directo desde el código (útil para probar cambios sin empaquetar). Usa los mismos datos que el AppImage.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| Cambios nuevos no aparecen | MK seguía abierto con la versión vieja: `Ctrl+Q` y abrir de nuevo |
| Ícono genérico o "Electron" en la barra | `npm run install-desktop`, desanclar y volver a anclar |
| No aparece el ícono en la bandeja (GNOME) | Instalar la extensión "AppIndicator" |
| La terminal integrada no abre | `npm install` (recompila `node-pty`) y `npm run dist` de nuevo |
