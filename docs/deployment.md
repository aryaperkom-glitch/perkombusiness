# Deployment: GitHub → VPS → Nginx/Cloudflare → CI/CD

Target production layout:

```
You --git push--> GitHub --Actions SSH--> VPS
                                             ├── docker compose (app + db)
                                             ├── ./scripts/deploy.sh (pull/build/migrate/health)
Cloudflare (DNS + proxy/TLS) --> Nginx (or Tunnel) --> 127.0.0.1:3000
nightly ./scripts/backup.sh (cron) --> storage/backups/ (+ optional rsync replica)
```

## 1. Push to GitHub (from the local machine)

The repo is push-safe: `.env`, `storage/`, `db-backup/`, `*.ps1` are gitignored;
no credentials are tracked.

```bash
# create a PRIVATE repo on github.com first (business data in code history)
git remote add origin git@github.com:<username>/officeless.git
git add -A
git commit -m "production: docker ops, auth, storage, CI/CD"
git push -u origin main
```

## 2. VPS initial setup (Ubuntu, as root)

```bash
# Docker + compose + basics
curl -fsSL https://get.docker.com | sh
apt install -y git nginx ufw

# hardened SSH (key-only, no root login with password)
# /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin prohibit-password
systemctl restart ssh

# firewall: web + ssh only; DB/app never exposed (app binds 127.0.0.1:3000)
ufw allow "OpenSSH" && ufw allow "Nginx Full" && ufw enable
```

### Read-only GitHub access for the VPS (deploy key)

```bash
ssh-keygen -t ed25519 -f /root/.ssh/github_deploy -N ""
cat /root/.ssh/github_deploy.pub
# -> GitHub repo > Settings > Deploy keys > Add (READ-ONLY, do not tick write)
printf 'Host github.com\n  IdentityFile /root/.ssh/github_deploy\n' >> /root/.ssh/config
```

### First run of the stack

```bash
git clone git@github.com:<username>/officeless.git /opt/officeless
cd /opt/officeless

cp .env.example .env && nano .env
#   POSTGRES_PASSWORD  = strong new password
#   SESSION_SECRET     = node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
#   (SERVICEDESK_* / KIRIMI_* optional — API integrations)

# uploads dir owned by the app user (uid 1000 inside the container)
mkdir -p storage/uploads && chown 1000:1000 storage/uploads

docker compose up -d          # fresh volume -> schema from db/init/

# load existing data (from your machine: scp db-backup/vps-seed.sql root@VPS:/tmp/)
docker compose exec -T db psql -U officeless -d officeless < /tmp/vps-seed.sql

./scripts/docker.sh status    # db healthy + app HTTP 200
./scripts/backup.sh install-cron
```

## 3. Domain + Cloudflare + Nginx

DNS is already on Cloudflare (domain from Hostinger), so add the record there.

**Cloudflare:** DNS → `A  app.yourdomain.com  <VPS_IP>` proxied (orange cloud).
SSL/TLS mode → **Full (strict)**.

**Option A — Nginx + Let's Encrypt (classic, what you asked for):**

```nginx
# /etc/nginx/sites-available/officeless
server {
    listen 80;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/officeless /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d app.yourdomain.com     # auto-renews
```

**Option B — Cloudflare Tunnel (2026 best practice, zero open web ports):**
no nginx/certbot at all — Zero Trust → Networks → Tunnels → create, run the
`cloudflared` container it shows (add it to compose), point the public hostname
at `http://app:3000`. The VPS then needs no 80/443 and its IP stays hidden.

## 4. After HTTPS is live

Flip the session cookie to secure — `src/lib/auth.ts` → `sessionCookie.secure: true`
(the `# ponytail:` comment marks the spot). Commit + push; CI deploys it.

## 5. CI/CD (already in the repo)

- `.github/workflows/ci.yml` — lint + typecheck on every push/PR
- `.github/workflows/deploy.yml` — SSH to the VPS and run `./scripts/deploy.sh`

Add repo secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `VPS_HOST` | server IP or DNS name |
| `VPS_USER` | `root` (or a dedicated deploy user) |
| `VPS_SSH_KEY` | private key authorized on the VPS for that user |

Then every `git push` to `main`: CI checks → deploy job pulls, builds, migrates,
recreates and health-checks. Rollback = `git revert <sha> && git push`.

## Security checklist (2026)

- GitHub repo **private**; VPS deploy key **read-only**
- SSH: keys only, no password auth; fail2ban optional
- Only 22/80/443 open (or just 22 with Tunnel); app/db bound to localhost
- Strong `POSTGRES_PASSWORD`, unique `SESSION_SECRET` per environment
- Cloudflare proxy (hides origin IP) + **Full (strict)** + HSTS enabled
- Nightly backups (`install-cron`) + `BACKUP_REMOTE` replication off-site
- `unattended-upgrades` for OS patches; watch `./scripts/docker.sh logs app`
