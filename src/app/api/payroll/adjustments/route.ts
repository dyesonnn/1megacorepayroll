import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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

    // Handle selected cash advances: everything HR picks is deducted.

    // Advances that were deducted earlier can be unchecked in the Adjust
    // window (e.g. the same advance was entered twice by mistake). Those come
    // in as a release request and go back to PENDING first, so they also give
    // up their budget slot before the cap is worked out below.
    const releasedAdvanceIds: string[] = Array.isArray(adjustments.releasedAdvanceIds)
      ? adjustments.releasedAdvanceIds
      : [];
    const selectedAdvanceIds: string[] = Array.isArray(adjustments.selectedAdvanceIds)
      ? adjustments.selectedAdvanceIds
      : [];

    // A payroll already marked paid is settled money: its cash advance
    // deductions must not change underneath the payslip that was handed out.
    if (
      currentRecord.paid &&
      (releasedAdvanceIds.length > 0 || selectedAdvanceIds.length > 0)
    ) {
      return NextResponse.json(
        {
          error:
            "This payroll is already marked paid, so its cash advance deductions can no longer be changed.",
        },
        { status: 400 }
      );
    }

    for (const advanceId of releasedAdvanceIds) {
      const advance = await prisma.cashAdvance.findUnique({ where: { id: advanceId } });
      // Only advances charged to this very record can be released from here.
      if (!advance || advance.status !== "DEDUCTED" || advance.payrollRecordId !== recordId) {
        continue;
      }
      await prisma.cashAdvance.update({
        where: { id: advanceId },
        data: { status: "PENDING", payrollRecordId: null },
      });
    }

    if (selectedAdvanceIds.length > 0) {
      // Only advances still PENDING can be charged to this payroll — the ones
      // HR kept from an earlier save are already DEDUCTED to this record.
      const requested = (
        await Promise.all(
          selectedAdvanceIds.map((advanceId: string) =>
            prisma.cashAdvance.findUnique({ where: { id: advanceId } })
          )
        )
      ).filter((a): a is NonNullable<typeof a> => !!a && a.status === "PENDING");

      for (const advance of requested) {
        await prisma.cashAdvance.update({
          where: { id: advance.id },
          data: {
            status: "DEDUCTED",
            payrollRecordId: recordId,
          },
        });
      }
    }

    // Total cash advances deducted through this record
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
