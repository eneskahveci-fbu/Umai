#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# craft.ai — Hibrit köprüye Laya (yerel karar modeli) MCP aracı ekle
#
# Laya (github.com/NandhaKishorM/laya, Apache 2.0) bir SOHBET modeli değil:
# metin + "tipli sorular" alır, seçim / puan / evet-hayır kararı döner (100+
# dil). craft.ai'da sohbetteki modelin ÇAĞIRABİLDİĞİ bir araçtır (MCP).
#
# ÖN KOŞUL: deploy/oracle/setup.sh ile hibrit köprü kurulu olmalı.
#
# İKİ ÇALIŞMA MODU (ikisi de aynı sonucu verir):
#   1) SSH ile:                         sudo bash deploy/oracle/setup-laya.sh
#   2) SSH yoksa, uygulamanın kendi terminalinden (köprü kullanıcısı olarak,
#      sudo'suz):                        bash deploy/oracle/setup-laya.sh
#      → Python'u uv ile kullanıcı klasörüne kurar, köprüyü günceller ve
#        yeniden başlatır (systemd otomatik geri açar; terminal birkaç saniye
#        kopar, ⟳ ile yeniden bağlan).
#
# Ne yapar:
#   • Ayrı bir Python ortamına CPU'luk PyTorch + "laya[mcp]" kurar
#   • Model ağırlıklarını Hugging Face'ten bir kez indirir (varsayılan yalnız
#     çok dilli ~322M checkpoint — Türkçe dahil; RAM dostu)
#   • Köprünün mcp-servers.json'una "laya" girdisini ekler (varsa korur)
#   • Güncel bridge.mjs'i kopyalar (kalıcı yerel MCP: /mcp/local/<ad>)
#
# Sonra: craft.ai → Eklentiler → "Laya (karar modeli)" kartını aç. Hibrit
# sunucun Ayarlar'da bağlıysa adres + token otomatik dolar.
#
# Ortam değişkenleri (opsiyonel):
#   LAYA_MODELS   Önceden yüklenecek checkpoint'ler (varsayılan: multilingual;
#                 ör. "english,multilingual")
#   FORCE=1       Düşük RAM uyarısını geç
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BRIDGE_SRC="$REPO_DIR/scripts/terminal-bridge/bridge.mjs"
BRIDGE_HOME="/opt/craft-bridge"
LAYA_MODELS="${LAYA_MODELS:-multilingual}"
[ -f "$BRIDGE_SRC" ] || { echo "bridge.mjs bulunamadı ($BRIDGE_SRC). Repo içinden çalıştır."; exit 1; }
[ -d "$BRIDGE_HOME" ] || { echo "$BRIDGE_HOME yok — önce hibrit köprüyü kur: sudo bash $REPO_DIR/deploy/oracle/setup.sh"; exit 1; }

TOTAL_RAM_MB="$(awk '/MemTotal/{printf "%.0f", $2/1024}' /proc/meminfo)"
if [ "$TOTAL_RAM_MB" -lt 3000 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "⚠️  Toplam RAM ${TOTAL_RAM_MB}MB — Laya + PyTorch için en az ~3GB önerilir"
  echo "    (Oracle Ampere A1 uygundur; AMD E2.1.Micro 1GB yetmez). Yine de denemek için: FORCE=1"
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  MODE="root"; RUN_AS="sudo -u craftbridge -H"
else
  MODE="user"; RUN_AS=""
  [ -w "$BRIDGE_HOME" ] || { echo "$BRIDGE_HOME yazılabilir değil — ya sudo ile çalıştır ya da uygulamanın terminalinden (köprü kullanıcısıyla)."; exit 1; }
fi
VENV="$BRIDGE_HOME/laya-venv"
echo "→ Mod: $MODE · ortam: $VENV · checkpoint: $LAYA_MODELS"

# 1) Python ortamı --------------------------------------------------------
if [ "$MODE" = "root" ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y python3-venv python3-pip >/dev/null
  PYV="$(python3 -c 'import sys;print(sys.version_info >= (3,10))')"
  [ "$PYV" = "True" ] || { echo "Python 3.10+ gerekli (Ubuntu 22.04 varsayılanı uygundur)."; exit 1; }
  [ -x "$VENV/bin/python" ] || $RUN_AS python3 -m venv "$VENV"
  PIP="$RUN_AS $VENV/bin/pip"
  $PIP install -q --upgrade pip
  echo "→ PyTorch (CPU) kuruluyor…"
  $PIP install -q torch --index-url https://download.pytorch.org/whl/cpu
  echo "→ laya[mcp] kuruluyor…"
  $PIP install -q "laya[mcp]"
else
  # sudo yok → uv (tek dosya, kullanıcı klasörüne) sistem paketine dokunmadan Python getirir
  UV="$HOME/.local/bin/uv"
  if [ ! -x "$UV" ]; then
    echo "→ uv kuruluyor (kullanıcı klasörüne)…"
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null
  fi
  [ -x "$VENV/bin/python" ] || "$UV" venv "$VENV" --python 3.11
  echo "→ PyTorch (CPU) kuruluyor…"
  "$UV" pip install -q --python "$VENV/bin/python" torch --index-url https://download.pytorch.org/whl/cpu
  echo "→ laya[mcp] kuruluyor…"
  "$UV" pip install -q --python "$VENV/bin/python" "laya[mcp]"
fi
[ -x "$VENV/bin/laya-mcp-server" ] || { echo "laya-mcp-server bulunamadı — kurulum başarısız."; exit 1; }

# 2) Ağırlıkları bir kez indir (stdin kapalı → önyüklemeden sonra kendiliğinden çıkar)
echo "→ Model ağırlıkları indiriliyor ($LAYA_MODELS) — ilk seferde birkaç dakika sürebilir…"
echo | $RUN_AS env LAYA_MODELS="$LAYA_MODELS" timeout 1800 "$VENV/bin/laya-mcp-server" >/dev/null 2>&1 || true

# 3) mcp-servers.json'a "laya" girdisi (diğer girdiler korunur) --------------
CFG="$BRIDGE_HOME/mcp-servers.json"
THREADS="$(nproc 2>/dev/null || echo 2)"
$RUN_AS "$VENV/bin/python" - "$CFG" "$VENV/bin/laya-mcp-server" "$LAYA_MODELS" "$THREADS" <<'PY'
import json, os, sys
path, cmd, models, threads = sys.argv[1:5]
try:
    with open(path) as f:
        cfg = json.load(f)
    if not isinstance(cfg, dict):
        cfg = {}
except Exception:
    cfg = {}
cfg["laya"] = {"command": cmd, "args": [], "env": {"LAYA_MODELS": models, "LAYA_THREADS": threads}}
with open(path, "w") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print("   " + path + " güncellendi")
PY

# 4) Köprüyü güncelle + yeniden başlat --------------------------------------
cp "$BRIDGE_SRC" "$BRIDGE_HOME/bridge.mjs"
if [ "$MODE" = "root" ]; then
  chown craftbridge:craftbridge "$BRIDGE_HOME/bridge.mjs" "$CFG"
  systemctl restart craft-bridge
else
  echo "→ Köprü yeniden başlatılıyor — terminal birkaç saniye kopacak, ⟳ ile yeniden bağlan."
  # systemd (Restart=always) süreci kendiliğinden geri açar
  (sleep 1; pkill -u "$(id -un)" -f "node $BRIDGE_HOME/bridge.mjs") >/dev/null 2>&1 &
fi

cat <<EOF

════════════════════════════════════════════════════════════════════════
✅ Laya HAZIR (MCP aracı: /mcp/local/laya)

craft.ai → Eklentiler → "Laya (karar modeli)" kartını AÇ.
  • Hibrit sunucun Ayarlar → Terminal & Sunucu'da bağlıysa adres + token
    otomatik dolar.
  • Değilse "Bağlı Sunucular"da adres:  https://<alan>/mcp/local/laya
    başlık: Authorization = Bearer <köprü token'ı>

Sohbette örnek: "Bu hata mesajı acil mi, hangi ekibe gider? Laya'ya sor."
(Araç çağırmayı destekleyen bir model seçili olmalı.)
EOF
