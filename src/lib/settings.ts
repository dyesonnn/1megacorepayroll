import { prisma } from "@/lib/prisma";

/**
 * System-wide settings, stored as a single row (id = "default").
 * The row is created on first access with the schema defaults,
 * then only the edited fields change.
 */
export interface AppSettings {
  /** Max outstanding (PENDING) cash advance per employee, in pesos */
  cashAdvanceLimit: number;
  /** Max fraction of net pay that cash advance deductions may consume (0–1) */
  cashAdvanceMaxNetFraction: number;
}

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {},
  });

  return {
    cashAdvanceLimit: row.cashAdvanceLimit,
    cashAdvanceMaxNetFraction: row.cashAdvanceMaxNetFraction,
  };
}

/**
 * Outstanding cash advance balance for an employee:
 * the sum of all PENDING advances (given but not yet recovered).
 */
export async function getOutstandingAdvance(employeeId: string): Promise<number> {
  const agg = await prisma.cashAdvance.aggregate({
    where: { employeeId, status: "PENDING" },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** Build a friendly rejection message for a limit breach. */
export function formatAdvanceLimitError(
  requested: number,
  outstanding: number,
  limit: number
): string {
  const available = limit - outstanding;
  return (
    `Cash advance limit exceeded. ` +
    `Outstanding: ₱${outstanding.toLocaleString("en-PH")} · ` +
    `Limit: ₱${limit.toLocaleString("en-PH")} · ` +
    `Available: ₱${available.toLocaleString("en-PH")} · ` +
    `Requested: ₱${requested.toLocaleString("en-PH")}. ` +
    `Cancel/reduce pending advances or adjust the limit in Cash Advance Settings.`
  );
}
