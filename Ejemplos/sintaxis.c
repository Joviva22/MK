/* Ejemplo para ver el resaltado de sintaxis de C en MK.
   Abrí este archivo directo (no es un bloque de código adentro de un .md). */

#include <stdio.h>
#include <math.h>

#define PI 3.14159265

typedef struct {
    double radio;
} Circulo;

double area(const Circulo *c) {
    return PI * pow(c->radio, 2);
}

int main(void) {
    Circulo c = { .radio = 4.5 };
    double a = area(&c);
    int numeros[5] = { 1, 2, 3, 4, 5 };
    int suma = 0;

    printf("Area: %.2f\n", a);

    for (int i = 0; i < 5; i++) {
        if (numeros[i] % 2 == 0) {
            suma += numeros[i];
        }
    }

    printf("Suma de pares: %d\n", suma);
    return 0;
}
