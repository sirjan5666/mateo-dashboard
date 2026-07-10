#!/usr/bin/env bash
# ── Mateo one-time server bootstrap (fresh Ubuntu 22.04 LTS Lightsail box) ─────
# Installs Node 20 + MongoDB 7 (localhost-only, auth on) + Caddy (auto-HTTPS),
# a swapfile, a UFW firewall, a locked-down service user, and writes the app
# .env with freshly-generated secrets. Idempotent-ish; safe to read before running.
#
#   Usage:  sudo bash setup-server.sh <your-domain.com>
set -euo pipefail

DOMAIN="${1:?Usage: sudo bash setup-server.sh <your-domain.com>}"
APP_DIR=/opt/mateo
SERVER_DIR="$APP_DIR/server"
export DEBIAN_FRONTEND=noninteractive

echo "==> [1/9] System update + base packages"
apt-get update -y && apt-get upgrade -y
apt-get install -y curl gnupg ca-certificates ufw openssl

echo "==> [2/9] 2 GB swap (protects builds on a small box)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> [3/9] Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> [4/9] MongoDB 7 Community"
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")"
case "$CODENAME" in noble|jammy) REPO="$CODENAME";; *) REPO="jammy";; esac
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${REPO}/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -y && apt-get install -y mongodb-org
systemctl enable --now mongod
sleep 3

echo "==> [5/9] Caddy (auto-HTTPS reverse proxy)"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

echo "==> [6/9] Generate secrets + create the MongoDB app user (before enabling auth)"
MONGO_APP_PW="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 48)"
DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
mongosh --quiet <<EOF
use mateo
db.createUser({ user: "mateoapp", pwd: "${MONGO_APP_PW}", roles: [{ role: "readWrite", db: "mateo" }] })
EOF

echo "==> [7/9] Lock MongoDB to localhost + enable auth"
# bindIp is 127.0.0.1 by default on Ubuntu; enforce it and turn on authorization.
sed -i 's/^\(\s*bindIp:\).*/\1 127.0.0.1/' /etc/mongod.conf
if grep -qE '^\s*#?\s*security:' /etc/mongod.conf; then
  sed -i 's/^\s*#\?\s*security:.*/security:/' /etc/mongod.conf
  sed -i '/^security:/!b; n; /authorization:/!i\  authorization: enabled' /etc/mongod.conf
else
  printf '\nsecurity:\n  authorization: enabled\n' >> /etc/mongod.conf
fi
grep -q 'authorization: enabled' /etc/mongod.conf || printf '\nsecurity:\n  authorization: enabled\n' >> /etc/mongod.conf
systemctl restart mongod

echo "==> [8/9] Service user, app dirs, and the production .env"
id mateo >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin mateo
mkdir -p "$SERVER_DIR" "$SERVER_DIR/uploads"
cat > "$SERVER_DIR/.env" <<EOF
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb://mateoapp:${MONGO_APP_PW}@127.0.0.1:27017/mateo?authSource=mateo
JWT_SECRET=${JWT_SECRET}
DATA_ENCRYPTION_KEY=${DATA_ENCRYPTION_KEY}
APP_BASE_URL=https://${DOMAIN}
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
# Pre-launch: allow the labelled MOCK subscribe/checkout so it's testable before
# Razorpay LIVE keys exist. Grants the plan for FREE — remove once real keys land.
ALLOW_MOCK_PAYMENTS=true
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
ADMIN_NOTIFICATION_EMAIL=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
EOF
chmod 600 "$SERVER_DIR/.env"

echo "==> [9/9] Firewall: SSH + HTTP/HTTPS only (MongoDB never exposed)"
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# Save the encryption key separately so you have an off-box backup to store safely.
echo "$DATA_ENCRYPTION_KEY" > /root/mateo-DATA_ENCRYPTION_KEY.backup && chmod 600 /root/mateo-DATA_ENCRYPTION_KEY.backup

cat <<DONE

✅ Server bootstrap complete.
   • MongoDB: localhost-only, auth on, user 'mateoapp' created
   • Secrets written to ${SERVER_DIR}/.env (chmod 600)
   • ⚠️  BACK UP the encryption key: /root/mateo-DATA_ENCRYPTION_KEY.backup
   Next: put the app source at ${APP_DIR} and run deploy.sh
DONE
