/**
 * Production-safe seed. Idempotent — safe to run on every deploy/start.
 *
 * Creates only what a fresh deployment needs to be usable:
 *   - The five departments the employee form expects
 *   - One ADMIN account (email/password from env, defaults below)
 *   - One HR account (email/password from env, defaults below)
 *
 * It never touches existing rows, never deletes data, and never creates
 * demo employees/attendance/payroll (that's prisma/seed.ts for dev only).
 *
 * Run via: npm run db:seed:prod   (or automatically on `npm start`)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@1megacore.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe-Admin-2026";
const HR_EMAIL = process.env.SEED_HR_EMAIL || "hr@1megacore.com";
const HR_PASSWORD = process.env.SEED_HR_PASSWORD || "ChangeMe-HR-2026";

const DEPARTMENTS = [
  { name: "Construction", description: "Core construction operations" },
  { name: "Engineering", description: "Engineering and design" },
  { name: "HR & Admin", description: "Human resources and administration" },
  { name: "Finance", description: "Finance and accounting" },
  { name: "Safety", description: "Health, safety, and environment" },
];

async function upsertUser(
  email: string,
  password: string,
  role: "ADMIN" | "HR"
): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists (${existing.role}) — skipped`);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, password: hashed, role },
  });
  console.log(`Created ${role} account: ${email}`);
}

async function main() {
  console.log("Running production seed...");

  // Departments required by the Add Employee form
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
  }
  console.log(`Departments ensured (${DEPARTMENTS.length})`);

  await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD, "ADMIN");
  await upsertUser(HR_EMAIL, HR_PASSWORD, "HR");

  console.log("Production seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
