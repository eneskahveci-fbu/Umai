#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# craft.ai — Hibrit köprüye YEREL LLM (Ollama) ekle (Oracle Always Free)
#
# ÖN KOŞUL: deploy/oracle/setup.sh zaten çalıştırılmış olmalı (Hibrit Sunucu
# kurulu, /opt/craft-bridge + craft-bridge systemd servisi var). Bu script
# ONA EK olarak çalışır — Caddy/güvenlik duvarı/kullanıcı ayarlarına dokunmaz.
#
# Ne yapar:
#   • Ollama'yı resmî kurulum betiğiyle kurar (kendi systemd servisi, YALNIZ
#     127.0.0.1'de dinler — dışarıya hiç açılmaz, ek güvenlik duvarı kuralı
#     GEREKMEZ).
#   • Sunucunun RAM'ine göre otomatik model seçer: ≥16GB → Qwen2.5 14B
#     (9GB indirme, çok daha güçlü), yoksa → Qwen2.5 7B (4.7GB) — ikisi de
#     Pollinations'ın ücretsiz katmanından belirgin şekilde daha güçlü VE
#     tamamen kendi sunucunda, üçüncü tarafa veri gitmeden çalışır.
#   • Güncel bridge.mjs'i (repo'daki /llm/v1/* proxy route'larıyla) kopyalar
#     ve craft-bridge servisini yeniden başlatır.
#   • Sonunda Ayarlar → Modeller'e yapıştırılacak Base URL/Anahtar/Model
#     değerlerini (mevcut token'ı systemd biriminden okuyarak) yazdırır.
#
# Kullanım (Hibrit Sunucu zaten kuruluyken, aynı VM üzerinde):
#   sudo bash deploy/oracle/setup-llm.sh
#
# Ortam değişkeni (opsiyonel):
#   CRAFT_MODEL   Otomatik seçimi geçersiz kıl (ör. CRAFT_MODEL=qwen2.5:7b)
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

[ "$(id -u)" -eq 0 ] || { echo "Lütfen sudo ile çalıştır: sudo bash $0"; exit 1; }

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BRIDGE_SRC="$REPO_DIR/scripts/terminal-bridge"
[ -f "$BRIDGE_SRC/bridge.mjs" ] || { echo "bridge.mjs bulunamadı ($BRIDGE_SRC). Repo kökünden çalıştır."; exit 1; }

UNIT_FILE="/etc/systemd/system/craft-bridge.service"
[ -f "$UNIT_FILE" ] || {
  echo "craft-bridge servisi bulunamadı. Önce Hibrit Sunucu'yu kur:"
  echo "  sudo bash $REPO_DIR/deploy/oracle/setup.sh"
  exit 1
}

TOKEN="$(grep -oP '(?<=^Environment=TOKEN=).*' "$UNIT_FILE" || true)"
DOMAIN="$(grep -oP '^\S+(?=\s*\{)' /etc/caddy/Caddyfile 2>/dev/null | head -1 || true)"
[ -n "$TOKEN" ] || { echo "Token, $UNIT_FILE içinde bulunamadı."; exit 1; }

echo "→ Ollama kuruluyor (resmî kurulum betiği)…"
if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
# Ollama'nın kendi systemd servisi varsayılan olarak yalnız 127.0.0.1'de
# dinler (OLLAMA_HOST ayarlanmadıkça) — dışarıya hiç açılmaz, ek bir
# güvenlik duvarı kuralı gerekmez.
systemctl enable --now ollama

echo "→ Sunucu belleğine göre model seçiliyor…"
TOTAL_RAM_GB="$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)"
if [ -n "${CRAFT_MODEL:-}" ]; then
  MODEL="$CRAFT_MODEL"
elif [ "$TOTAL_RAM_GB" -ge 16 ]; then
  MODEL="qwen2.5:14b"
else
  MODEL="qwen2.5:7b"
fi
echo "   Toplam RAM: ${TOTAL_RAM_GB}GB → seçilen model: ${MODEL}"
echo "→ Model indiriliyor (${MODEL}) — boyuta göre birkaç dakika sürebilir…"
ollama pull "$MODEL"

echo "→ Köprü güncelleniyor (Yerel LLM proxy route'ları)…"
cp "$BRIDGE_SRC/bridge.mjs" /opt/craft-bridge/bridge.mjs
chown craftbridge:craftbridge /opt/craft-bridge/bridge.mjs
systemctl restart craft-bridge

BASE="https://${DOMAIN:-<alan-adin>}/llm/v1"
cat <<EOF

════════════════════════════════════════════════════════════════════════
✅ YEREL LLM HAZIR — ${MODEL} artık bu sunucuda çalışıyor.

craft.ai → Ayarlar → Modeller → "Özel" sağlayıcı ekle:
  Base URL : ${BASE}
  Anahtar  : ${TOKEN}
  Model    : ${MODEL}

Bu model Pollinations'tan çok daha güçlü, tamamen bu sunucunda çalışıyor
ve üçüncü tarafa hiçbir veri gitmiyor — gerçek anlamda ücretsiz ve sınırsız
(Oracle Always Free). Ollama yalnız 127.0.0.1'de dinliyor; dışarıdan tek
erişim yolu köprünün kendi token'ı.

Doğrulama:
  curl https://${DOMAIN:-<alan-adin>}/llm/v1/models \\
    -H "Authorization: Bearer ${TOKEN}"

Durum: systemctl status ollama craft-bridge
Farklı bir model dene: sudo CRAFT_MODEL=qwen2.5:7b bash $0
Modelleri listele:      ollama list
════════════════════════════════════════════════════════════════════════
EOF
