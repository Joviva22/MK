# Ejemplo para ver el resaltado de sintaxis de Python en MK.
# Abrí este archivo directo (no es un bloque de código adentro de un .md).

import math
from collections import namedtuple

Punto = namedtuple("Punto", ["x", "y"])


class Circulo:
    """Un círculo simple, con área y perímetro."""

    def __init__(self, radio: float):
        self.radio = radio

    def area(self) -> float:
        return math.pi * self.radio ** 2

    def __repr__(self):
        return f"Circulo(radio={self.radio})"


def distancia(a: Punto, b: Punto) -> float:
    dx, dy = a.x - b.x, a.y - b.y
    return math.sqrt(dx * dx + dy * dy)


if __name__ == "__main__":
    c = Circulo(radio=4.5)
    origen = Punto(0, 0)
    otro = Punto(3, 4)
    print(f"Área: {c.area():.2f}")
    print("Distancia:", distancia(origen, otro))
    numeros = [1, 2, 3, 4, 5]
    pares = [n for n in numeros if n % 2 == 0]
    print("Pares:", pares)
