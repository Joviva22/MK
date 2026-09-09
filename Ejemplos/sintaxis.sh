#!/bin/bash
# Ejemplo para ver el resaltado de sintaxis de Shell en MK.
# Abrí este archivo directo (no es un bloque de código adentro de un .md).

set -euo pipefail

RADIO=4.5
NOMBRE="${1:-mundo}"

area() {
    local radio="$1"
    echo "$radio * $radio * 3.14159265" | bc -l
}

echo "Hola, $NOMBRE"
echo "Área del círculo: $(area "$RADIO")"

numeros=(1 2 3 4 5)
for n in "${numeros[@]}"; do
    if (( n % 2 == 0 )); then
        echo "Par: $n"
    fi
done
