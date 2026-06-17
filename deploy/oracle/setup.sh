#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# craft.ai — Oracle (Always Free) terminal köprüsü TEK-KOMUT kurulumu
# Ubuntu 22.04 (ARM Ampere A1 veya AMD) üzerinde çalışır. Root/sudo gerekir.
#
# Ne yapar:
#   • Node + derleme araçları (node-pty derlenir) + git
#   • Terminal köprüsünü /opt/craft-bridge'e kurar, ayrı 'craftbridge'
#     kullanıcısıyla (root DEĞİL) çalıştırır → güvenli
#   • systemd servisi: makine yeniden başlasa bile otomatik açılır
#   • Caddy ile OTOMATİK HTTPS (yeşil kilit) + ws→wss reverse proxy
#   • OS güvenlik duvarında yalnız 80/443 açar
#   • Sonunda uygulamaya yapıştırılacak  wss://…/?token=…  adresini yazar
#
# Kullanım (repo klonlandıktan sonra):
#   sudo bash deploy/oracle/setup.sh [alan-adı]
#   (alan-adı verilmezse otomatik  <ip>.sslip.io  kullanılır — ücretsiz)
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

[ "$(id -u)" -eq 0 ] || { echo "Lütfen sudo ile çalıştır: sudo bash $0"; exit 1; }

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BRIDGE_SRC="$REPO_DIR/scripts/terminal-bridge"
[ -f "$BRIDGE_SRC/bridge.mjs" ] || { echo "bridge.mjs bulunamadı ($BRIDGE_SRC). Repo kökünden çalıştır."; exit 1; }

TOKEN="${CRAFT_TOKEN:-$(openssl rand -hex 16)}"
IP="$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me || true)"
DOMAIN="${1:-${IP}.sslip.io}"
[ -n "$DOMAIN" ] || { echo "Genel IP alınamadı; alan adını argüman ver: sudo bash $0 ornek.com"; exit 1; }

echo "→ Kurulum başlıyor:  alan=$DOMAIN"

# 1) Node 20 + derleme araçları (node-pty için) ----------------------------
apt-get update -y
apt-get install -y curl ca-certificates gnupg git build-essential python3 openssl
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 2) Köprü dosyaları + ayrı kullanıcı + bağımlılıklar ----------------------
id craftbridge >/dev/null 2>&1 || useradd -r -m -d /opt/craft-bridge -s /usr/sbin/nologin craftbridge
install -d -o craftbridge -g craftbridge /opt/craft-bridge
cp "$BRIDGE_SRC/bridge.mjs" "$BRIDGE_SRC/package.json" /opt/craft-bridge/
chown -R craftbridge:craftbridge /opt/craft-bridge
sudo -u craftbridge bash -lc 'cd /opt/craft-bridge && npm install --omit=dev --no-audit --no-fund'

# 3) systemd servisi (otomatik başlar, çökerse yeniden kalkar) -------------
cat >/etc/systemd/system/craft-bridge.service <<EOF
[Unit]
Description=craft.ai terminal bridge
After=network.target

[Service]
WorkingDirectory=/opt/craft-bridge
Environment=HOST=127.0.0.1
Environment=PORT=7777
Environment=TOKEN=${TOKEN}
ExecStart=/usr/bin/env node /opt/craft-bridge/bridge.mjs
Restart=always
RestartSec=3
User=craftbridge
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now craft-bridge

# 4) Caddy = otomatik HTTPS + WebSocket reverse proxy ----------------------
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
cat >/etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    reverse_proxy 127.0.0.1:7777
}
EOF
systemctl restart caddy

# 5) OS güvenlik duvarı: 80 + 443 aç (Oracle iptables varsayılanı kapalı) --
iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 443 -j ACCEPT
echo 'iptables-persistent iptables-persistent/autosave_v4 boolean true' | debconf-set-selections
echo 'iptables-persistent iptables-persistent/autosave_v6 boolean true' | debconf-set-selections
apt-get install -y netfilter-persistent iptables-persistent >/dev/null 2>&1 || true
netfilter-persistent save >/dev/null 2>&1 || true

# 6) Sonuç -----------------------------------------------------------------
cat <<EOF

════════════════════════════════════════════════════════════════════════
✅ KURULUM TAMAM.

Uygulamada  Ayarlar → (Gelişmiş) Terminal sunucu adresi  alanına yapıştır:

    wss://${DOMAIN}/?token=${TOKEN}

NOTLAR
 • Oracle konsolunda alt ağın (subnet) Security List'ine 80 ve 443 TCP
   "Ingress" kuralı eklemeyi UNUTMA (yoksa dışarıdan erişilemez).
 • HTTPS sertifikası 1-2 dk içinde otomatik alınır (ilk istekte).
 • Durum:   systemctl status craft-bridge caddy
════════════════════════════════════════════════════════════════════════
EOF
