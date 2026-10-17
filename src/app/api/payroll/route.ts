import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { utcDayStart, dayKey } from "@/lib/utils";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const body = await request.json();

    if (body.type === "createPeriod") {
      const { name, startDate, endDate, payDate } = body;
      if (!name || !startDate || !endDate || !payDate) {
        return NextResponse.json({ error: "All fields are required" }, { status: 400 });
      }

      // A payroll can cover everyone (the original behaviour), one department,
      // or a hand-picked set of employees. Scoped payrolls are separate periods,
      // so the all-employees payroll is never disturbed.
      const scopeType = ["ALL", "DEPARTMENT", "SELECTED"].includes(body.scopeType)
        ? (body.scopeType as string)
        : "ALL";

      let departmentId: string | null = null;
      if (scopeType === "DEPARTMENT") {
        if (!body.departmentId) {
          return NextResponse.json({ error: "Choose a department for this payroll" }, { status: 400 });
        }
        const department = await prisma.department.findUnique({ where: { id: body.departmentId } });
        if (!department) {
          return NextResponse.json({ error: "Department not found" }, { status: 404 });
        }
        departmentId = department.id;
      }

      const employeeIds: string[] = [];
      if (Array.isArray(body.employeeIds)) {
        for (const id of body.employeeIds) {
          if (typeof id === "string" && !employeeIds.includes(id)) employeeIds.push(id);
        }
      }
      if (scopeType === "SELECTED" && employeeIds.length === 0) {
        return NextResponse.json({ error: "Choose at least one employee for this payroll" }, { status: 400 });
      }

      const period = await prisma.payrollPeriod.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          payDate: new Date(payDate),
          status: "DRAFT",
          scopeType,
          departmentId,
          scopeEmployees: scopeType === "SELECTED"
            ? { create: employeeIds.map((employeeId) => ({ employeeId })) }
            : undefined,
        },
      });

      return NextResponse.json(period, { status: 201 });
    }

    if (body.type === "computePayroll") {
      const { periodId } = body;
      if (!periodId) {
        return NextResponse.json({ error: "Period ID is required" }, { status: 400 });
      }

      const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
        include: { scopeEmployees: { select: { employeeId: true } } },
      });
      if (!period) {
        return NextResponse.json({ error: "Period not found" }, { status: 404 });
      }

      // OT pay can be excluded for this period (e.g. due to lack of funds).
      // The choice is sent at compute time and stored on the period so the
      // table/payslips can reflect it until the next computation.
      const includeOvertime = body.includeOvertime !== false;

      // Period dates are stored as UTC midnight of the calendar day, so build
      // the query window from their day keys — no server timezone involved.
      const startOfDay = utcDayStart(dayKey(period.startDate));
      const endOfDay = new Date(utcDayStart(dayKey(period.endDate)).getTime() + ONE_DAY_MS);

      // Get attendance for this period
      const attendance = await prisma.attendance.findMany({
        where: {
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      });

      // Load holidays within the period, keyed by local date for payroll matching
      const holidays = await prisma.holiday.findMany({
        where: { date: { gte: startOfDay, lt: endOfDay } },
      });
      const holidayByDate = new Map(
        holidays.map((h) => [dayKey(h.date), h])
      );

      // Find employee IDs that actually have attendance in this period
      const employeeIdsWithAttendance = [
        ...new Set(attendance.map((a) => a.employeeId)),
      ];

      // Who gets a row in this payroll. The all-employees payroll keeps its
      // original rule — only people who have attendance — so existing payrolls
      // don't suddenly grow rows of zeros. A scoped payroll is explicit about
      // who it covers, so everyone in scope is listed, at ₱0 when they have no
      // attendance (HR may still need the row to add an adjustment or advance).
      let employees;
      if (period.scopeType === "DEPARTMENT" && period.departmentId) {
        employees = await prisma.employee.findMany({
          where: {
            departmentId: period.departmentId,
            // Everyone still employed, plus anyone who worked part of the
            // period before leaving — they are owed for those days.
            OR: [
              { employmentStatus: "ACTIVE" },
              { id: { in: employeeIdsWithAttendance } },
            ],
          },
        });
      } else if (period.scopeType === "SELECTED") {
        employees = await prisma.employee.findMany({
          where: { id: { in: period.scopeEmployees.map((s) => s.employeeId) } },
        });
      } else {
        employees = await prisma.employee.findMany({
          where: {
            id: { in: employeeIdsWithAttendance },
          },
        });
      }

      // Recomputing refreshes the attendance-based pay, but it must not wipe
      // what HR already put on this payroll. Snapshot the existing records so
      // the manual additions/deductions, the paid flag, and the cash advances
      // already deducted here survive the rebuild below.
      const existingRecords = await prisma.payrollRecord.findMany({
        where: { payrollPeriodId: periodId },
        include: {
          cashAdvances: {
            where: { status: "DEDUCTED" },
            orderBy: { advanceDate: "asc" },
            select: { id: true, amount: true },
          },
        },
      });
      const carriedByEmployee = new Map(existingRecords.map((r) => [r.employeeId, r]));

      // Delete existing records for this period
      await prisma.payrollRecord.deleteMany({
        where: { payrollPeriodId: periodId },
      });

      let count = 0;
      let releasedAdvanceTotal = 0;

      for (const emp of employees) {
        // Calculate attendance-based pay
        const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
        const attendanceByDate = new Map(
          empAttendance.map((a) => [dayKey(a.date), a])
        );

        // "Days Worked" counts every day the employee showed up — including
        // holidays worked — so the number matches what HR sees in attendance.
        // Status HOLIDAY (holiday, not worked) is not a day the employee worked.
        const daysWorked = empAttendance.filter(
          (a) =>
            a.status !== "ABSENT" &&
            a.status !== "REST_DAY" &&
            a.status !== "HOLIDAY"
        ).length;
        const totalOvertimeHours = empAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

      // Basic pay covers every day worked — including holidays worked — so
      // Days Worked × daily rate always matches the Basic Pay column. A worked
      // holiday additionally earns a premium through holidayPay below
      // (DOLE-style breakdown: base 100% in Basic Pay, premium in Holiday Pay).
      const basicPay = daysWorked * emp.dailyRate;

      // Overtime pay (25% premium for regular OT). Skippable per period —
      // e.g. when funds are short, the period can be computed without OT pay.
      const overtimePay = includeOvertime
        ? totalOvertimeHours * (emp.dailyRate / 8) * 1.25
        : 0;

        // Holiday premium — company policy: NO WORK, NO PAY. A holiday only
        // pays a premium when the employee actually worked that day; the base
        // 100% for the day is already in basicPay above, so a worked day totals:
        //   Regular holiday, worked:   100% basic + 100% premium = 200%
        //   Special holiday, worked:   100% basic +  30% premium = 130%
        //   Holiday, not worked:       ₱0 (no pay — no attendance that day)
        let holidayPay = 0;
        for (const [dateKey, holiday] of holidayByDate) {
          const record = attendanceByDate.get(dateKey);
          const worked =
            record !== undefined &&
            record.status !== "ABSENT" &&
            record.status !== "HOLIDAY" &&
            record.status !== "REST_DAY";
          if (!worked) continue; // no work, no pay
          if (holiday.type === "REGULAR") {
            holidayPay += emp.dailyRate; // +100% premium on top of basic
          } else if (holiday.type === "SPECIAL") {
            holidayPay += emp.dailyRate * 0.3; // +30% premium on top of basic
          }
        }
        holidayPay = Math.round(holidayPay * 100) / 100;

        // Manual entries and the paid flag from the previous computation carry
        // over — computing payroll must not silently erase them. Nobody wants
        // recomputing to lose the SSS/tax figures the secretary just typed, or
        // to un-pay an employee who was already paid.
        const carried = carriedByEmployee.get(emp.id);

        const allowances = carried?.allowances ?? 0;
        const bonuses = carried?.bonuses ?? 0;
        const doublePay = carried?.doublePay ?? 0;

        const grossPay =
          basicPay + overtimePay + holidayPay + allowances + bonuses + doublePay;

        const sssDeduction = carried?.sssDeduction ?? 0;
        const philhealthDeduction = carried?.philhealthDeduction ?? 0;
        const pagibigDeduction = carried?.pagibigDeduction ?? 0;
        const withholdingTax = carried?.withholdingTax ?? 0;
        const otherDeductions = carried?.otherDeductions ?? 0;

        // Cash advances already deducted through this employee's record stay
        // deducted: the deduction was a decision HR made, and dropping it here
        // would hand the employee the advance money twice.
        const keptAdvances = (carried?.cashAdvances ?? []).map((a) => a.id);
        const cashAdvanceDeduction = (carried?.cashAdvances ?? []).reduce(
          (sum, a) => sum + a.amount,
          0
        );

        const totalDeductions =
          sssDeduction +
          philhealthDeduction +
          pagibigDeduction +
          withholdingTax +
          otherDeductions +
          cashAdvanceDeduction;
        const netPay = grossPay - totalDeductions;

        await prisma.payrollRecord.create({
          data: {
            payrollPeriodId: periodId,
            employeeId: emp.id,
            basicPay,
            overtimePay,
            holidayPay,
            allowances,
            bonuses,
            doublePay,
            grossPay,
            sssDeduction,
            philhealthDeduction,
            pagibigDeduction,
            withholdingTax,
            otherDeductions,
            totalDeductions,
            netPay,
            daysWorked,
            totalOvertimeHours,
            paid: carried?.paid ?? false,
            cashAdvances: { connect: keptAdvances.map((id) => ({ id })) },
          },
        });


        count++;
      }

      // Employees who dropped out of this payroll (left the department, were
      // removed from a hand-picked scope, or have no attendance) get no record,
      // so their advances must not stay stranded as DEDUCTED with no payroll.
      const computedEmployeeIds = new Set(employees.map((e) => e.id));
      const orphaningAdvances = existingRecords
        .filter((r) => !computedEmployeeIds.has(r.employeeId))
        .flatMap((r) => r.cashAdvances.map((a) => a.id));
      if (orphaningAdvances.length > 0) {
        releasedAdvanceTotal += existingRecords
          .filter((r) => !computedEmployeeIds.has(r.employeeId))
          .flatMap((r) => r.cashAdvances.map((a) => a.amount))
          .reduce((sum, amount) => sum + amount, 0);
        await prisma.cashAdvance.updateMany({
          where: { id: { in: orphaningAdvances } },
          data: { status: "PENDING", payrollRecordId: null },
        });
      }

      // A period whose rows are all still paid stays PAID; recomputing an
      // unpaid one puts it back in processing.
      const paidCount = await prisma.payrollRecord.count({
        where: { payrollPeriodId: periodId, paid: true },
      });

      await prisma.payrollPeriod.update({
        where: { id: periodId },
        data: {
          status: count > 0 && paidCount === count ? "PAID" : "PROCESSING",
          includeOvertimePay: includeOvertime,
        },
      });

      return NextResponse.json({
        count,
        releasedAdvanceTotal,
        message: `Payroll computed for ${count} employees`,
      });
    }

    if (body.type === "deletePeriod") {
      const { periodId } = body;
      if (!periodId) {
        return NextResponse.json({ error: "Period ID is required" }, { status: 400 });
      }

      const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
      if (!period) {
        return NextResponse.json({ error: "Period not found" }, { status: 404 });
      }

      // Unlink cash advances from this period's records first so the delete
      // doesn't violate the foreign key. Advances that were already deducted
      // through this payroll go back to PENDING since the deduction no longer exists.
      const records = await prisma.payrollRecord.findMany({
        where: { payrollPeriodId: periodId },
        select: { id: true },
      });

      if (records.length > 0) {
        const recordIds = records.map((r) => r.id);
        await prisma.cashAdvance.updateMany({
          where: { payrollRecordId: { in: recordIds }, status: "DEDUCTED" },
          data: { status: "PENDING", payrollRecordId: null },
        });
        await prisma.cashAdvance.updateMany({
          where: { payrollRecordId: { in: recordIds } },
          data: { payrollRecordId: null },
        });
      }

      // Delete payroll records, then the period itself
      await prisma.payrollRecord.deleteMany({
        where: { payrollPeriodId: periodId },
      });
      await prisma.payrollPeriod.delete({ where: { id: periodId } });

      return NextResponse.json({ success: true, message: `Deleted payroll period "${period.name}"` });
    }

    if (body.type === "markPaid" || body.type === "markUnpaid") {
      const { recordId, periodId } = body;
      if (!recordId || !periodId) {
        return NextResponse.json({ error: "Record ID and Period ID are required" }, { status: 400 });
      }

      const paid = body.type === "markPaid";

      const record = await prisma.payrollRecord.findUnique({ where: { id: recordId } });
      if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
      if (record.payrollPeriodId !== periodId) {
        return NextResponse.json({ error: "Record does not belong to this period" }, { status: 400 });
      }

      await prisma.payrollRecord.update({
        where: { id: recordId },
        data: { paid },
      });

      // Check if all records in this period are now paid
      const totalRecords = await prisma.payrollRecord.count({
        where: { payrollPeriodId: periodId },
      });

      const paidRecords = await prisma.payrollRecord.count({
        where: { payrollPeriodId: periodId, paid: true },
      });

      const allPaid = totalRecords > 0 && totalRecords === paidRecords;

      // All paid → PAID; undoing a payment puts the period back in PROCESSING
      // so it can't stay marked PAID with unpaid rows.
      await prisma.payrollPeriod.update({
        where: { id: periodId },
        data: { status: allPaid ? "PAID" : "PROCESSING" },
      });

      return NextResponse.json({ success: true, allPaid, paidCount: paidRecords, totalCount: totalRecords });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Payroll error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
