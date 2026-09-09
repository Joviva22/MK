// Ejemplo para ver el resaltado de sintaxis de Java en MK.
// Abrí este archivo directo (no es un bloque de código adentro de un .md).

import java.util.List;
import java.util.ArrayList;

public class Sintaxis {

    static class Circulo {
        private final double radio;

        Circulo(double radio) {
            this.radio = radio;
        }

        double area() {
            return Math.PI * Math.pow(radio, 2);
        }
    }

    public static void main(String[] args) {
        Circulo c = new Circulo(4.5);
        List<Integer> numeros = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            numeros.add(i);
        }

        System.out.printf("Area: %.2f%n", c.area());

        for (int n : numeros) {
            if (n % 2 == 0) {
                System.out.println("Par: " + n);
            }
        }
    }
}
