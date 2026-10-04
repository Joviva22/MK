# Pomodoro y reproductor multimedia

**Para qué sirve:** concentrarte en bloques de tiempo y controlar la música sin salir de MK.

## Pomodoro (⏱)
1. Clic en ⏱ → arranca foco (25 min por defecto). La barra de estado muestra una Lucky Emblem dorada junto a `Foco 24:59`.
2. Clic de nuevo: pausa/reanuda.
3. Al terminar pasa solo a descanso (`☕`) con notificación, y viceversa.
4. Clic en el texto de la barra de estado: abrir **Tiempo de estudio**. Usa **Finalizar y guardar tiempo trabajado** para terminar conservando el parcial.

Minutos en ⚙ Ajustes.

## Categorías y estadísticas

Abre **Tiempo de estudio** en la toolbar. Crea **PCP**, elígela en el temporizador y pulsa **Aplicar**. Dos focos de 25 minutos suman **PCP: 50 min**. Consulta todo el historial, hoy, esta semana o este mes y filtra por categoría. Puedes renombrar/fusionar categorías.

En el historial puedes editar fecha, minutos, categoría y estado; añadir tiempo manual o eliminar registros. Esto recalcula las estadísticas, pero no concede XP ni completa tareas. Pausas y descansos no cuentan. Editar los minutos restantes no añade minutos trabajados.

El foco se guarda como parcial cada 15 s y al pausar/finalizar. Si cierras MK, conserva lo guardado pero no reanuda el temporizador; finalízalo antes de cerrar para guardar el último tramo. Si falla el guardado, reintenta desde el panel antes de salir.

**Combinalo con el [Home](home-para-que-sirve.md):** elegí una tarea del día, un pomodoro, tildala al terminar.

## Focos vinculados a apuntes

1. Abre una nota Markdown guardada (también puede ser una nota creada con una selección de PDF, después de guardarla).
2. En **Tiempo de estudio**, elige la categoría/asignatura, escribe un detalle opcional —por ejemplo, «PCP, práctica 4»— y pulsa **Iniciar foco con la nota abierta**. También está en la paleta de comandos.
3. El vínculo se mantiene al cambiar de pestaña y durante los siguientes ciclos. La barra de estado muestra el archivo. Finalizar el foco guarda el tiempo y borra el contexto del temporizador.
4. En el historial, combina filtros de periodo, categoría y **Nota** para saber cuánto trabajaste sobre ese apunte. **Abrir nota** vuelve al archivo sin reemplazar cambios de otras pestañas.

Para vincular o desvincular un foco que ya está en marcha, usa **Vincular nota abierta** / **Quitar vínculo**, cambia su detalle y pulsa **Aplicar**. Esto reclasifica el foco completo: no divide el tiempo entre notas. Los campos pendientes de aplicar no cambian la sesión. También puedes corregir el detalle y el vínculo de registros terminados o manuales desde **Editar**.

Las notas sin guardar no tienen una ruta estable: guárdalas antes de vincularlas. El vínculo usa la ruta absoluta del archivo; moverlo o cambiar de equipo requiere corregirlo. No concede permisos adicionales: para reabrirlo, el archivo debe existir y su ubicación debe estar autorizada en MK. Los registros antiguos siguen disponibles como **Sin nota**. Los vínculos no escriben ni añaden estadísticas dentro del Markdown.

## Reproductor (⏮ ▶ ⏭)
Controla Spotify, VLC, el navegador o cualquier reproductor MPRIS.

- **Solo Linux**, requiere `playerctl` (`sudo pacman -S playerctl` / `sudo apt install playerctl`).
- Sin `playerctl` o sin reproductor abierto, avisa con un mensaje.

## Límites
El Pomodoro no registra los ciclos completados en ninguna nota.
