#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BREW_INSTALL='curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | bash'

need_node() {
  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  [[ "$major" -lt 20 ]]
}

apply_brew_path() {
  local candidate
  for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew /home/linuxbrew/.linuxbrew/bin/brew "$HOME/.linuxbrew/bin/brew"; do
    if [[ -x "$candidate" ]]; then
      eval "$("$candidate" shellenv)"
      return 0
    fi
  done
  return 1
}

have_brew() {
  command -v brew >/dev/null 2>&1 || apply_brew_path
}

ask_yes() {
  local prompt="$1"
  local def="${2:-E}"
  local hint
  if [[ "$def" == "E" ]]; then hint="E/h"; else hint="e/H"; fi
  printf "%s [%s] " "$prompt" "$hint"
  local ans=""
  read -r ans || true
  ans="$(printf "%s" "$ans" | tr '[:upper:]' '[:lower:]')"
  if [[ -z "$ans" ]]; then
    [[ "$def" == "E" ]]
    return
  fi
  [[ "$ans" == "e" || "$ans" == "y" || "$ans" == "evet" ]]
}

print_brew_help() {
  echo "Homebrew kurmak için:"
  echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
}

ensure_brew() {
  local assume="${1:-}"
  if have_brew; then
    return 0
  fi
  echo "Homebrew yüklü değil. Paket kurulumları için öncelik Homebrew."
  print_brew_help
  if [[ "$assume" != "yes" ]]; then
    if ! ask_yes "Önce Homebrew kurayım mı?" "E"; then
      return 1
    fi
  fi
  echo "Homebrew kuruluyor..."
  /bin/bash -c "$BREW_INSTALL"
  have_brew
}

install_node_linux_pm() {
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y nodejs npm
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
    return
  fi
  if command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm nodejs npm
    return
  fi
  return 1
}

if need_node; then
  if ask_yes "Node 20+ yok. Homebrew ile kurayım mı?" "E" && ensure_brew yes; then
    echo "Node Homebrew ile kuruluyor..."
    brew install node
  elif [[ "$(uname -s)" == "Linux" ]] && ask_yes "Homebrew yok. Dağıtım paket yöneticisi ile Node kurayım mı?" "E"; then
    echo "Node dağıtım paket yöneticisi ile kuruluyor..."
    install_node_linux_pm
  else
    echo "Node 20+ gerekli. Homebrew ile kurmak için:"
    print_brew_help
    echo "  brew install node"
    if ask_yes "Node LTS sayfasını tarayıcıda açayım mı?" "h"; then
      if command -v open >/dev/null 2>&1; then
        open "https://nodejs.org/" 2>/dev/null || true
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "https://nodejs.org/" >/dev/null 2>&1 || true
      fi
    fi
    exit 1
  fi
  if need_node; then
    echo "Node hâlâ 20+ değil. Yeni bir terminal açıp scripti tekrar çalıştırın."
    exit 1
  fi
fi

echo "Bağımlılıklar kuruluyor..."
npm install
npm link
echo "Kurulum sihirbazı başlıyor..."
exec air setup
