/**
 * One-time (idempotent) import of the real company employee lists.
 *
 * - Creates one Department per company list: 1MEGACORE, Pauline's, Shared, 1MPRL, Laguna On-Call
 * - Creates one Employee per person (shared staff appear once, in "Shared")
 * - Rates are imported as 0 and hire date as today — HR fills these in via the app afterwards
 * - Auto-creates an EMPLOYEE login per person, same convention as the Add Employee API
 *   (email derived from employee number, default password: password123)
 *
 * Safe to re-run: existing people (matched by name within their group) are skipped.
 *
 * Run via: npx tsx prisma/import-employees.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// name parsing: "Romeo Bardonado Jr." -> first "Romeo", last "Bardonado", suffix "Jr."
function parseName(fullName: string) {
  const suffixes = new Set(["Jr", "Jr.", "Sr", "Sr.", "II", "III", "IV"]);
  const parts = fullName.trim().split(/\s+/);
  let suffix: string | null = null;
  const lastPart = parts[parts.length - 1];
  if (parts.length > 1 && suffixes.has(lastPart)) {
    suffix = lastPart.replace(/\./g, "");
    parts.pop();
  }
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || parts[0] || "";
  return { firstName, lastName, suffix };
}

type Row = { name: string; position: string };

const GROUPS: { department: string; description: string; employees: Row[] }[] = [
  {
    department: "1MEGACORE",
    description: "1MEGACORE employee list",
    employees: [
      { name: "Paul Robert Banaria", position: "Manager" },
      { name: "Ashly Gobaton", position: "Assistant Manager" },
      { name: "Jazzmine De Villa", position: "Electrical Engineer" },
      { name: "James Acbang", position: "Mechanical Engineer" },
      { name: "Lenard Beliber", position: "Junior Architect" },
      { name: "Romeo Bardonado Jr.", position: "Foreman" },
      { name: "Jonnel Fortuna", position: "Mason" },
      { name: "Marben Paz", position: "Mason" },
      { name: "James Bagohara", position: "Labor" },
      { name: "Jaylord Paz", position: "Labor" },
      { name: "Jomel Arroyo", position: "Electrician" },
      { name: "Milton John Allat", position: "Electrician" },
      { name: "James Speer", position: "Driver" },
      { name: "Khim John Belen", position: "ON-CALL" },
    ],
  },
  {
    department: "Pauline's",
    description: "Pauline's employee list",
    employees: [
      { name: "Michelle Tombado", position: "Manager" },
      { name: "Anjoe Tombado", position: "Assistant Manager" },
      { name: "Wenny De Villa", position: "Architect" },
      { name: "Mary Joy Noarin", position: "Administrative Assistant" },
      { name: "Denver Talagtag", position: "Aircon Technician" },
      { name: "Charles Navida", position: "Welder/Fabricator" },
      { name: "Alvin De Villa", position: "Painter" },
      { name: "Justulio Quindo", position: "Landscaper" },
      { name: "Marites Ramirez", position: "Landscaper" },
      { name: "Joy Cupanes", position: "Landscaper" },
      { name: "Kevin Ramirez", position: "Landscaper" },
    ],
  },
  {
    department: "Shared",
    description: "Shared staff across companies",
    employees: [
      { name: "Kervie Azur", position: "Finance Assistant" },
      { name: "Jayson Banaria", position: "Web Developer" },
      { name: "Elloney Espenosa", position: "Accountant" },
      { name: "Joyce Benosa", position: "Housekeeping" },
      { name: "Mercy Embestro", position: "Housekeeping" },
    ],
  },
  {
    department: "1MPRL",
    description: "1MPRL employee list",
    employees: [
      { name: "Mayla Lawas", position: "Managing Director" },
      { name: "Ferdinand Lawas", position: "Finance Head" },
      { name: "Marites Turingan", position: "Finance" },
      { name: "Andrew Lawas", position: "Auditor" },
      { name: "Chris Lawas", position: "Engineering Department" },
      { name: "Nino Benjohn Bagacina", position: "Executive & Personal Assistant" },
      { name: "Kyla Amor", position: "Electrical Engineer" },
      { name: "Ahldz Bagamasbad", position: "Electrical Engineer" },
      { name: "Aprelle Resoco", position: "Administrative Assistant" },
      { name: "Colleen Belmonte", position: "Operations Assistant" },
      { name: "Jesus Cereno", position: "Welder/Fabricator" },
      { name: "Jayson Paz", position: "Welder/Fabricator" },
      { name: "Jay Amoroso", position: "Painter" },
      { name: "Jake Bedural", position: "Labor" },
      { name: "Christian De Guia", position: "Electrician" },
      { name: "Kurt Russel Baal", position: "Electrician" },
      { name: "Adrian Montecillo", position: "Driver" },
      { name: "Romnick Turingan", position: "Driver" },
    ],
  },
  {
    department: "Laguna On-Call",
    description: "Laguna on-call labor pool",
    employees: [
      { name: "John Francis Borboran", position: "Labor" },
      { name: "Michael Macapua", position: "Labor" },
      { name: "Johncell Tandang", position: "Labor" },
    ],
  },
];

async function main() {
  console.log("Importing company employees...");

  // Departments (idempotent)
  const deptIds = new Map<string, string>();
  for (const group of GROUPS) {
    const dept = await prisma.department.upsert({
      where: { name: group.department },
      update: {},
      create: { name: group.department, description: group.description },
    });
    deptIds.set(group.department, dept.id);
  }

  // Continue employee numbering after the highest existing MGC-### number
  const lastEmp = await prisma.employee.findFirst({
    orderBy: { employeeNumber: "desc" },
  });
  let nextNum = lastEmp
    ? parseInt(lastEmp.employeeNumber.replace("MGC-", ""), 10) + 1
    : 1;

  const hashedPassword = await bcrypt.hash("password123", 10);
  const today = new Date();
  let created = 0;
  let skipped = 0;

  for (const group of GROUPS) {
    const departmentId = deptIds.get(group.department)!;
    for (const row of group.employees) {
      const { firstName, lastName, suffix } = parseName(row.name);

      // Idempotency: match on first+last name within the same department
      const existing = await prisma.employee.findFirst({
        where: { firstName, lastName, departmentId },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const employeeNumber = `MGC-${String(nextNum).padStart(3, "0")}`;
      nextNum++;

      const employee = await prisma.employee.create({
        data: {
          employeeNumber,
          firstName,
          lastName,
          suffix,
          position: row.position,
          departmentId,
          hireDate: today,
          dailyRate: 0,
          monthlyRate: 0,
        },
      });

      await prisma.user.create({
        data: {
          email: `${employeeNumber.toLowerCase()}@1megacore.com`,
          password: hashedPassword,
          role: "EMPLOYEE",
          employeeId: employee.id,
        },
      });

      created++;
      console.log(`  + ${employeeNumber}  ${row.name} — ${row.position} [${group.department}]`);
    }
  }

  console.log(`\nImport complete: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
