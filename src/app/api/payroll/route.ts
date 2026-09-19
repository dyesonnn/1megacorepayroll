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

      const period = await prisma.payrollPeriod.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          payDate: new Date(payDate),
          status: "DRAFT",
        },
      });

      return NextResponse.json(period, { status: 201 });
    }

    if (body.type === "computePayroll") {
      const { periodId } = body;
      if (!periodId) {
        return NextResponse.json({ error: "Period ID is required" }, { status: 400 });
      }

      const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
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

      // Only fetch employees who have attendance records
      const employees = await prisma.employee.findMany({
        where: {
          id: { in: employeeIdsWithAttendance },
        },
      });

      // Delete existing records for this period
      await prisma.payrollRecord.deleteMany({
        where: { payrollPeriodId: periodId },
      });

      let count = 0;

      for (const emp of employees) {
        // Calculate attendance-based pay
        const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
        const attendanceByDate = new Map(
          empAttendance.map((a) => [dayKey(a.date), a])
        );

        // "Days Worked" counts every day the employee showed up — including
        // holidays worked — so the number matches what HR sees in attendance.
        // Status HOLIDAY (holiday, not worked) is paid via holidayPay but is
        // not a day the employee worked.
        const daysWorked = empAttendance.filter(
          (a) =>
            a.status !== "ABSENT" &&
            a.status !== "REST_DAY" &&
            a.status !== "HOLIDAY"
        ).length;
        // Days that earn plain daily-rate basic pay: worked days excluding
        // holiday days, since a worked holiday is paid in full (with premium)
        // through holidayPay below — including it here would double-count it.
        const basicPayDays = empAttendance.filter(
          (a) =>
            a.status !== "ABSENT" &&
            a.status !== "REST_DAY" &&
            !holidayByDate.has(dayKey(a.date))
        ).length;
        const totalOvertimeHours = empAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

      // Basic pay (prorated by plain paid days; worked holidays paid via holidayPay)
      const basicPay = basicPayDays * emp.dailyRate;

      // Overtime pay (25% premium for regular OT). Skippable per period —
      // e.g. when funds are short, the period can be computed without OT pay.
      const overtimePay = includeOvertime
        ? totalOvertimeHours * (emp.dailyRate / 8) * 1.25
        : 0;

        // Holiday pay — company policy: NO WORK, NO PAY.
        // A holiday only pays when the employee actually worked that day:
        //   Regular holiday, worked:   200% (double pay)
        //   Special holiday, worked:   130%
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
            holidayPay += emp.dailyRate * 2; // double pay
          } else if (holiday.type === "SPECIAL") {
            holidayPay += emp.dailyRate * 1.3; // 130%
          }
        }
        holidayPay = Math.round(holidayPay * 100) / 100;

        // Allowances
        const allowances = 0;

        const grossPay = basicPay + overtimePay + holidayPay + allowances;

        // Deductions start at 0 — secretary inputs them manually via Adjust
        const sssDeduction = 0;
        const philhealthDeduction = 0;
        const pagibigDeduction = 0;
        const withholdingTax = 0;

        const totalDeductions = sssDeduction + philhealthDeduction + pagibigDeduction + withholdingTax;
        const netPay = grossPay - totalDeductions;

        await prisma.payrollRecord.create({
          data: {
            payrollPeriodId: periodId,
            employeeId: emp.id,
            basicPay,
            overtimePay,
            holidayPay,
            allowances,
            grossPay,
            sssDeduction,
            philhealthDeduction,
            pagibigDeduction,
            withholdingTax,
            totalDeductions,
            netPay,
            daysWorked,
            totalOvertimeHours,
          },
        });
        count++;
      }

      // Update period status
      await prisma.payrollPeriod.update({
        where: { id: periodId },
        data: { status: "PROCESSING", includeOvertimePay: includeOvertime },
      });

      return NextResponse.json({ count, message: `Payroll computed for ${count} employees` });
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

    if (body.type === "markPaid") {
      const { recordId, periodId } = body;
      if (!recordId || !periodId) {
        return NextResponse.json({ error: "Record ID and Period ID are required" }, { status: 400 });
      }

      // Mark the specific record as paid
      const record = await prisma.payrollRecord.findUnique({ where: { id: recordId } });
      if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      await prisma.payrollRecord.update({
        where: { id: recordId },
        data: { paid: true },
      });

      // Check if all records in this period are now paid
      const totalRecords = await prisma.payrollRecord.count({
        where: { payrollPeriodId: periodId },
      });

      const paidRecords = await prisma.payrollRecord.count({
        where: { payrollPeriodId: periodId, paid: true },
      });

      const allPaid = totalRecords > 0 && totalRecords === paidRecords;

      // If all employees are paid, update the period status to PAID
      if (allPaid) {
        await prisma.payrollPeriod.update({
          where: { id: periodId },
          data: { status: "PAID" },
        });
      }

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
