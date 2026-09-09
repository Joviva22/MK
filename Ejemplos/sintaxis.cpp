// Ejemplo para ver el resaltado de sintaxis de C++ en MK.
// Abrí este archivo directo (no es un bloque de código adentro de un .md).

#include <iostream>
#include <vector>
#include <string>

class Circulo {
public:
    explicit Circulo(double radio) : radio_(radio) {}

    double area() const {
        return 3.14159265 * radio_ * radio_;
    }

private:
    double radio_;
};

int main() {
    Circulo c(4.5);
    std::vector<int> numeros = {1, 2, 3, 4, 5};
    std::string etiqueta = "pares";

    std::cout << "Area: " << c.area() << std::endl;

    for (const auto &n : numeros) {
        if (n % 2 == 0) {
            std::cout << etiqueta << ": " << n << std::endl;
        }
    }

    return 0;
}
