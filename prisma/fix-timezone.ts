/**
 * One-time data fix for the timezone bug (see TIMEZONE_FIX_NOTES.md).
 *
 * Two separate corrections, both idempotent:
 *
 *  1. Date-only columns (attendance.date, holidays.date) are normalized to
 *     UTC midnight of the Philippine calendar day. This is applied by default
 *     and is safe to run anywhere — records written on a Manila-time server
 *     (local dev) get fixed, records already at UTC midnight (production) are
 *     left alone.
 *
 *  2. Attendance timeIn/timeOut written by the UTC server were parsed 8 hours
 *     too late (08:00 was stored as 08:00Z = 16:00 Manila). `--shift-times`
 *     subtracts 8 hours to restore the wall clock HR actually entered.
 *
 *     Rows touched *after* the fix was deployed were already written with the
 *     Manila offset and must NOT be shifted, so `--shift-times` needs a cut-off
 *     (`--before=<ISO instant the fixed build finished deploying>`) and leaves
 *     anything updated at or after it untouched. Skipped rows are listed so the
 *     output can be reviewed.
 *
 * Usage (dry run is the default — nothing is written without --apply):
 *
 *   npx tsx prisma/fix-timezone.ts                       # report only
 *   npx tsx prisma/fix-timezone.ts --apply               # fix dates
 *   npx tsx prisma/fix-timezone.ts --shift-times --before=2026-09-19T13:00:00Z           # preview
 *   npx tsx prisma/fix-timezone.ts --shift-times --before=2026-09-19T13:00:00Z --apply   # write
 *
 * The dry run prints before/after samples so HR can confirm the times look
 * like real work hours before anything is written.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PH_TZ = "Asia/Manila";
const SHIFT_HOURS = 8; // Asia/Manila is UTC+8 all year (no DST)
const SHIFT_MS = SHIFT_HOURS * 60 * 60 * 1000;

const APPLY = process.argv.includes("--apply");
const SHIFT_TIMES = process.argv.includes("--shift-times");
const BEFORE_ARG = process.argv
  .find((arg) => arg.startsWith("--before="))
  ?.slice("--before=".length);
const BEFORE = BEFORE_ARG ? new Date(BEFORE_ARG) : null;

/** Midnight UTC of the yyyy-mm-dd day. */
function utcDayStart(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
}

/** yyyy-mm-dd of the Philippine calendar day the instant falls on. */
function manilaDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Wall-clock "yyyy-mm-dd HH:MM" in the Philippines, for readable reports. */
function manilaLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(",", "");
}

async function fixAttendanceDates() {
  const rows = await prisma.attendance.findMany({ select: { id: true, date: true } });
  const stale = rows.filter((r) => r.date.getTime() !== utcDayStart(manilaDayKey(r.date)).getTime());

  console.log(`\nAttendance dates: ${stale.length} of ${rows.length} need normalizing`);
  for (const row of stale.slice(0, 5)) {
    const fixed = utcDayStart(manilaDayKey(row.date));
    console.log(`  ${row.id}  ${row.date.toISOString()} → ${fixed.toISOString()}`);
  }
  if (stale.length > 5) console.log(`  … and ${stale.length - 5} more`);

  if (!APPLY) return;
  for (const row of stale) {
    await prisma.attendance.update({
      where: { id: row.id },
      data: { date: utcDayStart(manilaDayKey(row.date)) },
    });
  }
  console.log(`  ✓ normalized ${stale.length} attendance dates`);
}

async function fixHolidayDates() {
  const rows = await prisma.holiday.findMany({ select: { id: true, name: true, date: true } });
  const stale = rows.filter((r) => r.date.getTime() !== utcDayStart(manilaDayKey(r.date)).getTime());

  console.log(`\nHoliday dates: ${stale.length} of ${rows.length} need normalizing`);

  let skipped = 0;
  for (const row of stale) {
    const fixed = utcDayStart(manilaDayKey(row.date));
    // holidays.date is unique — normalizing two nearby rows onto the same day
    // would violate it, so those are left for manual review.
    const clash = await prisma.holiday.findFirst({ where: { date: fixed, id: { not: row.id } } });
    if (clash) {
      skipped++;
      console.log(`  ⚠ "${row.name}" (${row.date.toISOString()}) → ${fixed.toISOString()} clashes with "${clash.name}" — skipped`);
      continue;
    }
    console.log(`  "${row.name}"  ${row.date.toISOString()} → ${fixed.toISOString()}`);
    if (APPLY) {
      await prisma.holiday.update({ where: { id: row.id }, data: { date: fixed } });
    }
  }
  if (APPLY && stale.length > skipped) {
    console.log(`  ✓ normalized ${stale.length - skipped} holiday dates`);
  }
}

/**
 * Decide which rows the -8h shift applies to. Planned before any write in the
 * same run, because updating a row moves its updatedAt past the cut-off.
 */
async function planTimeShift() {
  if (!BEFORE || Number.isNaN(BEFORE.getTime())) {
    console.error(
      "\n--shift-times needs --before=<ISO instant the fixed build finished deploying>,\n" +
        "e.g. --before=2026-09-19T13:00:00Z\n" +
        "Rows updated at or after it were written by the fixed code (Manila offset already applied)\n" +
        "and must not be shifted again. Get the deploy time from the Railway deployment log."
    );
    process.exit(1);
  }

  const rows = await prisma.attendance.findMany({
    select: { id: true, date: true, timeIn: true, timeOut: true, createdAt: true, updatedAt: true },
  });
  const withTimes = rows.filter((r) => r.timeIn || r.timeOut);
  const affected = withTimes.filter((r) => r.updatedAt < BEFORE);
  const skipped = withTimes.filter((r) => r.updatedAt >= BEFORE);

  console.log(
    `\nAttendance times (shifting by -${SHIFT_HOURS}h, updated before ${BEFORE.toISOString()}):`
  );
  console.log(`  ${affected.length} row(s) to shift of ${withTimes.length} with times`);
  for (const row of affected.slice(0, 5)) {
    const before = row.timeIn ? manilaLabel(row.timeIn) : "—";
    const after = row.timeIn ? manilaLabel(new Date(row.timeIn.getTime() - SHIFT_MS)) : "—";
    console.log(`  ${manilaDayKey(row.date)}  time-in ${before} → ${after}  (updated ${row.updatedAt.toISOString()})`);
  }
  if (affected.length > 5) console.log(`  … and ${affected.length - 5} more`);

  if (skipped.length > 0) {
    console.log(`\n  Left untouched — updated after the fix, expected to already be correct:`);
    for (const row of skipped.slice(0, 5)) {
      const timeIn = row.timeIn ? manilaLabel(row.timeIn).slice(11) : "—";
      const timeOut = row.timeOut ? manilaLabel(row.timeOut).slice(11) : "—";
      console.log(`  ${manilaDayKey(row.date)}  in ${timeIn} / out ${timeOut}  (updated ${row.updatedAt.toISOString()})`);
    }
    if (skipped.length > 5) console.log(`  … and ${skipped.length - 5} more`);
    console.log("  If any of these still show 8h-shifted times, they were written by the old build:");
    console.log("  re-run with an earlier --before cut-off (or log those days again by hand).");
  }

  return affected;
}

type TimeShiftPlan = { id: string; timeIn: Date | null; timeOut: Date | null }[];

async function applyTimeShift(plan: TimeShiftPlan) {
  for (const row of plan) {
    await prisma.attendance.update({
      where: { id: row.id },
      data: {
        timeIn: row.timeIn ? new Date(row.timeIn.getTime() - SHIFT_MS) : null,
        timeOut: row.timeOut ? new Date(row.timeOut.getTime() - SHIFT_MS) : null,
      },
    });
  }
  console.log(`  ✓ shifted ${plan.length} attendance rows`);
}

async function main() {
  console.log(APPLY ? "APPLYING timezone data fix" : "DRY RUN — pass --apply to write changes");
  if (SHIFT_TIMES && !APPLY) {
    console.log("(times would be shifted by -8h; re-run with --shift-times --apply to write)");
  }

  // Plan the time shift first: the date normalization below bumps updatedAt,
  // which would push every row past the --before cut-off.
  const plan = SHIFT_TIMES ? await planTimeShift() : null;

  await fixAttendanceDates();
  await fixHolidayDates();
  if (plan && APPLY) await applyTimeShift(plan);

  console.log(
    APPLY
      ? "\nDone. Verify a few records on the attendance page afterward."
      : "\nNothing was written. Re-run with --apply when the samples above look right."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
