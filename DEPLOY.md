# Deploying to Railway

This guide publishes the payroll system for HR to use. The app keeps its
**SQLite** database (no migration needed) stored on a Railway **volume** so
data survives deploys and restarts.

---

## 1. Push the code to GitHub

The repo currently has only local history. Create a GitHub repo and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin master
```

## 2. Create the project on Railway

1. Go to [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** and pick this repo.
2. Railway auto-detects Next.js. Open the service's **Settings** and confirm:
   - **Build Command:** `npm run build` (this runs `prisma generate && next build`)
   - **Start Command:** `npm start` (this runs `prisma db push` + seed + `next start`)

## 3. Add a volume for the database

1. In the service → **Settings** → **Volumes** → **+ New Volume**.
2. **Mount path:** `/data`
3. The SQLite file will live at `/data/dev.db`.

## 4. Set environment variables

In the service → **Variables**, add:

| Variable         | Value                | Notes                                              |
| ---------------- | -------------------- | -------------------------------------------------- |
| `DATABASE_URL`   | `file:/data/dev.db`  | Points at the volume so data persists              |
| `JWT_SECRET`     | *(long random string)* | Signs login sessions — use a fresh random value  |
| `NODE_ENV`       | `production`         | Set automatically by Railway usually               |

Generate a strong secret locally with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Optional — custom login accounts

By default the first start creates these accounts (change the passwords
immediately after first login, or override here):

| Variable              | Default                 |
| --------------------- | ----------------------- |
| `SEED_ADMIN_EMAIL`    | `admin@1megacore.com`   |
| `SEED_ADMIN_PASSWORD` | `ChangeMe-Admin-2026`   |
| `SEED_HR_EMAIL`       | `hr@1megacore.com`      |
| `SEED_HR_PASSWORD`    | `ChangeMe-HR-2026`      |

## 5. Generate a public URL

In **Settings** → **Networking** → **Generate Domain**. HR logs in at that URL.

## 6. First login

1. Log in as the **ADMIN** account.
2. Go to **User Accounts** and change the default passwords.
3. Create the HR account if you overrode the seed emails, then have HR:
   - Add employees under **Employees**
   - Add project sites under **Project Sites**
   - Record attendance, create payroll periods, and compute payroll

---

## What happens on every deploy

- `npm run build` → `prisma generate && next build`
- `npm start` →
  1. `prisma db push --skip-generate` — applies any schema changes (safe, non-destructive)
  2. `node prisma/seed-prod.js` — idempotent: only creates missing departments and the ADMIN/HR accounts; never touches existing data
  3. `next start`

## Backups

The whole database is one file at `/data/dev.db` on the volume. Download it
occasionally (Railway volume file browser) or use Railway's volume backup
feature — especially before payroll runs.

## Troubleshooting

- **"All fields are required" on login setup** — the seed only runs when the
  users don't exist; check deploy logs for `Production seed complete.`
- **Sessions log out after every deploy** — you changed `JWT_SECRET`;
  keep it constant per environment.
- **Database errors after changing the schema** — confirm `DATABASE_URL`
  points to `/data/dev.db` (the volume), not the container's ephemeral disk.
