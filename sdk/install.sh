#!/usr/bin/env sh
# Craft.Coder CLI — tek komut kurulum (Mac & Linux)
#   curl -fsSL https://raw.githubusercontent.com/eneskahveci-sdo/craft-coder/main/sdk/install.sh | sh
# veya doğrudan:
#   npm install -g craft-coder
set -e

printf "\033[38;2;200;168;126m▶ Craft.Coder CLI kuruluyor…\033[0m\n"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js gerekli (>= 18). Kur: https://nodejs.org" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "✗ npm bulunamadı (Node.js ile gelir)." >&2
  exit 1
fi

npm install -g craft-coder

printf "\033[32m✓ Kuruldu.\033[0m Başlatmak için:  \033[1;38;2;200;168;126mcraft-coder\033[0m\n"
printf "  Kendi modelin için:  craft-coder --base-url <url> --model <ad> --api-key <anahtar>\n"
