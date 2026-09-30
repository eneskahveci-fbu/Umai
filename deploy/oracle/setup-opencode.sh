#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# craft.ai — Hibrit köprünün terminaline opencode (açık kaynak AI kodlama
# ajanı, https://opencode.ai) kur → terminalde `opencode` yazınca açılır.
#
# ÖN KOŞUL: deploy/oracle/setup.sh zaten çalıştırılmış olmalı.
# Opsiyonel: deploy/oracle/setup-llm.sh de kuruluysa opencode otomatik olarak
# o yerel Ollama modeline bağlanır (anahtarsız, ücretsiz, veri dışarı çıkmaz).
#
# Ne yapar:
#   • opencode'u npm ile global kurar (/usr/bin/opencode → terminal PATH'inde)
#   • Güncel bridge.mjs'i kopyalar (xterm-256color + truecolor → TUI düzgün
#     görünür) ve craft-bridge servisini yeniden başlatır
#   • Ollama varsa ve kullanıcının kendi opencode ayarı YOKSA, craftbridge
#     kullanıcısına Ollama sağlayıcılı bir opencode.json yazar
#
# Kullanım:   sudo bash deploy/oracle/setup-opencode.sh
# Güncelleme: aynı komutu tekrar çalıştır (en son sürüme yükseltir)
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Lütfen sudo ile çalıştır: sudo bash $0"; exit 1; }

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BRIDGE_SRC="$REPO_DIR/scripts/terminal-bridge"
UNIT_FILE="/etc/systemd/system/craft-bridge.service"
BRIDGE_HOME="/opt/craft-bridge"

[ -f "$UNIT_FILE" ] || {
  echo "craft-bridge servisi bulunamadı. Önce Hibrit Sunucu'yu kur:"
  echo "  sudo bash $REPO_DIR/deploy/oracle/setup.sh"
  exit 1
}
command -v npm >/dev/null 2>&1 || { echo "npm bulunamadı (setup.sh Node'u kurmuş olmalıydı)."; exit 1; }

echo "→ opencode kuruluyor (npm: opencode-ai@latest)…"
npm install -g --no-audit --no-fund opencode-ai@latest
OC_BIN="$(command -v opencode || true)"
[ -n "$OC_BIN" ] || { echo "opencode kuruldu ama PATH'te bulunamadı."; exit 1; }
# Terminal craftbridge kullanıcısıyla, systemd'nin varsayılan PATH'iyle açılır
# (/usr/local/bin:/usr/bin:…). npm önekinin bin'i orada değilse bağla.
case "$OC_BIN" in
  /usr/bin/*|/usr/local/bin/*) ;;
  *) ln -sf "$OC_BIN" /usr/local/bin/opencode; OC_BIN=/usr/local/bin/opencode ;;
esac
OC_VER="$(sudo -u craftbridge -H "$OC_BIN" --version 2>/dev/null || echo '?')"
echo "   opencode $OC_VER → $OC_BIN"

echo "→ Köprü güncelleniyor (256 renk + truecolor)…"
if [ -f "$BRIDGE_SRC/bridge.mjs" ]; then
  cp "$BRIDGE_SRC/bridge.mjs" "$BRIDGE_HOME/bridge.mjs"
  chown craftbridge:craftbridge "$BRIDGE_HOME/bridge.mjs"
fi

# Ollama (setup-llm.sh) varsa opencode'u ona bağla — kullanıcının ayarını ezme.
CFG_DIR="$BRIDGE_HOME/.config/opencode"
CFG="$CFG_DIR/opencode.json"
MODEL_NOTE="Model: opencode içinde /connect ile bir sağlayıcı anahtarı ekle."
if [ -f "$CFG" ]; then
  MODEL_NOTE="Mevcut opencode ayarın korundu: $CFG"
elif command -v ollama >/dev/null 2>&1; then
  MODEL="$(ollama list 2>/dev/null | awk 'NR>1 && $1!="" {print $1; exit}')"
  if [ -n "$MODEL" ]; then
    install -d -o craftbridge -g craftbridge "$BRIDGE_HOME/.config" "$CFG_DIR"
    cat >"$CFG" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (bu sunucu)",
      "options": { "baseURL": "http://127.0.0.1:11434/v1" },
      "models": { "${MODEL}": { "name": "${MODEL} (yerel)" } }
    }
  },
  "model": "ollama/${MODEL}"
}
EOF
    chown craftbridge:craftbridge "$CFG"
    MODEL_NOTE="Model: yerel Ollama → ${MODEL} (anahtarsız). Değiştirmek için: $CFG"
  fi
fi

systemctl restart craft-bridge

cat <<EOF

════════════════════════════════════════════════════════════════════════
✅ opencode HAZIR (${OC_VER})

Uygulamada terminali aç (açıksa ⟳ ile yeniden bağlan) ve yaz:

    opencode

Çalışma dizini: ${BRIDGE_HOME}/workspace (repo'yu oraya klonla, sonra
cd ile içine girip opencode yaz).
${MODEL_NOTE}

Güncellemek için bu komutu tekrar çalıştır.
════════════════════════════════════════════════════════════════════════
EOF
