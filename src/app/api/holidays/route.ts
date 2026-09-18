import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: "asc" },
    });
    return NextResponse.json(holidays);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Holidays fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const body = await request.json();
    const { name, date, type } = body;

    if (!name || !date) {
      return NextResponse.json({ error: "Name and date are required" }, { status: 400 });
    }

    if (type !== "REGULAR" && type !== "SPECIAL") {
      return NextResponse.json({ error: "Type must be REGULAR or SPECIAL" }, { status: 400 });
    }

    // Check if holiday already exists on this date
    const existing = await prisma.holiday.findFirst({
      where: {
        date: new Date(date),
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A holiday already exists on this date" }, { status: 400 });
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: new Date(date),
        type,
      },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Holiday create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
