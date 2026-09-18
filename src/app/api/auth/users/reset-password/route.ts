import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST /api/auth/users/reset-password  (ADMIN only)
// Body: { userId, newPassword }
// Lets an admin set a user's password without knowing the old one.
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);

    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: "User ID and new password are required" },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
