import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getSettings, getOutstandingAdvance, formatAdvanceLimitError } from "@/lib/settings";

// GET: Fetch cash advances
export async function GET(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");

    const where: Record<string, string> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const advances = await prisma.cashAdvance.findMany({
      where,
      include: {
        employee: {
          select: { employeeNumber: true, firstName: true, lastName: true },
        },
        payrollRecord: {
          select: { payrollPeriodId: true },
        },
      },
      orderBy: { advanceDate: "desc" },
    });

    return NextResponse.json(advances);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new cash advance
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const body = await request.json();

    const { employeeId, amount, advanceDate, description } = body;

    if (!employeeId || !amount || !advanceDate) {
      return NextResponse.json(
        { error: "Employee, amount, and date are required" },
        { status: 400 }
      );
    }

    const requestedAmount = parseFloat(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    // Enforce the system-wide cash advance limit on outstanding balance
    const { cashAdvanceLimit } = await getSettings();
    const outstanding = await getOutstandingAdvance(employeeId);
    if (outstanding + requestedAmount > cashAdvanceLimit) {
      return NextResponse.json(
        { error: formatAdvanceLimitError(requestedAmount, outstanding, cashAdvanceLimit) },
        { status: 400 }
      );
    }

    const advance = await prisma.cashAdvance.create({
      data: {
        employeeId,
        amount: parseFloat(amount),
        advanceDate: new Date(advanceDate),
        description: description || null,
        status: "PENDING",
      },
      include: {
        employee: {
          select: { employeeNumber: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json(advance, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Create cash advance error:", error);
    return NextResponse.json({ error: "Failed to create cash advance" }, { status: 500 });
  }
}

// PATCH: Update cash advance status
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const body = await request.json();
    const { id, status, payrollRecordId } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const advance = await prisma.cashAdvance.update({
      where: { id },
      data: {
        status: status || undefined,
        payrollRecordId: payrollRecordId || undefined,
      },
    });

    return NextResponse.json(advance);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to update cash advance" }, { status: 500 });
  }
}

// DELETE: Cancel a cash advance
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.cashAdvance.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to cancel cash advance" }, { status: 500 });
  }
}
