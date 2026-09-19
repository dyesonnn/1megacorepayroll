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
 *  2. Attendance timeIn/timeOut written by a UTC server were parsed 8 hours
 *     too late (08:00 was stored as 08:00Z = 16:00 Manila). `--shift-times`
 *     subtracts 8 hours from every attendance time to restore the wall clock
 *     HR actually entered. Only run this against a database written by the
 *     UTC deployment.
 *
 * Usage (dry run is the default — nothing is written without --apply):
 *
 *   npx tsx prisma/fix-timezone.ts                                  # report only
 *   npx tsx prisma/fix-timezone.ts --apply                          # fix dates
 *   npx tsx prisma/fix-timezone.ts --shift-times --apply            # dates + times
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

async function shiftAttendanceTimes() {
  const rows = await prisma.attendance.findMany({
    select: { id: true, date: true, timeIn: true, timeOut: true },
  });
  const affected = rows.filter((r) => r.timeIn || r.timeOut);

  console.log(`\nAttendance times: ${affected.length} of ${rows.length} rows have times (shifting by -${SHIFT_HOURS}h)`);
  for (const row of affected.slice(0, 5)) {
    const before = row.timeIn ? manilaLabel(row.timeIn) : "—";
    const after = row.timeIn ? manilaLabel(new Date(row.timeIn.getTime() - SHIFT_MS)) : "—";
    console.log(`  ${manilaDayKey(row.date)}  time-in ${before} → ${after}`);
  }
  if (affected.length > 5) console.log(`  … and ${affected.length - 5} more`);

  if (!APPLY) return;
  for (const row of affected) {
    await prisma.attendance.update({
      where: { id: row.id },
      data: {
        timeIn: row.timeIn ? new Date(row.timeIn.getTime() - SHIFT_MS) : null,
        timeOut: row.timeOut ? new Date(row.timeOut.getTime() - SHIFT_MS) : null,
      },
    });
  }
  console.log(`  ✓ shifted ${affected.length} attendance rows`);
}

async function main() {
  console.log(APPLY ? "APPLYING timezone data fix" : "DRY RUN — pass --apply to write changes");
  if (SHIFT_TIMES && !APPLY) {
    console.log("(times would be shifted by -8h; re-run with --shift-times --apply)");
  }

  await fixAttendanceDates();
  await fixHolidayDates();
  if (SHIFT_TIMES) await shiftAttendanceTimes();

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
