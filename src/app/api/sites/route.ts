import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const site = await prisma.projectSite.findUnique({
        where: { id },
        include: { employees: true },
      });
      if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(site);
    }

    const sites = await prisma.projectSite.findMany({
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sites);
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

    if (!body.name || !body.location) {
      return NextResponse.json({ error: "Name and location are required" }, { status: 400 });
    }

    const site = await prisma.projectSite.create({
      data: {
        name: body.name,
        location: body.location,
        description: body.description || null,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Create site error:", error);
    return NextResponse.json({ error: "Failed to create site" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const body = await request.json();
    const site = await prisma.projectSite.update({
      where: { id },
      data: {
        name: body.name,
        location: body.location,
        description: body.description,
        isActive: body.isActive,
      },
    });
    return NextResponse.json(site);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Check if site has employees
    const employeeCount = await prisma.employee.count({
      where: { projectSiteId: id },
    });
    if (employeeCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete site with assigned employees. Reassign them first." },
        { status: 400 }
      );
    }

    await prisma.projectSite.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to delete site" }, { status: 500 });
  }
}
