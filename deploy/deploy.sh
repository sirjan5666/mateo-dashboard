#!/usr/bin/env bash
# ── Build + (re)start Mateo ───────────────────────────────────────────────────
# Run on the box, as root, with the app source present at /opt/mateo.
# Safe to re-run for every update (git pull … && sudo bash deploy/deploy.sh).
set -euo pipefail
APP_DIR=/opt/mateo

echo "==> Building server (TypeScript → dist/)"
cd "$APP_DIR/server"
npm ci --include=dev          # --include=dev: NODE_ENV=production would skip tsc/build tools
npm run build

echo "==> Building client (Vite → client/dist/)"
cd "$APP_DIR/client"
npm ci --include=dev
npm run build

echo "==> Permissions (service runs as the 'mateo' user)"
chown -R mateo:mateo "$APP_DIR"

echo "==> systemd service"
cp "$APP_DIR/deploy/mateo.service" /etc/systemd/system/mateo.service
systemctl daemon-reload
systemctl enable mateo
systemctl restart mateo

echo "==> Caddy"
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

sleep 2
echo "==> Health check"
curl -fsS http://127.0.0.1:4000/api/health && echo "  ← API is up" || echo "  ✗ API not responding — check: journalctl -u mateo -n 50 --no-pager"
echo "==> Done. Live at your domain over HTTPS once DNS points here."
