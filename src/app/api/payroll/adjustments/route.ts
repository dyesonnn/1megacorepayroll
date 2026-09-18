import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

// GET: Fetch adjustments for a payroll period
export async function GET(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");
    const employeeId = searchParams.get("employeeId");

    if (!periodId) {
      return NextResponse.json({ error: "Period ID is required" }, { status: 400 });
    }

    const where: Record<string, string> = { payrollPeriodId: periodId };
    if (employeeId) {
      where.employeeId = employeeId;
    }

    const records = await prisma.payrollRecord.findMany({
      where,
      include: { employee: true },
      orderBy: { employee: { employeeNumber: "asc" } },
    });

    return NextResponse.json(records);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update adjustments for a specific payroll record
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const body = await request.json();
    const { recordId, adjustments } = body;

    if (!recordId || !adjustments) {
      return NextResponse.json({ error: "Record ID and adjustments are required" }, { status: 400 });
    }

    // Fetch current record to recalculate totals
    const currentRecord = await prisma.payrollRecord.findUnique({
      where: { id: recordId },
    });

    if (!currentRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Merge adjustments
    const updatedData = {
      sssDeduction: adjustments.sssDeduction ?? currentRecord.sssDeduction,
      philhealthDeduction: adjustments.philhealthDeduction ?? currentRecord.philhealthDeduction,
      pagibigDeduction: adjustments.pagibigDeduction ?? currentRecord.pagibigDeduction,
      otherDeductions: adjustments.otherDeductions ?? currentRecord.otherDeductions,
      bonuses: adjustments.bonuses ?? currentRecord.bonuses,
      doublePay: adjustments.doublePay ?? currentRecord.doublePay,
      allowances: adjustments.allowances ?? currentRecord.allowances,
      withholdingTax: adjustments.withholdingTax ?? currentRecord.withholdingTax,
    };

    // Handle selected cash advances, capped so net pay can't drop below
    // (1 - maxNetFraction) of gross. Oldest advances are deducted first;
    // anything beyond the cap stays PENDING for a future payroll.
    const { cashAdvanceMaxNetFraction } = await getSettings();

    // Cap budget: total advance deduction allowed for this record.
    // Based on the record's existing gross (basic/OT/holiday) — additions
    // chosen in the same save (allowances/bonuses/doublePay) don't extend it.
    const advanceBudget = currentRecord.grossPay * cashAdvanceMaxNetFraction;

    // Advances already deducted through this record keep their slot
    const previouslyDeducted = await prisma.cashAdvance.findMany({
      where: { payrollRecordId: recordId, status: "DEDUCTED" },
      orderBy: { advanceDate: "asc" },
    });
    const previouslyDeductedTotal = previouslyDeducted.reduce((sum, a) => sum + a.amount, 0);
    let remainingBudget = advanceBudget - previouslyDeductedTotal;

    if (adjustments.selectedAdvanceIds && Array.isArray(adjustments.selectedAdvanceIds)) {
      // Resolve advances in parallel, then deduct oldest-first within budget
      const requested = (
        await Promise.all(
          adjustments.selectedAdvanceIds.map((advanceId: string) =>
            prisma.cashAdvance.findUnique({ where: { id: advanceId } })
          )
        )
      ).filter((a): a is NonNullable<typeof a> => !!a && a.status === "PENDING");
      requested.sort(
        (a, b) => new Date(a.advanceDate).getTime() - new Date(b.advanceDate).getTime()
      );

      const toDeduct: string[] = [];
      const deferred: string[] = [];
      for (const advance of requested) {
        if (advance.amount <= remainingBudget) {
          remainingBudget -= advance.amount;
          toDeduct.push(advance.id);
        } else {
          deferred.push(advance.id);
        }
      }

      // Un-link any previously deducted advances the user unchecked this save
      const keepDeducted = new Set([
        ...previouslyDeducted.map((a) => a.id),
        ...toDeduct,
      ]);
      const toRelease = previouslyDeducted.filter((a) => !keepDeducted.has(a.id));
      for (const advance of toRelease) {
        await prisma.cashAdvance.update({
          where: { id: advance.id },
          data: { status: "PENDING", payrollRecordId: null },
        });
      }

      for (const advanceId of toDeduct) {
        await prisma.cashAdvance.update({
          where: { id: advanceId },
          data: {
            status: "DEDUCTED",
            payrollRecordId: recordId,
          },
        });
      }

      if (deferred.length > 0) {
        const deferredTotal = deferred.reduce(
          (sum, id) => sum + (requested.find((a) => a.id === id)?.amount ?? 0),
          0
        );
        console.log(
          `[adjustments] Deferred ₱${deferredTotal.toFixed(2)} of cash advances beyond the ` +
          `net-pay cap for record ${recordId}; they stay PENDING for the next payroll.`
        );
      }
    }

    // Total cash advances deducted through this record (after cap enforcement)
    const totalCashAdvance = (
      await prisma.cashAdvance.findMany({
        where: { payrollRecordId: recordId, status: "DEDUCTED" },
      })
    ).reduce((sum, a) => sum + a.amount, 0);



    // Recalculate gross pay
    const grossPay = currentRecord.basicPay + 
                     currentRecord.overtimePay + 
                     currentRecord.holidayPay + 
                     updatedData.allowances + 
                     updatedData.bonuses + 
                     updatedData.doublePay;

    // Recalculate total deductions
    const totalDeductions = updatedData.sssDeduction + 
                           updatedData.philhealthDeduction + 
                           updatedData.pagibigDeduction + 
                           updatedData.withholdingTax + 
                           totalCashAdvance + 
                           updatedData.otherDeductions;

    // Recalculate net pay
    const netPay = grossPay - totalDeductions;

    const updated = await prisma.payrollRecord.update({
      where: { id: recordId },
      data: {
        ...updatedData,
        grossPay,
        totalDeductions,
        netPay,
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Update adjustments error:", error);
    return NextResponse.json({ error: "Failed to update adjustments" }, { status: 500 });
  }
}
