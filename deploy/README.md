# Mateo — deployment (AWS Lightsail, single box)

One Ubuntu 22.04 Lightsail instance in **Mumbai (ap-south-1)** runs everything:

- **MongoDB 7** — self-hosted, bound to `127.0.0.1`, auth on, never exposed
- **Node/Express API** — `systemd` service `mateo` on `:4000`
- **Caddy** — serves the built React client + reverse-proxies `/api`, auto-HTTPS
- **Firewall** — 22 (SSH, your IP only) · 80/443 open · MongoDB not reachable externally

Files here: `setup-server.sh` (one-time bootstrap) · `Caddyfile` · `mateo.service` ·
`deploy.sh` (build + restart, re-run for updates) · `env.production.example` (reference).

---

## Phase 1 — prerequisites (you, once)

**1. Scoped IAM user** (Console → IAM → Users → Create user, no console access, attach an
inline policy — this confines the CLI to Lightsail only):

```json
{ "Version": "2012-10-17",
  "Statement": [ { "Effect": "Allow", "Action": "lightsail:*", "Resource": "*" } ] }
```
Create an **access key** for it (type: CLI).

**2. AWS CLI** — install, then:
```
aws configure         # paste the key + secret; region: ap-south-1; output: json
```
Keys are stored locally in `~/.aws/`; they never enter the chat.

**3. Budget alert** — Console → Billing → Budgets → create a **$5 monthly** cost budget with
an email alert, so credits can't drain unnoticed.

**4. Domain** — have your DNS panel open; you'll add one `A` record in Phase 4.

---

## Phase 2 — provision (assistant drives, with your OK)

```
# 2 GB Ubuntu instance in Mumbai
aws lightsail create-instances --instance-names mateo \
  --availability-zone ap-south-1a --blueprint-id ubuntu_22_04 \
  --bundle-id medium_3_0 --region ap-south-1
# static IP + firewall (SSH limited to your IP)
aws lightsail allocate-static-ip --static-ip-name mateo-ip --region ap-south-1
aws lightsail attach-static-ip --static-ip-name mateo-ip --instance-name mateo --region ap-south-1
aws lightsail put-instance-public-ports --instance-name mateo --region ap-south-1 \
  --port-infos fromPort=443,toPort=443,protocol=TCP fromPort=80,toPort=80,protocol=TCP \
               fromPort=22,toPort=22,protocol=TCP,cidrs=YOUR_IP/32
```

## Phase 3 — deploy (assistant)

```
# get the source onto the box at /opt/mateo (git clone or rsync), then:
sudo bash /opt/mateo/deploy/setup-server.sh YOUR_DOMAIN   # installs + hardens + secrets
sudo bash /opt/mateo/deploy/deploy.sh                     # builds + starts everything
```

## Phase 4 — go live

1. Point `YOUR_DOMAIN` → the static IP (DNS `A` record).
2. Caddy auto-issues HTTPS within ~30s of the DNS resolving.
3. Seed an admin (`npm run seed:user` on the box), smoke-test login + a tracker + a payment.

## Backups & ops

- **Lightsail automatic snapshots** — enable daily (whole-disk, includes MongoDB).
- Encryption key backup lives at `/root/mateo-DATA_ENCRYPTION_KEY.backup` — copy it somewhere
  safe **off the box**. Losing it makes encrypted patient data unrecoverable.
- Logs: `journalctl -u mateo -f` (app) · `journalctl -u caddy -f` (TLS/proxy).
