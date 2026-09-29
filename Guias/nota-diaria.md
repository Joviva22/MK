# Nota diaria

**Para qué sirve:** un diario o registro del día sin crear archivos a mano — un atajo y ya estás escribiendo en la nota de hoy.

## Cómo
1. `Ctrl+Shift+D` (o paleta → "Nota diaria de hoy").
2. MK abre o crea `Diario/AAAA-MM-DD.md` en tu carpeta, con la fecha como título.

Necesita carpeta abierta. Días anteriores: abrilos desde `Diario/` en el sidebar.

## Configurarla (⚙ Ajustes → Nota diaria)
| Campo | Qué hace | Ejemplo |
|---|---|---|
| **Carpeta** | Dónde se guardan (dentro de tu carpeta). Vacío = en la raíz | `Diario`, `Trabajo/Bitácora` |
| **Formato** | Nombre del archivo: `AAAA` año, `AA` año corto, `MM` mes, `DD` día. Con `/` se reparte en subcarpetas | `AAAA-MM-DD` → `2026-09-29.md` · `AAAA/MM/DD` → `2026/09/29.md` |
| **Plantilla** | Nota de tu carpeta cuyo texto se copia al crear la del día. `{{fecha}}` se cambia por la fecha | `Plantillas/diaria.md` |

Debajo se ve cómo quedaría la nota de hoy. Las notas que ya existen no se tocan: cambiar el formato solo afecta a las nuevas.

## Ideas de uso
- **Diario de trabajo**: qué hiciste, bloqueos, decisiones.
- **Registro de estudio**: qué temas viste hoy y dudas para la clase.
- **Bitácora personal**: gratitud, ánimo, lo que aprendiste.
- Plantilla sugerida (guardala como `Plantillas/diaria.md` y ponela en Ajustes):
  ```markdown
  # {{fecha}}
  ## Plan
  - [ ]
  ## Notas
  ## Aprendí
  ```

## Nota diaria + Home
El [Home](home-para-que-sirve.md) dice **qué** hacer cada día; la nota diaria guarda **lo que pasó** mientras lo hacías. Usá `[[AAAA-MM-DD]]` para enlazar días entre sí.
