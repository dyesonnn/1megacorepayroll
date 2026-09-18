# 1MegaCore Payroll System

Internal payroll & HR system for a construction company. Built with Next.js,
Prisma, and SQLite.

## Features

- **Employees** — profiles, departments, project sites, skills, government IDs
- **Attendance** — daily time-in/out, late/undertime/OT tracking, attendance sheet
- **Payroll** — periods, automatic computation (basic, holiday, OT pay), manual adjustments, mark-as-paid
- **Optional OT Pay** — compute a period *without* overtime pay when funds are short; OT hours are still recorded
- **Cash Advances** — request, approve, auto-deduct from net pay, per-employee limits
- **Payslips** — printable per-employee payslips
- **Reports** — headcount, department distribution, payroll summaries

## User Roles

| Role | Access |
| --- | --- |
| **ADMIN** | Everything + user account management and cash-advance limit settings |
| **HR** | Employees, sites, attendance, holidays, payroll (incl. OT-exclude toggle), cash advances, reports |
| **EMPLOYEE** | Own dashboard, own attendance, own payslips |

---

# Part 1 — Run Locally (Development)

### Step 1: Install prerequisites
- [Node.js 20+](https://nodejs.org)
- npm (comes with Node)

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Create your `.env`
Copy the template and fill it in:
```bash
cp .env.example .env
```
Then edit `.env`:
- `DATABASE_URL=file:./dev.db` — fine as-is for local dev
- `JWT_SECRET` — generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

### Step 4: Create the database schema
```bash
npm run db:push
```

### Step 5: Seed (choose ONE)
```bash
npm run db:seed        # demo data: 8 employees, attendance, sample payroll
npm run db:seed:prod   # production-style: just departments + admin/HR accounts
```

### Step 6: Start the app
```bash
npm run dev
```
Open http://localhost:3000 and log in.

**Demo logins** (from `db:seed`):
| Account | Email | Password |
| --- | --- | --- |
| Admin | admin@1megacore.com | password123 |
| HR | hr@1megacore.com | password123 |
| Employee | employee@1megacore.com | password123 |

---

# Part 2 — Publish for HR (Railway)

The app keeps its SQLite database on a Railway **volume**, so data survives
deploys and restarts. No database migration needed.

### Step 1: Push the code to GitHub
```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin master
```

### Step 2: Create the Railway project
1. Go to [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo**
2. Select this repo — Railway auto-detects Next.js
3. In the service's **Settings**, confirm:
   - Build Command: `npm run build`
   - Start Command: `npm start`

### Step 3: Add a volume (so the database persists)
1. Service → **Settings** → **Volumes** → **+ New Volume**
2. Mount path: `/data`

### Step 4: Set environment variables
Service → **Variables** → add:

| Variable | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | `file:/data/dev.db` | Stores the DB on the volume |
| `JWT_SECRET` | a long random string | Signs login sessions |

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Optional** — set the initial login accounts (otherwise defaults are used):
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_HR_EMAIL`, `SEED_HR_PASSWORD`

### Step 5: Generate a public URL
Service → **Settings** → **Networking** → **Generate Domain**

### Step 6: Deploy and verify
Watch the deploy logs. On every start it:
1. `prisma db push` — syncs the schema (safe, non-destructive)
2. `node prisma/seed-prod.js` — creates missing departments + admin/HR accounts only (idempotent)
3. `next start`

You should see `Production seed complete.` in the logs.

### Step 7: First login & secure it
1. Log in as the ADMIN account (default: `admin@1megacore.com` / `ChangeMe-Admin-2026`)
2. **User Accounts** → change the password immediately
3. Create/verify the HR account (default: `hr@1megacore.com` / `ChangeMe-HR-2026`) — change this password too
4. If you set `SEED_*` env vars, the defaults don't apply — use those instead

### Step 8: Initial data setup (as ADMIN or HR)
1. **Employees** → add your real employees (departments are pre-seeded)
2. **Project Sites** → add active project sites
3. **Holidays** → add the company's holiday calendar for the year
4. **Cash Advances → Settings** → adjust limits if needed (ADMIN)

### Step 9: Share the URL with HR
Send HR the Railway domain. Done — they log in and work from there.

---

# Part 3 — HR Daily Usage

### Recording attendance
**Attendance** → add/edit daily records. Time-in/out is 8 AM–5 PM by default;
time logged past 5 PM becomes OT hours automatically.

### Running payroll
1. **Payroll** → **+ Create Payroll Period** → name, start/end date, pay date
2. Click **⚙️ Compute Payroll** on the period card:
   - Leave **Include OT Pay** checked → normal computation
   - **Uncheck it** to skip OT pay for this period (e.g. lack of funds) —
     confirm the dialog. OT hours are still tracked and shown as
     "Excluded" on payslips; the period gets an orange **OT Excluded** badge
   - Re-computing with the box checked later restores OT pay
3. Review amounts → use **Adjust** on any row for bonuses, allowances, deductions, etc.
4. **Mark as Paid** per employee; the period flips to PAID when everyone is
5. Open a payslip from any row to view/print it

### Cash advances
**Cash Advances** → create an advance for an employee (limits enforced).
Approved advances are automatically deducted from net pay during payroll and
linked to that payroll record. Deleting a period returns advances to PENDING.

### Employees
**Employees** → **+ Add Employee**. Employee numbers like `MGC-001` are
suggested automatically. Hire date, daily rate, and department are required —
daily rate drives all payroll math.

---

# Maintenance

### Backups
The whole database is one file at `/data/dev.db` on the Railway volume.
Download it regularly (Railway volume file browser) — **especially before
payroll runs**.

### Updating the app
Push to GitHub → Railway redeploys automatically. Schema changes apply safely
on start (`prisma db push`).

### Troubleshooting
| Symptom | Fix |
| --- | --- |
| Can't log in after deploy | Check deploy logs for `Production seed complete.`; confirm `SEED_*` vars if set |
| Everyone logged out after a deploy | `JWT_SECRET` changed — keep it constant per environment |
| Database resets after redeploy | `DATABASE_URL` isn't pointing at the volume (`file:/data/dev.db`) |
| Employee form has no departments | The seed didn't run — check start logs, or run `npm run db:seed:prod` manually |
| Dev server blocks builds locally | Stop `npm run dev` before running `npm run build` |

---

## Tech Stack
- Next.js 16 (App Router) · React 19 · Tailwind CSS 4
- Prisma 6 + SQLite (better-sqlite3)
- JWT sessions (jose) · bcryptjs password hashing

## Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at :3000 |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Schema push + prod seed + start (used by Railway) |
| `npm run db:push` | Sync `schema.prisma` to the database |
| `npm run db:seed` | Demo data (dev only) |
| `npm run db:seed:prod` | Idempotent prod seed (departments + admin/HR) |
| `npm run db:studio` | Browse the database in Prisma Studio |
