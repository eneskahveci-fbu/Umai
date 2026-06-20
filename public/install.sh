#!/usr/bin/env sh
# Craft Coder CLI — tek komut kurulum (Mac & Linux)
#   curl -fsSL https://craft-coder.vercel.app/install.sh | sh
#
# Kurar:
#   craft-coder            → terminalde AI kod ajanı (Claude Code gibi)
#   craft-coder config     → model/anahtar ayarla
#   craft-coder bridge     → web uygulamasına gerçek terminal + dosya köprüsü
# Ajan yalnız Node 18+ ister. Köprü ayrıca node-pty derler (opsiyonel).
set -e

BASE="${CRAFT_BASE:-https://craft-coder.vercel.app}"
DIR="$HOME/.craft-coder"

b='\033[38;2;200;168;126m'; g='\033[32m'; y='\033[33m'; r='\033[31m'; z='\033[0m'
printf "${b}▶ Craft Coder CLI kuruluyor…${z}\n"

if ! command -v node >/dev/null 2>&1; then
  printf "${r}✗ Node.js (>= 18) gerekli.${z} Kur: https://nodejs.org\n" >&2; exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  printf "${r}✗ curl gerekli.${z}\n" >&2; exit 1
fi

mkdir -p "$DIR"
printf "→ İndiriliyor…\n"
curl -fsSL "$BASE/craft.mjs" -o "$DIR/craft.mjs"
curl -fsSL "$BASE/bridge.mjs" -o "$DIR/bridge.mjs"
curl -fsSL "$BASE/bridge.package.json" -o "$DIR/package.json"

# Köprü bağımlılıkları (node-pty/ws) — opsiyonel; başarısız olursa ajan yine çalışır.
printf "→ Köprü bağımlılıkları (opsiyonel, node-pty derlenir)…\n"
if ! ( cd "$DIR" && npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1 ); then
  printf "${y}! Köprü bağımlılığı kurulamadı (ajan yine çalışır).${z}\n"
  printf "${y}  'craft-coder bridge' istersen: Mac → xcode-select --install ; Linux → sudo apt install build-essential python3${z}\n"
fi

# `craft-coder` başlatıcısı → ajan (tüm argümanları geçirir)
LAUNCH="$DIR/craft-coder"
cat > "$LAUNCH" <<EOF
#!/usr/bin/env sh
exec node "$DIR/craft.mjs" "\$@"
EOF
chmod +x "$LAUNCH"

# PATH'e bağla
BIN=""
for d in "$HOME/.local/bin" "/usr/local/bin"; do
  [ -d "$d" ] && [ -w "$d" ] && { BIN="$d"; break; }
done
if [ -n "$BIN" ]; then
  ln -sf "$LAUNCH" "$BIN/craft-coder"
  printf "${g}✓ Kuruldu.${z}\n"
else
  printf "${g}✓ Kuruldu:${z} $LAUNCH\n"
  printf "  PATH'e ekle:  sudo ln -sf \"$LAUNCH\" /usr/local/bin/craft-coder\n"
fi
printf "\n  ${b}craft-coder config${z}   model + anahtar ayarla (Gemini/DeepSeek/Qwen…)\n"
printf "  ${b}craft-coder${z}          bir proje klasöründe AI kod ajanını başlat\n"
printf "  ${b}craft-coder bridge${z}   web uygulamasına terminal + dosya köprüsü\n"
