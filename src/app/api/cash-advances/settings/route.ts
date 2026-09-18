import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

// GET: Fetch cash advance settings
export async function GET() {
  try {
    await requireAuth(["ADMIN", "HR"]);
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update cash advance settings
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);

    const body = await request.json();
    const { cashAdvanceLimit, cashAdvanceMaxNetFraction } = body;

    const data: { cashAdvanceLimit?: number; cashAdvanceMaxNetFraction?: number } = {};

    if (cashAdvanceLimit !== undefined) {
      const limit = Number(cashAdvanceLimit);
      if (isNaN(limit) || limit < 0) {
        return NextResponse.json({ error: "Limit must be a non-negative number" }, { status: 400 });
      }
      data.cashAdvanceLimit = limit;
    }

    if (cashAdvanceMaxNetFraction !== undefined) {
      const fraction = Number(cashAdvanceMaxNetFraction);
      if (isNaN(fraction) || fraction < 0 || fraction > 1) {
        return NextResponse.json({ error: "Fraction must be between 0 and 1" }, { status: 400 });
      }
      data.cashAdvanceMaxNetFraction = fraction;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: data,
      create: data,
    });

    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Update cash advance settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
