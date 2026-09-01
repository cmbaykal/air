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
  if command -v brew >/dev/null 2>&1; then
    echo "Node 20+ yok. Homebrew ile kuruluyor..."
    brew install node
  else
    echo "Node 20+ gerekli. Homebrew yok."
    echo "1) https://nodejs.org adresinden Node LTS kurun"
    echo "2) Bu scripti tekrar çalıştırın"
    open "https://nodejs.org/" 2>/dev/null || true
    exit 1
  fi
fi

echo "Bağımlılıklar kuruluyor..."
npm install
echo "Kurulum sihirbazı başlıyor..."
exec npx air setup
