import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { department: true, projectSite: true },
      });
      if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(employee);
    }

    const employees = await prisma.employee.findMany({
      include: { department: true, projectSite: true },
      orderBy: { employeeNumber: "asc" },
    });
    return NextResponse.json(employees);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const body = await request.json();

    // Generate employee number
    const lastEmp = await prisma.employee.findFirst({
      orderBy: { employeeNumber: "desc" },
    });
    const nextNum = lastEmp
      ? parseInt(lastEmp.employeeNumber.replace("MGC-", "")) + 1
      : 1;
    const employeeNumber = `MGC-${String(nextNum).padStart(3, "0")}`;

    const employee = await prisma.employee.create({
      data: {
        employeeNumber,
        firstName: body.firstName,
        middleName: body.middleName || null,
        lastName: body.lastName,
        suffix: body.suffix || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        gender: body.gender || null,
        civilStatus: body.civilStatus || null,
        address: body.address || null,
        phone: body.phone || null,
        email: body.email || null,
        position: body.position,
        departmentId: body.departmentId,
        projectSiteId: body.projectSiteId || null,
        hireDate: new Date(body.hireDate),
        dailyRate: body.dailyRate,
        monthlyRate: body.monthlyRate,
        sssNumber: body.sssNumber || null,
        philhealthNumber: body.philhealthNumber || null,
        pagibigNumber: body.pagibigNumber || null,
        tinNumber: body.tinNumber || null,
        skills: body.skills?.length
          ? {
              create: body.skills.map((s: { skillId: string; proficiency: string }) => ({
                skillId: s.skillId,
                proficiency: s.proficiency,
              })),
            }
          : undefined,
      },
    });

    // Auto-create user account
    const tempPassword = await bcrypt.hash("password123", 10);
    await prisma.user.create({
      data: {
        email: body.email || `${employeeNumber.toLowerCase()}@1megacore.com`,
        password: tempPassword,
        role: "EMPLOYEE",
        employeeId: employee.id,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Create employee error:", error);
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete related records first
    await prisma.user.deleteMany({ where: { employeeId: id } });
    await prisma.employeeSkill.deleteMany({ where: { employeeId: id } });
    await prisma.attendance.deleteMany({ where: { employeeId: id } });
    await prisma.payrollRecord.deleteMany({ where: { employeeId: id } });
    await prisma.cashAdvance.deleteMany({ where: { employeeId: id } });
    await prisma.employee.delete({ where: { id } });

    return NextResponse.json({ success: true, message: `Deleted employee ${employee.firstName} ${employee.lastName}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Delete employee error:", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const body = await request.json();
    const employee = await prisma.employee.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(employee);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}
