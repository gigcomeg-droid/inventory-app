# Deployment

This app has no external API dependencies — the only outside services it
needs are a Postgres database and, if you want it on the public internet, a
host to run the Node.js server. The recommended path below uses three free
services together: **GitHub** (stores the code), **Neon** (hosted Postgres),
and **Vercel** (runs the app and deploys automatically whenever you push to
GitHub). If you'd rather keep everything on hardware you control, see
Options A–C further down for local/private-server alternatives.

## Recommended: Deploy online (GitHub + Vercel + Neon Postgres)

1. **Create a Postgres database** — sign up at [neon.tech](https://neon.tech)
   (free tier) and create a project. Copy the **pooled** connection string
   (for `DATABASE_URL`) and the **direct** connection string (for
   `DIRECT_URL`) from its dashboard — Neon labels these clearly. (Using
   Vercel's own "Storage → Postgres" tab instead of Neon directly works the
   same way and auto-fills these env vars for you.)
2. **Push the code to GitHub** — from the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Create a new empty repository on github.com (no README/license — you
   already have files), then:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
3. **Import the repo into Vercel** — sign up at [vercel.com](https://vercel.com)
   with your GitHub account, click "Add New → Project", and select the repo.
   Vercel auto-detects Next.js.
4. **Set environment variables** in the Vercel project settings before the
   first deploy: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (generate with
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`),
   `SESSION_MAX_AGE` (e.g. `28800`).
5. **Set the build command** — in Vercel project settings → Build & Development
   Settings, override the build command to:
   ```
   npm run vercel-build
   ```
   (This runs `prisma generate && prisma migrate deploy && next build`, so
   your database schema is created/updated automatically on every deploy.)
6. **Deploy.** Vercel gives you a live `https://your-app.vercel.app` URL.
7. **Seed demo data once** — migrations create empty tables; they don't add
   the sample rooms/items/users. Easiest way: temporarily point your local
   `.env`'s `DATABASE_URL`/`DIRECT_URL` at the same Neon database and run
   `npm run db:seed` once from your own machine. (Since production and local
   dev now share one database by default, you generally won't need to do
   this again — just don't re-run the seed script against a database that
   already has real data in it, since it always inserts rather than
   upserting.)

After this, every `git push` to `main` automatically redeploys the live site.

## Option A: Local Postgres only, no hosting (offline use)

Good for a single small office / a handful of users on a LAN, no internet
required. Install Postgres locally (or point at any reachable Postgres
server) and use it exactly like the online setup above, just with a local
connection string instead of Neon's.

### Build & run

```bash
npm install
npm run db:generate
npm run db:migrate:deploy   # applies committed migrations to your Postgres DB
npm run build
npm run start                # starts Next.js in production mode (default port 3000)
```

Set `PORT` in `.env` (or `PORT=8080 npm run start`) to change the port. Make
sure `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET` are set in `.env` on the
server, the same as local setup.

### Keeping it running: PM2

[PM2](https://pm2.keymetrics.io/) is the simplest way to keep the app
running and auto-restart it on crash or reboot.

```bash
npm install -g pm2
```

`ecosystem.config.js` (place at project root):

```js
module.exports = {
  apps: [
    {
      name: "inventory-app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/opt/inventory-app",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # prints a command to run once, so PM2 resurrects apps on boot
```

### Keeping it running: systemd

`/etc/systemd/system/inventory-app.service`:

```ini
[Unit]
Description=Inventory App (Next.js)
After=network.target

[Service]
Type=simple
User=inventory
WorkingDirectory=/opt/inventory-app
EnvironmentFile=/opt/inventory-app/.env
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now inventory-app
sudo systemctl status inventory-app
```

## Option B: Self-hosted Postgres server (instead of Neon)

If you'd rather run Postgres yourself on the same private server instead of
using Neon:

1. **Create the database and user** (run as the `postgres` superuser):

   ```sql
   CREATE USER inventory_user WITH PASSWORD 'CHANGE_ME';
   CREATE DATABASE inventory_db OWNER inventory_user;
   ```

2. **Set `DATABASE_URL` and `DIRECT_URL`** in `.env` on the server to the
   same value, since there's no separate pooler:

   ```
   DATABASE_URL="postgresql://inventory_user:CHANGE_ME@localhost:5432/inventory_db?schema=public"
   DIRECT_URL="postgresql://inventory_user:CHANGE_ME@localhost:5432/inventory_db?schema=public"
   ```

3. **Apply migrations and seed** (first deploy only for seed):

   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   npm run db:seed        # optional — loads demo data, skip for a real deployment
   npm run build
   npm run start
   ```

   Use the same PM2 / systemd setup as Option A to keep the process alive.

## Option C: Docker (Postgres + app)

A `Dockerfile` and `docker-compose.yml` are provided at the project root for
a one-command deployment with Postgres.

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, and set DATABASE_URL to match the compose
# service (already pre-filled to match docker-compose.yml's db service).

docker compose up -d --build
```

This starts two services:

- `db` — PostgreSQL 16, data persisted in a named volume (`pgdata`).
- `app` — the Next.js app, built via a multi-stage Dockerfile, running
  `prisma migrate deploy` and then `next start` on container start.

The app is reachable at `http://<server-ip>:3000`. To load demo data inside
the container:

```bash
docker compose exec app npm run db:seed
```

To view logs or stop:

```bash
docker compose logs -f app
docker compose down          # stop (data volume is preserved)
docker compose down -v       # stop and delete the Postgres data volume
```

## Reverse proxy (Nginx)

Recommended so the app is reachable on port 80/443 under a friendly LAN
hostname instead of `:3000`.

```nginx
server {
    listen 80;
    server_name inventory.local;   # your private LAN hostname

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### HTTPS (optional)

- **LAN-only, no internet reachability**: generate a self-signed cert:

  ```bash
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/inventory.key \
    -out /etc/nginx/ssl/inventory.crt \
    -subj "/CN=inventory.local"
  ```

  Add `listen 443 ssl;`, `ssl_certificate`, and `ssl_certificate_key`
  directives to the server block above. Browsers will show a trust warning
  the first time (expected for self-signed certs on a private network).

- **Server is internet-reachable with a real domain**: use
  [Let's Encrypt](https://letsencrypt.org/) via `certbot`:

  ```bash
  sudo certbot --nginx -d inventory.example.com
  ```

  Certbot edits the Nginx config and sets up auto-renewal automatically.

## Backups

### SQLite

The entire database is a single file (`prisma/dev.db` by default, or
wherever `DATABASE_URL` points). Back it up by copying the file while the
app is idle, or use SQLite's `.backup` command for a safe hot copy:

```bash
sqlite3 prisma/dev.db ".backup /backups/inventory-$(date +%F).db"
```

Cron example (nightly at 2 AM):

```
0 2 * * * sqlite3 /opt/inventory-app/prisma/dev.db ".backup /backups/inventory-$(date +\%F).db"
```

### PostgreSQL

Use `pg_dump` for logical backups:

```bash
pg_dump -U inventory_user -h localhost inventory_db > /backups/inventory-$(date +%F).sql
```

Cron example (nightly at 2 AM, gzip the dump, keep last 14 days):

```
0 2 * * * pg_dump -U inventory_user -h localhost inventory_db | gzip > /backups/inventory-$(date +\%F).sql.gz
0 3 * * * find /backups -name 'inventory-*.sql.gz' -mtime +14 -delete
```

Store the `PGPASSWORD` env var or a `~/.pgpass` file for the cron user so the
dump runs non-interactively.

## Environment variables reference

| Variable          | Required | Default                | Description |
|---------------------|:--------:|-------------------------|--------------|
| `DATABASE_URL`      | Yes      | —         | Postgres connection string the running app uses (the *pooled* one, if your provider gives you both). |
| `DIRECT_URL`      | Yes      | —         | Postgres connection string used for migrations (the *direct*, non-pooled one — set equal to `DATABASE_URL` if you only have one). |
| `JWT_SECRET`         | Yes      | —                        | Long random secret used to sign session JWTs. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `SESSION_MAX_AGE`    | No       | `28800` (8 hours)        | Session cookie lifetime, in seconds. |
| `NODE_ENV`           | No       | `development`            | Set to `production` for deployed builds. |
| `PORT`               | No       | `3000`                   | Port `next start` listens on. |
