# Revisión de la aplicación MK

> Documento histórico de propuestas. Algunas observaciones ya están resueltas: sandbox y CSP, validación de rutas, guardado atómico, módulos y pruebas unitarias. Para el estado de la versión preparada consulta [CHANGELOG.md](CHANGELOG.md) y la [guía de Office](Guias/office-como-usar.md).
## Opinión general

MK es una aplicación ambiciosa y sorprendentemente completa para ser un editor local. Su mayor virtud es que no intenta encerrar al usuario en un formato propio: las notas siguen siendo archivos Markdown normales y casi todas las funciones adicionales respetan esa idea. La aplicación ya ofrece mucho más que un editor básico y reúne escritura, organización, planificación, terminal, Git, bases de datos y herramientas de PDF en un único entorno coherente.

La impresión técnica también es positiva: hay decisiones conscientes para evitar pérdida de datos, bloquear navegación no deseada, aislar el renderer y mantener la interfaz fluida. Sin embargo, la cantidad de funciones ha crecido más rápido que la arquitectura. El principal riesgo actual no es que falten prestaciones, sino que resulte difícil mantenerlas y asegurar que todas sigan funcionando al modificar una parte grande del programa.

## Virtudes

### Producto y experiencia de uso

- **Enfoque local y abierto.** Las notas son archivos de texto normales, no hay cuenta obligatoria ni dependencia de una nube. Esto favorece la privacidad, la portabilidad y el uso con otras herramientas.
- **Conjunto de funciones muy amplio.** Pestañas, vista previa, Live Preview, wikilinks, etiquetas, backlinks, grafo, Home, bases de datos, Kanban, terminal, Git, PDF, DOCX, multimedia y exportación cubren casos de uso que normalmente exigen varias aplicaciones.
- **Buenas ayudas para usuarios reales.** Hay manual, guías separadas por función, ejemplos, listado de atajos y una hoja de ruta detallada. La documentación explica tanto el uso como las limitaciones.
- **Recuperación frente a errores.** El historial de versiones, el límite global de copias, la detección de cambios externos y el guardado atómico de `home.json` reducen el riesgo de perder trabajo.
- **Operaciones destructivas razonables.** La eliminación intenta usar primero la papelera del sistema, por lo que normalmente se puede deshacer.
- **Buen rendimiento considerado desde el diseño.** La carga diferida de librerías pesadas, el índice en memoria, la vigilancia de carpetas, las lecturas asíncronas y la agrupación de salida de la terminal son mejoras concretas, no solo intenciones.
- **Integración de escritorio útil.** La bandeja, los recordatorios, el arranque automático, el AppImage y la terminal integrada hacen que MK se comporte como una aplicación de escritorio completa.

### Código y seguridad

- **Separación parcial acertada.** El proceso principal ya está dividido por áreas (`ipc-files`, `ipc-notes`, `ipc-export`, `ipc-system`, etc.) y muchas funciones del renderer viven en archivos independientes.
- **Configuración básica segura de Electron.** Se usan `contextIsolation: true` y `nodeIntegration: false`; el renderer recibe una API explícita mediante `contextBridge`.
- **Contenido Markdown saneado.** La vista previa usa DOMPurify y existe una política explícita para los elementos especiales, las fórmulas y los recursos locales.
- **Navegación externa controlada.** La ventana impide que enlaces web sustituyan la aplicación y restringe la apertura externa a HTTP, HTTPS y correo.
- **Ejecución de procesos sin construir comandos de shell.** Git y `playerctl` se invocan con `execFile` y argumentos separados, lo que reduce la exposición a inyección de comandos.
- **Terminal con controles adicionales.** Solo el frame principal puede crear o manejar terminales y los shells elegibles se filtran contra una lista de ejecutables instalados.
- **Calidad automatizada.** ESLint pasa sin errores. Existe una suite de humo extensa sobre Electron real, además de CI con un perfil aislado y Xvfb.

## Fallos y aspectos a mejorar

### Prioridad alta

1. **Falta defensa en profundidad en el renderer.** La ventana usa `sandbox: false` y `index.html` no define una Content Security Policy. Aunque el aislamiento de contexto y DOMPurify son buenas barreras, una vulnerabilidad XSS tendría más impacto del necesario. Activar el sandbox y añadir una CSP estricta debería ser una prioridad.

2. **La validación de rutas está repartida y depende demasiado del renderer.** Varias operaciones IPC aceptan directamente rutas enviadas por la interfaz: lectura, guardado, creación, movimiento, borrado, bases de datos, Git y apertura de archivos. Además, el protocolo `md-local://` convierte la URL en una ruta y sirve el archivo sin comprobar en el proceso principal que pertenezca a la carpeta abierta. La interfaz realiza algunas comprobaciones, pero la frontera de seguridad debería estar en el proceso principal y centralizada en una sola función.

3. **Demasiados errores se silencian.** Hay numerosos bloques `catch` que devuelven `null`, `false` o no hacen nada. Esto evita cierres inesperados, pero también dificulta detectar corrupción, fallos de permisos, problemas de disco o errores de importación. Hace falta un registro local de errores y mensajes más claros para las operaciones importantes.

4. **Persistencia de bases de datos poco escalable y no atómica.** Cada cambio exporta y reescribe el archivo SQLite completo mediante `sql.js`. Con bases grandes puede bloquear el proceso principal, aumentar el desgaste de disco y dejar más superficie para una escritura incompleta. Conviene agrupar cambios y guardar de forma atómica, o adoptar un motor SQLite nativo con transacciones y WAL si la distribución lo permite.

### Prioridad media

5. **Archivos del renderer demasiado grandes.** `database.js` supera las 2.200 líneas, `home.js` ronda las 1.800 y `styles.css` supera las 4.400. Esto eleva el acoplamiento, dificulta las revisiones y hace más probable introducir regresiones. La división en módulos ES y componentes por responsabilidad ya no es solo una mejora estética, sino una necesidad de mantenimiento.

6. **Carga global basada en muchos scripts.** `index.html` carga decenas de scripts que comparten estado mediante `window`. El orden de carga se convierte en una dependencia implícita y no hay encapsulación fuerte. La migración gradual a módulos ES permitiría dependencias explícitas, pruebas unitarias y eliminación de código no usado.

7. **Cobertura concentrada en una única suite de integración.** La suite de Electron es valiosa, pero es más lenta y frágil ante el entorno gráfico. Falta una capa de pruebas unitarias rápidas para fechas, recurrencias, filtros, fórmulas, CSV, rutas y transformaciones de Markdown. También faltan pruebas visuales y de accesibilidad.

8. **Accesibilidad insuficiente.** En el código revisado hay muy pocos roles y etiquetas ARIA explícitos para la cantidad de paneles, menús, pestañas y controles personalizados existentes. Es probable que la navegación por teclado y el uso con lector de pantalla sean irregulares.

9. **Operaciones síncronas en el proceso principal.** Aunque gran parte del acceso a archivos ya es asíncrono, todavía hay lecturas, escrituras, exportaciones y recorridos síncronos. En archivos grandes pueden congelar temporalmente toda la aplicación.

10. **Compatibilidad limitada.** El producto y el empaquetado están centrados en Linux; algunas integraciones dependen además de herramientas externas como `playerctl`. Es una limitación válida para el alcance actual, pero reduce mucho el público potencial y debería mostrarse con claridad antes de la instalación.

### Prioridad baja

11. **Versión del producto poco informativa.** `package.json` continúa en `1.0.0` pese al volumen de cambios. Faltan versionado semántico, changelog y publicaciones reproducibles que permitan saber qué versión tiene cada usuario.

12. **Documentación propensa a quedar desactualizada.** El README incluye cifras concretas de rendimiento y cantidad de pruebas que pueden dejar de coincidir con el código. Automatizar estos datos o evitar cifras volátiles reduciría contradicciones.

13. **Interfaz potencialmente sobrecargada.** La enorme cantidad de funciones es una ventaja, pero también puede aumentar la curva de aprendizaje y hacer difícil descubrir cuál es el flujo principal. La personalización de la barra ayuda, aunque vendrían bien una incorporación inicial sencilla y una separación más clara entre escritura, planificación y herramientas avanzadas.

## Revisión de la aplicación MK (por Gemini)

Como IA, he analizado el proyecto MK y coincido con gran parte de la revisión anterior, aunque aporto una perspectiva centrada en la seguridad, la robustez del código y la escalabilidad a largo plazo.

### Opinión General

MK es un proyecto con una visión técnica muy clara: **privacidad y control total del usuario**. Es raro encontrar una aplicación de escritorio que combine tantas herramientas (notas, bases de datos, terminal, Git, PDF) sin recurrir a una arquitectura pesada o dependencias de nube. La implementación de un índice en memoria y la vigilancia reactiva de carpetas demuestra un cuidado por el rendimiento que se agradece en aplicaciones basadas en Electron.

Sin embargo, el proyecto se encuentra en un punto crítico: ha crecido tanto en funcionalidades que la superficie de ataque y el riesgo de regresiones son altos. Para pasar de un "prototipo avanzado" a una "herramienta de producción fiable", es necesario endurecer los cimientos.

### Virtudes Destacadas

1.  **Arquitectura de Datos Transparente:** El uso de archivos `.md` y bases SQLite locales en carpetas ocultas (`.mk/`) es excelente. No hay "vendor lock-in".
2.  **Estrategia de Backups:** La creación de copias automáticas antes de guardar (`makeBackup` en `ipc-files.js`) con límites globales de espacio es una de las mejores defensas contra la pérdida de datos en editores locales.
3.  **Ejecución Segura de Comandos:** El uso de `execFile` con argumentos separados para Git y `playerctl` es un acierto de seguridad fundamental para evitar inyecciones de shell.
4.  **Optimización de Carga:** La carga diferida (`lazyload.js`) para librerías pesadas como Mermaid o xterm.js mantiene el arranque de la app ligero.

### Fallos y Riesgos Identificados

1.  **Superficie de Ataque en el Renderer:** El uso de `sandbox: false` y la falta de una `Content Security Policy (CSP)` exponen al usuario. Si un archivo Markdown malicioso lograra inyectar un script (vía un fallo en el parseo o un asset local), este tendría acceso a APIs de Node.js a través del puente IPC sin apenas restricciones.
2.  **Validación de Rutas Insuficiente:** Muchos manejadores de IPC (como `file:save`, `db:listDatabases`, `git:sync`) confían ciegamente en la ruta `root` o `filePath` enviada por el renderer. Un renderer comprometido podría manipular archivos fuera de la carpeta abierta (ej. overwriting `~/.ssh/authorized_keys`).
3.  **Manejo de Errores "Silencioso":** Se abusa de bloques `catch` vacíos o que solo retornan `null`. Esto es peligroso porque oculta fallos críticos de disco o permisos que el usuario debería conocer.
4.  **Acoplamiento y Deuda Técnica:** Archivos de más de 2000 líneas en el renderer dificultan enormemente la detección de efectos secundarios al hacer cambios. El estado global en `window` es una invitación a bugs difíciles de rastrear.

### Mejoras Propuestas (Plan de Acción)

#### 1. Endurecimiento de Seguridad (Prioridad Máxima)
-   **Activar Sandbox:** Cambiar a `sandbox: true` en `main.js` y refactorizar el `preload.js` para que solo use APIs seguras.
-   **Implementar CSP:** Añadir una meta-etiqueta CSP en `index.html` que bloquee la ejecución de scripts no confiables y restrinja el acceso a recursos.
-   **Validación Central de Rutas:** Crear una función en el proceso principal que verifique que cualquier ruta recibida por IPC está contenida dentro de la carpeta "root" actualmente autorizada.

#### 2. Robustez y Observabilidad
-   **Sistema de Logging:** Implementar un logger que guarde errores y eventos importantes en un archivo rotativo dentro de `userData`.
-   **Alertas al Usuario:** Reemplazar los `catch` silenciosos por notificaciones en la UI cuando una operación de guardado o base de datos falla.
-   **Escritura Atómica en Configuración:** Aplicar la misma lógica de "archivo temporal + rename" que se usa en las bases de datos a `config.json` y `home.json`.

#### 3. Refactorización Arquitectónica
-   **Modularización del Renderer:** Dividir `database.js`, `home.js` y `editor.js` en módulos más pequeños basados en responsabilidades (ej. `db-ui.js`, `db-logic.js`, `db-api.js`).
-   **Migración a ES Modules:** Empezar a usar `<script type="module">` para eliminar la dependencia del orden de carga en `index.html` y mejorar la encapsulación.

#### 4. Accesibilidad y Experiencia
-   **Auditoría ARIA:** Añadir etiquetas `aria-label` y roles a los botones de la toolbar y paneles laterales.
-   **Abstracción de Plataforma:** Mover las dependencias de Linux (como `playerctl`) a un módulo de "adaptadores" para facilitar una futura versión de Windows/macOS.

---
*Revisión realizada por Gemini (CLI Agent).*

