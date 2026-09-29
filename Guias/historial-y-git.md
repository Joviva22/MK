# Historial de versiones y git

**Para qué sirve:** no perder nunca un cambio — volver a una versión anterior de una nota o llevar un historial real con git.

## Historial automático
- Cada guardado respalda la versión anterior (hasta 20 por archivo, 200 MB en total), fuera de tu carpeta.
- Paleta → **"Ver versiones anteriores..."** → por cada versión: **Ver diff** (comparar) o **Restaurar** (`Ctrl+Z` deshace).

## Ver cambios sin guardar
Botón 🔀 (toolbar): diff del editor contra lo guardado en disco — verde agregado, rojo borrado.

## Git
Requisito: la carpeta ya es un repo (`git init` hecho por vos; MK nunca lo hace).

| Modo | Cómo | Resultado |
|---|---|---|
| **Automático** | ⚙ Ajustes → "Sincronizar con git al guardar" | Cada `Ctrl+S` manual = `git add -A` + commit |
| **Control fino** | Paleta → "Sincronizar con git (elegir archivos y mensaje)..." | Elegís archivos, **hunks** y mensaje propio |

## Usos
- Historial automático: red de seguridad diaria, sin pensar.
- Git: tesis, documentación, notas que sincronizás entre computadoras (con `git push` por fuera).
- Las bases de datos (`.mk/databases.sqlite3`) también entran en git.

## Límites
El commit automático no se dispara con el autoguardado (a propósito). MK no hace push.
