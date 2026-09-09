# Ejecutar código JavaScript

Andá al preview y hacé clic en **"▶ Ejecutar"** debajo de cada bloque. Corre en un Web Worker aislado (sin acceso a tus archivos ni al resto de MK), con 3 segundos de límite.

## Estilo "notebook": la última expresión se muestra sola

```js
const precios = [1200, 850, 430, 990];
const total = precios.reduce((a, b) => a + b, 0);
console.log("precios:", precios);
total
```

Salida esperada: la lista de precios impresa, y abajo `=> 3470` (no hace falta `return`).

## Un cálculo rápido

```js
const radio = 4;
const area = Math.PI * radio ** 2;
console.log(`Área de un círculo de radio ${radio}: ${area.toFixed(2)}`);
```

## Generar datos de prueba

```js
const nombres = ["Ana", "Bruno", "Caro", "Diego"];
nombres.map((n, i) => `${i + 1}. ${n}`).join("\n")
```

## Qué pasa si el código nunca termina

```js
while (true) {}
```

Probá ejecutarlo: a los 3 segundos se corta solo y avisa que se agotó el tiempo — no cuelga la app.
