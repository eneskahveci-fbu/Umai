#!/usr/bin/env sh
# Craft.Coder CLI — tek komut kurulum (Mac & Linux)
#   curl -fsSL https://raw.githubusercontent.com/eneskahveci-sdo/craft-coder/main/sdk/install.sh | sh
# veya doğrudan:
#   npm install -g craft-coder
set -e

printf "\033[38;2;200;168;126m▶ Craft.Coder CLI kuruluyor…\033[0m\n"

# Node >= 18 gerekli. nvm ile kurulum/güncelleme en kolayı (sudo gerekmez).
nvm_hint() {
  echo "  En kolay kurulum (nvm — sudo gerekmez):" >&2
  echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash" >&2
  echo "    export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"" >&2
  echo "    nvm install 20" >&2
  echo "  sonra bu kurulum komutunu TEKRAR çalıştır." >&2
}

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js bulunamadı. Craft.Coder CLI Node >= 18 ister." >&2
  nvm_hint
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  echo "✗ Node sürümün çok eski ($(node -v 2>/dev/null)). Craft.Coder CLI Node >= 18 ister." >&2
  nvm_hint
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "✗ npm bulunamadı (Node.js ile gelir)." >&2
  exit 1
fi

if npm install -g craft-coder; then
  printf "\033[32m✓ Kuruldu.\033[0m Başlatmak için:  \033[1;38;2;200;168;126mcraft-coder\033[0m\n"
  printf "  Kendi modelin için:  craft-coder --base-url <url> --model <ad> --api-key <anahtar>\n"
else
  echo "" >&2
  echo "⚠ npm'den kurulamadı (paket henüz npm'de yayında olmayabilir)." >&2
  echo "  Alternatif — kaynaktan doğrudan çalıştır (global kurulum gerekmez):" >&2
  echo "    git clone https://gitlab.com/eneskahveci.bs/craft-coder.git" >&2
  echo "    cd craft-coder && node sdk/cli.mjs \"merhaba\"" >&2
  exit 1
fi
