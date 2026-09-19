# Timezone bug: Time In 8:00 AM displays as 4:00 PM

Status: **code fix implemented and verified. Remaining: run the data fix on the
dev DB and on the production volume, then deploy.**

## Symptom

HR enters 8:00 AM in the attendance form; the attendance list/sheet showed 4:00 PM
(exactly +8h). Business timezone is **Asia/Manila (UTC+8, no DST)**; the deployed
server (Railway, per DEPLOY.md) runs in **UTC**.

## Root cause

`<input type="time">` sends a plain string like `"08:00"`. The API parsed it with
`new Date(\`${date}T${time}\`)` — no timezone suffix — so JS used the **server's**
timezone. On the UTC server 08:00 was stored as `08:00Z` = 16:00 Manila, and the
client rendered that instant → 4:00 PM. Day/month query windows and the
`toTimeString()` round-trips had the same server-timezone dependence.

## Conventions after the fix

- Date-only columns (`Attendance.date`, `Holiday.date`) → **UTC midnight of the
  calendar day**; `toISOString().slice(0, 10)` round-trips the day.
- Times / instants (`Attendance.timeIn/timeOut`) → **real instants**; an "08:00"
  entry becomes `00:00Z` (= 08:00 Manila), never `08:00Z`.
- All display is pinned with `timeZone: "Asia/Manila"`, so it is correct no
  matter what timezone the server or browser runs in.

## What was implemented

### `src/lib/utils.ts` (new helpers)
- `PH_TZ = "Asia/Manila"`; `formatDate/formatDateTime/formatTime` now pin `timeZone`.
- `manilaDateTime(dateStr, timeStr)` → `…T08:00:00+08:00` (no server tz involved).
- `utcDayStart(dateStr)` → UTC midnight of a day (writes, keys, windows).
- `utcMonthRange("2026-09")` → UTC `[start, end)` window for month queries.
- `dayKey(d)`, `manilaTimeOf(d)`, `manilaNow()`, `formatTime24(d)`.

### API
- `api/attendance/route.ts`: schedule bounds (08:00/17:00) and time-in/out are
  built with `manilaDateTime`; `startOfDay/endOfDay` via `utcDayStart` + 24h;
  the two `toTimeString()` round-trips are gone (stored `Date`s are passed
  straight into `calculateAttendance`); holiday writes use the day start.
- Two pre-existing bugs found while testing the deployed app (they made a
  correctly logged time-in/time-out show up as ABSENT with 0 hours):
  - the `timein` branch updated an existing record without ever writing
    `timeIn`, so a day that already had a record (e.g. from Quick Mark) kept
    no time-in and the later time-out recomputed the status from a null
    time-in. It now always persists `calc.timeIn`.
  - `calculateAttendance` fell through to its initial `ABSENT` when only a
    time-out existed; a time-out with no time-in is now `PRESENT`.
- `api/holidays/route.ts`: duplicate check + create use `utcDayStart(date)`.
- `api/payroll/route.ts`: `toLocalDateKey()` (server-local) replaced by `dayKey`;
  period window built from the stored day keys.

### Pages / components
- `attendance/page.tsx`: UTC day/month windows; holiday lookup no longer reuses
  the attendance `where` (it used to filter holidays by `employeeId` too).
- `attendance/sheet/page.tsx`: UTC month window (`gte`/`lt`, was `lte 23:59:59`).
- `attendance/sheet/AttendanceSheet.tsx`: local 24h `formatTime` replaced by
  `formatTime24` from utils; fixed the tooltip referencing undefined `{status}`
  (now `record.status`).
- `attendance/AttendanceForm.tsx`: defaults from `manilaNow()` (was UTC date /
  client wall clock).
- `payroll/cash-advances/sheet/page.tsx`, `reports/page.tsx`: month windows.
- `payslip/[recordId]/page.tsx`: period window + `formatPeriodCovered` in UTC.
- `PayrollPeriodCard`, `CashAdvanceManager`, `AdjustmentModal`: date-only
  formatters pinned to `PH_TZ`.
- `prisma/seed.ts`: seeds date-only values at UTC midnight and times as Manila
  instants (was local-time constructors, which produced Manila-midnight dates).

## Data fix for existing rows — `prisma/fix-timezone.ts`

Dry run by default; nothing is written without `--apply`.

```bash
# report only
npx tsx prisma/fix-timezone.ts
# normalize date columns
npx tsx prisma/fix-timezone.ts --apply
# preview the -8h time shift, then apply it
npx tsx prisma/fix-timezone.ts --shift-times --before=2026-09-19T13:00:00Z
npx tsx prisma/fix-timezone.ts --shift-times --before=2026-09-19T13:00:00Z --apply
```

- **Date normalization** is idempotent and safe everywhere: rows written on the
  Manila dev machine (Manila-midnight dates) get corrected, production rows
  (already UTC midnight) are untouched.
- **`--shift-times` requires `--before=<ISO>`** — the instant the fixed build
  finished deploying (Railway's deployment log has it). Rows last updated at or
  after that instant were written with the Manila offset and are left alone,
  which also makes a repeated run a no-op instead of double-shifting. Without
  the cut-off the script refuses to run.
- Only run `--shift-times` against a database written by the **UTC** deployment.
  The current dev DB was written on a Manila machine and its times are already
  correct (the dry run shows plausible 07:00/08:05 values, so do **not** shift
  locally).
- The skipped rows are printed with their wall clocks so they can be eyeballed
  (`in 08:00 / out 20:00` = fine, `in 16:00 / out 04:00` = still the old build).
- `Holiday.date` rows that would collide on the unique index are reported and
  skipped for manual review.

Production DB lives on the Railway volume at `/data/dev.db`. Download a copy
(Railway volume browser), then run:

```bash
# put the copy at prisma/railway-dev.db — Prisma resolves file: paths from prisma/
DATABASE_URL="file:./railway-dev.db" npx tsx prisma/fix-timezone.ts \
  --shift-times --before=<deploy instant>
DATABASE_URL="file:./railway-dev.db" npx tsx prisma/fix-timezone.ts \
  --shift-times --before=<deploy instant> --apply
```

Then upload the file back over `/data/dev.db` (stop the service first — any
attendance entered between download and upload is otherwise lost).

## Verification done this session

- `npx tsc --noEmit` clean; `npm run lint` shows only the 8 pre-existing errors
  (`<a>` vs `Link`, `require()` in `seed-prod.js`, setState-in-effect).
- Ran the dev server with `TZ=UTC` (simulating production) and, after logging in
  as admin, POSTed attendance:
  - time-in 08:00 → stored `2026-01-05T00:00:00.000Z`, `date` UTC midnight,
    `lateMinutes 0`, `PRESENT`; the attendance page rendered **08:00 AM**.
  - time-out 17:30 → `2026-01-05T09:30:00.000Z`, `hoursWorked 8.5`, rendered
    **05:30 PM**.
  - time-in 08:20 → `lateMinutes 20` (`LATE`); time-out 18:05 → `overtimeHours 1`
    (unchanged OT rules).
  - Monthly sheet tooltips showed `Time In: 08:00` / `Time Out: 17:30`.
  - Test rows were deleted afterwards.
- Re-ran the exact failed sequence: Quick Mark `ABSENT` → time-in `08:00` →
  time-out `20:00` now stores `00:00Z`/`12:00Z`, gives `11h`, `+3h OT` and
  `PRESENT` (before the two bug fixes it produced no time-in and `ABSENT 0h`),
  and the attendance page renders `08:00 AM` / `08:00 PM`.
  Test rows were deleted afterwards.

## Legacy rows still show the old times

Rows written before the fix (e.g. `Time In 04:00 PM` on the deployed app) keep
showing the mis-stored instant until the data fix is run against the production
volume — the code fix only affects new writes. Verified on the deployed app:
a time-out entered as `08:00 PM` renders as `08:00 PM` (the old code would have
shown `04:00 AM` the next day), so the deploy itself is correct.

## Still open (not part of the timezone fix)

- `AttendanceTable` sends `{ id, status, type: "update" }` and
  `{ id, type: "delete" }`, but the API's early guard returns 400 "Employee and
  date are required" because it requires `employeeId` + `date` before the type
  switch. The table's status dropdown and 🗑️ delete button therefore fail.
- Lunch deduction (`LUNCH_BREAK_HOURS = 1`) is subtracted unconditionally, so
  short shifts can go negative — a business-logic question for HR.
