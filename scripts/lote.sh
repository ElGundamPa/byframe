#!/usr/bin/env bash
# Transcodifica en serie las piezas pendientes.
#
# En serie y no en paralelo a propósito: ffmpeg ya reparte el trabajo entre
# todos los núcleos. Lanzar tres a la vez no acaba antes, solo hace que las
# tres barras de progreso avancen a un tercio de velocidad y que la máquina se
# quede sin memoria con material 4K.
set -u

cd "$(dirname "$0")/.."

transcodificar() {
  local archivo="$1" slug="$2" formato="$3" poster="$4"
  echo ""
  echo "═══ $slug ═══"
  node scripts/transcode.mjs \
    --input "$archivo" \
    --slug "$slug" \
    --format "$formato" \
    --poster "$poster" \
    --local
}

transcodificar "masters/PLACERES - Lowst.mov"  placeres     horizontal 00:00:35
transcodificar "masters/Enigma SSB4.mov"       enigma-ssb4  horizontal 00:00:40
transcodificar "masters/Enigma SSB5.mov"       enigma-ssb5  horizontal 00:00:30

echo ""
echo "LOTE TERMINADO"
