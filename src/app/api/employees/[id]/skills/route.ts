import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { id } = await params;
    const body = await request.json();

    // Delete existing skills
    await prisma.employeeSkill.deleteMany({
      where: { employeeId: id },
    });

    // Add new skills
    if (body.skills?.length) {
      await prisma.employeeSkill.createMany({
        data: body.skills.map((s: { skillId: string; proficiency: string }) => ({
          employeeId: id,
          skillId: s.skillId,
          proficiency: s.proficiency,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Skills update error:", error);
    return NextResponse.json({ error: "Failed to update skills" }, { status: 500 });
  }
}
