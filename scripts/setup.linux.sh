#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

need_node() {
  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  [[ "$major" -lt 20 ]]
}

if need_node; then
  echo "Node 20+ gerekli."
  echo "1) https://nodejs.org adresinden Node LTS kurun"
  echo "2) Bu scripti tekrar çalıştırın"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "https://nodejs.org/" >/dev/null 2>&1 || true
  fi
  exit 1
fi

echo "Bağımlılıklar kuruluyor..."
npm install
npm link
echo "Kurulum sihirbazı başlıyor..."
exec air setup
