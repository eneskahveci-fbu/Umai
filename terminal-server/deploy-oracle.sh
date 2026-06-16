#!/usr/bin/env bash
# craft.ai — Oracle Cloud (Ubuntu ARM) için KALICI terminal sunucusu kurulumu.
# Tek komutla: Node + derleme araçları + bağımlılıklar + systemd servisi (boot'ta
# başlar, çökerse yeniden başlar, SSH kapanınca yaşamaya devam eder) + güvenlik
# duvarı portu. Böylece craft.ai gerçek, kalıcı bir Linux shell'e bağlanır.
#
# Kullanım (Oracle VM'de, bu dizinde):
#   chmod +x deploy-oracle.sh
#   TERMINAL_TOKEN=gizli_sifre ./deploy-oracle.sh
#
# NOT: Oracle Cloud konsolunda Security List → Ingress'te ilgili portu (7071)
# AYRICA açman gerekir (script bulut tarafını değiştiremez).
set -euo pipefail

PORT="${PORT:-7071}"
TOKEN="${TERMINAL_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(openssl rand -hex 16 2>/dev/null || date +%s%N | sha256sum | cut -c1-32)"
  echo "ℹ TERMINAL_TOKEN verilmedi — rastgele üretildi: $TOKEN"
fi
DIR=/opt/craftai-terminal
USER_NAME="$(whoami)"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Node.js ve derleme araçları kuruluyor…"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo apt-get update -y
sudo apt-get install -y build-essential python3 git

echo "▶ Sunucu dosyaları $DIR konumuna kuruluyor…"
sudo mkdir -p "$DIR"
sudo cp "$SRC_DIR/server.js" "$SRC_DIR/package.json" "$DIR/"
sudo chown -R "$USER_NAME":"$USER_NAME" "$DIR"
cd "$DIR"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo "▶ Ortam dosyası (.env) yazılıyor…"
cat > "$DIR/.env" <<EOF
PORT=$PORT
TERMINAL_TOKEN=$TOKEN
SHELL=/bin/bash
EOF
chmod 600 "$DIR/.env"

echo "▶ systemd servisi kuruluyor (kalıcı + otomatik yeniden başlatmalı)…"
sudo tee /etc/systemd/system/craftai-terminal.service >/dev/null <<EOF
[Unit]
Description=craft.ai Terminal Server (WebSocket PTY)
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$DIR
EnvironmentFile=$DIR/.env
ExecStart=$(command -v node) $DIR/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now craftai-terminal

echo "▶ Güvenlik duvarı portu ($PORT) açılıyor (Oracle iptables + ufw)…"
sudo iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
command -v netfilter-persistent >/dev/null 2>&1 && sudo netfilter-persistent save 2>/dev/null || true
command -v ufw >/dev/null 2>&1 && sudo ufw allow "$PORT"/tcp 2>/dev/null || true

IP="$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo '<sunucu-ip>')"
cat <<EOF

✅ Kurulum tamamlandı. Servis çalışıyor (boot'ta otomatik başlar, çökerse yeniden
   başlar, SSH oturumu kapansa bile yaşar).
   Durum : sudo systemctl status craftai-terminal
   Log   : journalctl -u craftai-terminal -f

   craft.ai → Ayarlar → Terminal Sunucusu:
     ws://$IP:$PORT?token=$TOKEN

   ⚠ craft.ai HTTPS olduğundan tarayıcı 'wss://' (güvenli) bekler. Alan adı/cert
   yoksa ücretsiz Cloudflare Tunnel ile wss elde et:
     cloudflared tunnel --url ws://localhost:$PORT
   → verilen https adresini wss://...trycloudflare.com?token=$TOKEN olarak kullan.
EOF
