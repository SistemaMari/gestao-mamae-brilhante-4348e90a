#!/usr/bin/env bash
# Cria (ou recria) a Rede Demonstração MARI, etapa por etapa.
#   SEED_SECRET=... bash scripts/rede-demo.sh            → cria tudo
#   SEED_SECRET=... bash scripts/rede-demo.sh limpar     → mostra o que seria apagado
#   SEED_SECRET=... bash scripts/rede-demo.sh limpar sim → apaga tudo da rede demo
set -euo pipefail

URL="${SUPABASE_URL:-https://ywldvotfgbxufcyjdvnq.supabase.co}/functions/v1"
: "${SEED_SECRET:?defina SEED_SECRET (o mesmo valor do secret da edge function)}"

chamar() {
  curl -sS --fail-with-body -X POST "$URL/$1" \
    -H "Content-Type: application/json" -H "x-seed-secret: $SEED_SECRET" -d "$2"
  echo
}

if [ "${1:-}" = "limpar" ]; then
  if [ "${2:-}" = "sim" ]; then chamar seed-rede-demo-cleanup '{"confirmar":true}'
  else chamar seed-rede-demo-cleanup '{}'; fi
  exit 0
fi

chamar seed-rede-demo '{"etapa":"estrutura"}'
for u in centro norte sul leste oeste; do
  chamar seed-rede-demo "{\"etapa\":\"gestantes\",\"unidade\":\"$u\"}"
done
chamar seed-rede-demo '{"etapa":"relatorios"}'
