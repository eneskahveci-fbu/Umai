#!/usr/bin/env sh
# Craft Coder CLI — tek komut kurulum (Mac & Linux)
#   curl -fsSL https://craft-coder.vercel.app/install.sh | sh
#
# Ne yapar: bilgisayarına yerel "terminal köprüsü" kurar. Bir proje klasöründe
# `craft-coder` yazınca, o klasörün GERÇEK terminali + dosya sistemi web
# uygulamasına bağlanır (Ayarlar → Hibrit Sunucu). Sahte npm paketi yok —
# var olan, çalışan köprüyü (node-pty + ws) indirip kurar.
set -e

BASE="${CRAFT_BASE:-https://craft-coder.vercel.app}"
DIR="$HOME/.craft-coder"
PORT="${PORT:-7777}"

b='\033[38;2;200;168;126m'; g='\033[32m'; r='\033[31m'; z='\033[0m'
printf "${b}▶ Craft Coder yerel terminal köprüsü kuruluyor…${z}\n"

if ! command -v node >/dev/null 2>&1; then
  printf "${r}✗ Node.js (>= 18) gerekli.${z} Kur: https://nodejs.org\n" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  printf "${r}✗ npm bulunamadı (Node.js ile gelir).${z}\n" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  printf "${r}✗ curl gerekli.${z}\n" >&2
  exit 1
fi

mkdir -p "$DIR"
printf "→ Köprü dosyaları indiriliyor…\n"
curl -fsSL "$BASE/bridge.mjs" -o "$DIR/bridge.mjs"
curl -fsSL "$BASE/bridge.package.json" -o "$DIR/package.json"

printf "→ Bağımlılıklar kuruluyor (node-pty derlenir, biraz sürebilir)…\n"
if ! ( cd "$DIR" && npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1 ); then
  printf "${r}✗ Bağımlılık kurulamadı — node-pty derleme araçları gerekiyor.${z}\n" >&2
  printf "  Mac:   xcode-select --install\n" >&2
  printf "  Linux: sudo apt-get install -y build-essential python3\n" >&2
  printf "  Ardından bu komutu tekrar çalıştır.\n" >&2
  exit 1
fi

# Kalıcı erişim token'ı (bir kez üret, sakla)
TOKEN_FILE="$DIR/token"
if [ ! -f "$TOKEN_FILE" ]; then
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))" > "$TOKEN_FILE"
fi

# `craft-coder` başlatıcısı — bulunduğun klasörü (proje) köprüye verir.
LAUNCH="$DIR/craft-coder"
cat > "$LAUNCH" <<EOF
#!/usr/bin/env sh
TOKEN="\$(cat "$TOKEN_FILE")"
printf "\n  ${b}Craft Coder köprüsü çalışıyor.${z} Uygulamada Ayarlar -> Hibrit Sunucu'ya yapıştır:\n"
printf "    ${b}ws://localhost:$PORT/?token=\$TOKEN${z}\n\n"
exec env HOST=127.0.0.1 PORT=$PORT TOKEN="\$TOKEN" WORK_DIR="\$(pwd)" node "$DIR/bridge.mjs"
EOF
chmod +x "$LAUNCH"

# PATH'e bağla (yazılabilir ilk dizine)
BIN=""
for d in "$HOME/.local/bin" "/usr/local/bin"; do
  [ -d "$d" ] && [ -w "$d" ] && { BIN="$d"; break; }
done
if [ -n "$BIN" ]; then
  ln -sf "$LAUNCH" "$BIN/craft-coder"
  printf "${g}✓ Kuruldu.${z} Bir proje klasöründe çalıştır:  ${b}craft-coder${z}\n"
else
  printf "${g}✓ Kuruldu.${z} Çalıştır:  ${b}$LAUNCH${z}\n"
  printf "  PATH'e eklemek için:  sudo ln -sf \"$LAUNCH\" /usr/local/bin/craft-coder\n"
fi
printf "  Calisinca verdigi ${b}ws://localhost:$PORT/?token=...${z} adresini uygulamada\n"
printf "  Ayarlar -> Hibrit Sunucu alanina yapistir -> terminal + dosya sistemi baglanir.\n"
