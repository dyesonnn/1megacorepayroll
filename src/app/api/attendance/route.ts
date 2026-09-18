import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const SCHEDULED_START_HOUR = 8; // 8 AM
const SCHEDULED_END_HOUR = 17; // 5 PM
const LUNCH_BREAK_HOURS = 1;

function calculateAttendance(dateStr: string, timeIn?: string, timeOut?: string) {
  const dateObj = new Date(dateStr);

  const scheduledStart = new Date(dateObj);
  scheduledStart.setHours(SCHEDULED_START_HOUR, 0, 0, 0);

  const scheduledEnd = new Date(dateObj);
  scheduledEnd.setHours(SCHEDULED_END_HOUR, 0, 0, 0);

  let lateMinutes = 0;
  let hoursWorked = 0;
  let overtimeHours = 0;
  let undertimeMinutes = 0;
  let status = "ABSENT";

  const timeInDate = timeIn ? new Date(`${dateStr}T${timeIn}`) : null;
  const timeOutDate = timeOut ? new Date(`${dateStr}T${timeOut}`) : null;

  if (timeInDate) {
    lateMinutes = timeInDate > scheduledStart
      ? Math.round((timeInDate.getTime() - scheduledStart.getTime()) / 60000)
      : 0;
  }

  if (timeInDate && timeOutDate) {
    const totalMinutes = (timeOutDate.getTime() - timeInDate.getTime()) / (1000 * 60);
    hoursWorked = Math.round((totalMinutes / 60 - LUNCH_BREAK_HOURS) * 100) / 100;

    // Overtime: time after scheduled end (5 PM), rounded to nearest whole hour
    // Less than 1 hour of OT doesn't count
    const overtimeMinutesRaw = timeOutDate > scheduledEnd
      ? Math.round((timeOutDate.getTime() - scheduledEnd.getTime()) / 60000)
      : 0;
    overtimeHours = overtimeMinutesRaw >= 60 ? Math.round(overtimeMinutesRaw / 60) : 0;

    // Undertime: if they left before 5 PM
    undertimeMinutes = timeOutDate < scheduledEnd && timeOutDate > timeInDate
      ? Math.round((scheduledEnd.getTime() - timeOutDate.getTime()) / 60000)
      : 0;

    // Determine status
    if (lateMinutes > 0) {
      status = "LATE";
    } else {
      status = "PRESENT";
    }
  } else if (timeInDate) {
    // Only time-in, no time-out yet
    status = lateMinutes > 0 ? "LATE" : "PRESENT";
  }

  return {
    timeIn: timeInDate,
    timeOut: timeOutDate,
    lateMinutes,
    hoursWorked,
    overtimeHours,
    undertimeMinutes,
    status,
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const body = await request.json();
    const { employeeId, projectSiteId, date, timeIn, timeOut, status, type, id, lateMinutes, hoursWorked, overtimeHours, undertimeMinutes, holidayType } = body;

    if (!employeeId || !date) {
      return NextResponse.json({ error: "Employee and date are required" }, { status: 400 });
    }

    // holidayType (REGULAR = double pay, SPECIAL = 130% pay) can be sent with
    // any status. When present, the day is registered as a holiday so payroll
    // automatically adds the premium — the employee keeps their real status
    // (e.g. PRESENT with a premium, instead of a separate HOLIDAY status).
    const validHolidayType = holidayType === "REGULAR" || holidayType === "SPECIAL" ? holidayType : null;

    const dateObj = new Date(date);
    const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1);

    // Find existing attendance for this employee on this date
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: { gte: startOfDay, lt: endOfDay },
      },
    });

    // Register the chosen day type in the Holiday table so payroll
    // automatically applies the pay premium:
    //   REGULAR → double pay (200%) when worked, 100% even if absent
    //   SPECIAL → 130% when worked, no pay if absent
    // A holiday is company-wide, so this upsert affects every employee's pay
    // for that date. "Regular Day" never deletes a declared holiday — remove
    // holidays from the Holidays page instead.
    const upsertHoliday = async (fallbackType?: string) => {
      const dayHoliday = await prisma.holiday.findFirst({
        where: { date: { gte: startOfDay, lt: endOfDay } },
      });
      const holidayKind = validHolidayType ?? fallbackType ?? dayHoliday?.type ?? "REGULAR";
      const name = holidayKind === "SPECIAL" ? "Special Non-Working Holiday" : "Regular Holiday";
      if (dayHoliday) {
        await prisma.holiday.update({
          where: { id: dayHoliday.id },
          data: { type: holidayKind, name },
        });
      } else {
        await prisma.holiday.create({
          data: { date: new Date(date), type: holidayKind, name },
        });
      }
    };

    // Handle manual status update (Present/Absent/Half-day, optionally on a holiday)
    if (type === "status") {
      if (!status || !["PRESENT", "ABSENT", "HALF_DAY", "HOLIDAY"].includes(status)) {
        return NextResponse.json({ error: "Status must be 'PRESENT', 'ABSENT', 'HALF_DAY', or 'HOLIDAY'" }, { status: 400 });
      }

      if (status === "HOLIDAY" || validHolidayType !== null) {
        await upsertHoliday();
      }

      if (existing) {
        const updated = await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status,
            projectSiteId: projectSiteId || existing.projectSiteId,
            // Preserve time records if they exist
            timeIn: timeIn ? new Date(`${date}T${timeIn}`) : existing.timeIn,
            timeOut: timeOut ? new Date(`${date}T${timeOut}`) : existing.timeOut,
          },
        });
        return NextResponse.json(updated);
      }

      const attendance = await prisma.attendance.create({
        data: {
          employeeId,
          projectSiteId: projectSiteId || null,
          date: startOfDay,
          status,
          timeIn: timeIn ? new Date(`${date}T${timeIn}`) : null,
          timeOut: timeOut ? new Date(`${date}T${timeOut}`) : null,
        },
      });
      return NextResponse.json(attendance, { status: 201 });
    }

    // Handle time-in/time-out with automatic calculations
    if (type === "timein") {
      if (!timeIn) {
        return NextResponse.json({ error: "Time-in is required" }, { status: 400 });
      }

      const calc = calculateAttendance(date, timeIn, existing?.timeOut ? existing.timeOut.toTimeString().slice(0, 5) : undefined);

      if (existing) {
        const updated = await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            projectSiteId: projectSiteId || existing.projectSiteId,
            lateMinutes: calc.lateMinutes,
            hoursWorked: calc.hoursWorked,
            overtimeHours: calc.overtimeHours,
            undertimeMinutes: calc.undertimeMinutes,
            status: calc.status,
            timeOut: calc.timeOut || existing.timeOut,
          },
        });
        return NextResponse.json(updated);
      }

      const attendance = await prisma.attendance.create({
        data: {
          employeeId,
          projectSiteId: projectSiteId || null,
          date: startOfDay,
          timeIn: new Date(`${date}T${timeIn}`),
          lateMinutes: calc.lateMinutes,
          hoursWorked: calc.hoursWorked,
          overtimeHours: calc.overtimeHours,
          undertimeMinutes: calc.undertimeMinutes,
          status: calc.status,
          timeOut: calc.timeOut,
        },
      });
      return NextResponse.json(attendance, { status: 201 });
    }

    if (type === "timeout") {
      if (!timeOut) {
        return NextResponse.json({ error: "Time-out is required" }, { status: 400 });
      }

      if (!existing) {
        return NextResponse.json({ error: "No time-in record found for this date. Please log time-in first." }, { status: 400 });
      }

      const calc = calculateAttendance(date, existing.timeIn?.toTimeString().slice(0, 5), timeOut);

      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          timeOut: new Date(`${date}T${timeOut}`),
          lateMinutes: calc.lateMinutes,
          hoursWorked: calc.hoursWorked,
          overtimeHours: calc.overtimeHours,
          undertimeMinutes: calc.undertimeMinutes,
          status: calc.status,
        },
      });
      return NextResponse.json(updated);
    }

    // Handle editing existing attendance record (PUT-style update)
    if (type === "update") {
      if (!body.id) {
        return NextResponse.json({ error: "Attendance ID is required" }, { status: 400 });
      }

      // Fetch the record so holiday syncing knows which calendar day to touch
      const current = await prisma.attendance.findUnique({ where: { id: body.id } });
      if (!current) {
        return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
      }

      const newDateObj = date !== undefined ? new Date(date) : current.date;
      const newStartOfDay = new Date(newDateObj.getFullYear(), newDateObj.getMonth(), newDateObj.getDate());
      const newEndOfDay = new Date(newDateObj.getFullYear(), newDateObj.getMonth(), newDateObj.getDate() + 1);

      const updateData: Record<string, unknown> = {};

      if (status !== undefined) {
        if (!["PRESENT", "ABSENT", "LATE", "HALF_DAY", "UNDERTIME", "REST_DAY", "HOLIDAY"].includes(status)) {
          return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        updateData.status = status;
      }

      if (employeeId !== undefined) updateData.employeeId = employeeId;
      if (projectSiteId !== undefined) updateData.projectSiteId = projectSiteId;
      if (date !== undefined) updateData.date = new Date(date);
      if (timeIn !== undefined) updateData.timeIn = timeIn ? new Date(timeIn) : null;
      if (timeOut !== undefined) updateData.timeOut = timeOut ? new Date(timeOut) : null;
      if (lateMinutes !== undefined) updateData.lateMinutes = lateMinutes;
      if (hoursWorked !== undefined) updateData.hoursWorked = hoursWorked;
      if (overtimeHours !== undefined) updateData.overtimeHours = overtimeHours;
      if (undertimeMinutes !== undefined) updateData.undertimeMinutes = undertimeMinutes;

      const updated = await prisma.attendance.update({
        where: { id: body.id },
        data: updateData,
      });

      // Keep the Holiday table in sync with the final status
      const finalStatus = (updateData.status as string | undefined) ?? current.status;
      if (finalStatus === "HOLIDAY" || validHolidayType !== null) {
        const dayHoliday = await prisma.holiday.findFirst({
          where: { date: { gte: newStartOfDay, lt: newEndOfDay } },
        });
        // An explicit holidayType on the request wins; otherwise keep the
        // day's existing type, defaulting to REGULAR
        const finalHolidayType = validHolidayType ?? dayHoliday?.type ?? "REGULAR";
        const name = finalHolidayType === "SPECIAL" ? "Special Non-Working Holiday" : "Regular Holiday";
        if (dayHoliday) {
          await prisma.holiday.update({
            where: { id: dayHoliday.id },
            data: { type: finalHolidayType, name },
          });
        } else {
          await prisma.holiday.create({
            data: { date: newStartOfDay, type: finalHolidayType, name },
          });
        }
      } else if (current.status === "HOLIDAY" && status !== undefined && status !== "HOLIDAY") {
        // Legacy record moved away from HOLIDAY — remove the holiday entry
        // unless other employees are still marked HOLIDAY on that day
        const dayHoliday = await prisma.holiday.findFirst({
          where: { date: { gte: newStartOfDay, lt: newEndOfDay } },
        });
        if (dayHoliday) {
          const othersOnHoliday = await prisma.attendance.count({
            where: {
              status: "HOLIDAY",
              date: { gte: newStartOfDay, lt: newEndOfDay },
              id: { not: body.id },
            },
          });
          if (othersOnHoliday === 0) {
            await prisma.holiday.delete({ where: { id: dayHoliday.id } });
          }
        }
      }

      return NextResponse.json(updated);
    }

    // Handle deleting attendance record
    if (type === "delete") {
      if (!body.id) {
        return NextResponse.json({ error: "Attendance ID is required" }, { status: 400 });
      }

      await prisma.attendance.delete({
        where: { id: body.id },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type. Use 'timein', 'timeout', 'status', 'update', or 'delete'." }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Attendance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
