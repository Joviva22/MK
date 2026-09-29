# Bases de datos — para qué sirven

Las bases de datos de MK sirven para guardar **información con estructura**: cosas que tienen siempre los mismos campos (nombre, fecha, estado, precio...) y que se relacionan entre sí. Cómo se usan paso a paso: [`bases-de-datos-como-usar.md`](bases-de-datos-como-usar.md).

## ¿Nota o base de datos?

| Si lo que anotás... | Mejor como |
|---|---|
| Es texto libre, ideas, apuntes, un documento | **Nota `.md`** |
| Es una **lista de cosas parecidas** con los mismos datos cada una | **Base de datos** |
| Querés filtrar, sumar, agrupar por estado o ver en calendario | **Base de datos** |
| Una cosa "pertenece" a otra (tarea → proyecto, gasto → categoría) | **Base de datos con relación** |

Regla práctica: si te encontrás haciendo una tabla Markdown que crece y querés sumar columnas o filtrarla, es momento de una base de datos.

## Qué te dan que una tabla Markdown no

- **Tipos**: una fecha es una fecha (aparece en el calendario), un número se puede sumar, una casilla se tilda.
- **Relaciones de dos vías**: enlazás una tarea a un proyecto y el proyecto "sabe" qué tareas tiene.
- **Cálculos automáticos**: fórmulas por fila y rollups entre bases (totales, promedios, conteos).
- **Varias vistas** de los mismos datos: tabla para cargar, tablero para el flujo, galería para hojear.
- **Integración con el Home**: toda columna Fecha pone la fila en tu calendario.

## Ideas de bases (con sus columnas)

### Gestión de proyectos
- **Proyectos**: Nombre · Estado (selección) · Fecha límite · Cliente (relación) · Horas totales (rollup)
- **Tareas**: Nombre · Hecha (casilla) · Prioridad (selección) · Horas (número) · Proyecto (relación)
- Vista Tablero de Proyectos por Estado. Fechas límite en el Home.

### Estudio / facultad
- **Materias**: Nombre · Cuatrimestre · Profesor · Promedio (rollup de Evaluaciones → Nota, Promedio)
- **Evaluaciones**: Nombre · Fecha · Tipo (Parcial/TP/Final) · Nota (número) · Materia (relación)
- Las fechas de parciales aparecen en el calendario del Home automáticamente.

### Finanzas personales
- **Categorías**: Nombre · Presupuesto (número) · Gastado (rollup Suma) · Restante (fórmula `prop("Presupuesto") - prop("Gastado")`)
- **Gastos**: Concepto · Monto · Fecha · Categoría (relación) · Pagado (casilla)

### Biblioteca / lecturas
- **Libros**: Título · Autor (relación) · Estado (Por leer/Leyendo/Leído) · Puntaje (número) · Etiquetas (selección múltiple)
- **Autores**: Nombre · País · Nº libros (rollup Cantidad)
- Vista Galería para hojear; Tablero por Estado.

### Contactos / CRM simple
- **Clientes**: Nombre · Empresa · Email · Último contacto (fecha) · Proyectos (relación)
- Fórmula de seguimiento: `prop("Último contacto") < "2026-09-01" ? "📞 Llamar" : ""`

### Recetas
- **Recetas**: Nombre · Tiempo (min) · Dificultad (selección) · Ingredientes (relación) · Vegana (casilla)
- **Ingredientes**: Nombre · Precio · Recetas (espejo)
- Rollup: costo de cada receta = Suma de precios de sus ingredientes.

### Hábitos / seguimiento
- **Registro**: Fecha · Ejercicio (casilla) · Lectura (casilla) · Horas de sueño (número) · Puntaje del día (fórmula)

## Bases de datos + resto de MK

| Combinación | Resultado |
|---|---|
| Base + **Home** | Fechas de la base en el calendario semanal/mensual |
| Base + **Notas** | La base guarda los datos; la nota `.md` del proyecto guarda el texto largo (enlazala escribiendo su nombre en una columna de texto) |
| Base + **git** | `.mk/databases.sqlite3` se versiona con tu carpeta |
| Tablero de la base vs. **Kanban** | Kanban trabaja sobre el texto de una nota; el Tablero de la base, sobre filas con más datos (fechas, números, relaciones) |

## Buenas prácticas

- **Primera columna = nombre claro**: es lo que se ve al enlazar desde otra base.
- **Estados como Selección única**, no texto: así podés agrupar en Tablero y no hay variantes mal escritas.
- **Una base por tipo de cosa**, y relaciones entre ellas — mejor que una sola base gigante con columnas vacías.
- **Nombres de columna estables**: las fórmulas las referencian por nombre (`prop("...")`); si renombrás, actualizá la fórmula.

## Límites actuales

- Las filas no son notas `.md`: no aparecen en la búsqueda global ni en el grafo.
- No hay ordenar por columna ni filtros por campo (el filtro busca texto en todas las columnas).
- No hay importar/exportar CSV todavía.
- Viven en una carpeta: bases de carpetas distintas no se pueden relacionar entre sí.
