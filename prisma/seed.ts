import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create departments
  const departments = await Promise.all([
    prisma.department.create({ data: { name: "Construction", description: "Core construction operations" } }),
    prisma.department.create({ data: { name: "Engineering", description: "Engineering and design" } }),
    prisma.department.create({ data: { name: "HR & Admin", description: "Human resources and administration" } }),
    prisma.department.create({ data: { name: "Finance", description: "Finance and accounting" } }),
    prisma.department.create({ data: { name: "Safety", description: "Health, safety, and environment" } }),
  ]);

  // Create project sites
  const sites = await Promise.all([
    prisma.projectSite.create({ data: { name: "Iriga City Hall Renovation", location: "Iriga City Center", description: "Government building renovation project" } }),
    prisma.projectSite.create({ data: { name: "Bicol Medical Center Extension", location: "Naga City", description: "Hospital wing expansion" } }),
    prisma.projectSite.create({ data: { name: "Riverside Condominium", location: "Iriga City Proper", description: "Residential condominium development" } }),
    prisma.projectSite.create({ data: { name: "Provincial Road Improvement", location: "Camarines Sur", description: "Road widening and improvement project" } }),
  ]);

  // Create skills
  const skills = await Promise.all([
    prisma.skill.create({ data: { name: "Welding", description: "Arc and MIG welding" } }),
    prisma.skill.create({ data: { name: "Carpentry", description: "Wood framing and finishing" } }),
    prisma.skill.create({ data: { name: "Masonry", description: "Concrete and block laying" } }),
    prisma.skill.create({ data: { name: "Electrical", description: "Electrical installation and wiring" } }),
    prisma.skill.create({ data: { name: "Plumbing", description: "Pipe fitting and installation" } }),
    prisma.skill.create({ data: { name: "Heavy Equipment", description: "Operating excavators, cranes" } }),
    prisma.skill.create({ data: { name: "Painting", description: "Interior and exterior painting" } }),
    prisma.skill.create({ data: { name: "Tiling", description: "Floor and wall tiling" } }),
    prisma.skill.create({ data: { name: "Blueprint Reading", description: "Reading and interpreting construction plans" } }),
    prisma.skill.create({ data: { name: "First Aid", description: "Emergency response certified" } }),
  ]);

  // Create employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-001",
        firstName: "Juan",
        middleName: "Santos",
        lastName: "Dela Cruz",
        position: "Project Manager",
        departmentId: departments[0].id,
        projectSiteId: sites[0].id,
        hireDate: new Date("2020-01-15"),
        dailyRate: 1500,
        monthlyRate: 39000,
        phone: "09171234567",
        email: "juan.delacruz@1megacore.com",
        gender: "Male",
        civilStatus: "Married",
        sssNumber: "34-1234567-8",
        philhealthNumber: "12-345678901-2",
        pagibigNumber: "1234-5678-9012",
        tinNumber: "123-456-789-000",
        skills: { create: [{ skillId: skills[0].id, proficiency: "Expert" }, { skillId: skills[8].id, proficiency: "Expert" }] },
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-002",
        firstName: "Maria",
        middleName: "Reyes",
        lastName: "Santos",
        position: "Site Engineer",
        departmentId: departments[1].id,
        projectSiteId: sites[1].id,
        hireDate: new Date("2021-03-10"),
        dailyRate: 1200,
        monthlyRate: 31200,
        phone: "09181234567",
        email: "maria.santos@1megacore.com",
        gender: "Female",
        civilStatus: "Single",
        sssNumber: "34-2345678-9",
        philhealthNumber: "12-345678902-3",
        pagibigNumber: "1234-5678-9013",
        tinNumber: "123-456-789-001",
        skills: { create: [{ skillId: skills[8].id, proficiency: "Expert" }, { skillId: skills[9].id, proficiency: "Advanced" }] },
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-003",
        firstName: "Pedro",
        middleName: "Garcia",
        lastName: "Reyes",
        position: "Welder",
        departmentId: departments[0].id,
        projectSiteId: sites[0].id,
        hireDate: new Date("2022-06-01"),
        dailyRate: 800,
        monthlyRate: 20800,
        phone: "09191234567",
        email: "pedro.reyes@1megacore.com",
        gender: "Male",
        civilStatus: "Single",
        sssNumber: "34-3456789-0",
        philhealthNumber: "12-345678903-4",
        pagibigNumber: "1234-5678-9014",
        tinNumber: "123-456-789-002",
        skills: { create: [{ skillId: skills[0].id, proficiency: "Expert" }] },
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-004",
        firstName: "Ana",
        middleName: "Cruz",
        lastName: "Lopez",
        position: "HR Officer",
        departmentId: departments[2].id,
        hireDate: new Date("2021-09-15"),
        dailyRate: 900,
        monthlyRate: 23400,
        phone: "09201234567",
        email: "ana.lopez@1megacore.com",
        gender: "Female",
        civilStatus: "Married",
        sssNumber: "34-4567890-1",
        philhealthNumber: "12-345678904-5",
        pagibigNumber: "1234-5678-9015",
        tinNumber: "123-456-789-003",
        skills: { create: [{ skillId: skills[9].id, proficiency: "Advanced" }] },
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-005",
        firstName: "Roberto",
        middleName: "Bautista",
        lastName: "Garcia",
        position: "Electrician",
        departmentId: departments[0].id,
        projectSiteId: sites[2].id,
        hireDate: new Date("2023-01-20"),
        dailyRate: 850,
        monthlyRate: 22100,
        phone: "09211234567",
        email: "roberto.garcia@1megacore.com",
        gender: "Male",
        civilStatus: "Married",
        sssNumber: "34-5678901-2",
        philhealthNumber: "12-345678905-6",
        pagibigNumber: "1234-5678-9016",
        tinNumber: "123-456-789-004",
        skills: { create: [{ skillId: skills[3].id, proficiency: "Expert" }, { skillId: skills[9].id, proficiency: "Beginner" }] },
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-006",
        firstName: "Liza",
        middleName: "Villanueva",
        lastName: "Mendoza",
        position: "Accountant",
        departmentId: departments[3].id,
        hireDate: new Date("2020-05-10"),
        dailyRate: 1000,
        monthlyRate: 26000,
        phone: "09221234567",
        email: "liza.mendoza@1megacore.com",
        gender: "Female",
        civilStatus: "Single",
        sssNumber: "34-6789012-3",
        philhealthNumber: "12-345678906-7",
        pagibigNumber: "1234-5678-9017",
        tinNumber: "123-456-789-005",
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-007",
        firstName: "Mark",
        middleName: "Rivera",
        lastName: "Torres",
        position: "Mason",
        departmentId: departments[0].id,
        projectSiteId: sites[3].id,
        hireDate: new Date("2022-11-05"),
        dailyRate: 750,
        monthlyRate: 19500,
        phone: "09231234567",
        email: "mark.torres@1megacore.com",
        gender: "Male",
        civilStatus: "Single",
        sssNumber: "34-7890123-4",
        philhealthNumber: "12-345678907-8",
        pagibigNumber: "1234-5678-9018",
        tinNumber: "123-456-789-006",
        skills: { create: [{ skillId: skills[2].id, proficiency: "Expert" }] },
      },
    }),
    prisma.employee.create({
      data: {
        employeeNumber: "MGC-008",
        firstName: "Chloe",
        middleName: "Aquino",
        lastName: "Ramos",
        position: "Safety Officer",
        departmentId: departments[4].id,
        projectSiteId: sites[1].id,
        hireDate: new Date("2021-07-22"),
        dailyRate: 950,
        monthlyRate: 24700,
        phone: "09241234567",
        email: "chloe.ramos@1megacore.com",
        gender: "Female",
        civilStatus: "Married",
        sssNumber: "34-8901234-5",
        philhealthNumber: "12-345678908-9",
        pagibigNumber: "1234-5678-9019",
        tinNumber: "123-456-789-007",
        skills: { create: [{ skillId: skills[9].id, proficiency: "Expert" }] },
      },
    }),
  ]);

  // Create users
  const hashedPassword = await bcrypt.hash("password123", 10);

  await prisma.user.create({
    data: { email: "admin@1megacore.com", password: hashedPassword, role: "ADMIN", employeeId: employees[0].id },
  });
  await prisma.user.create({
    data: { email: "hr@1megacore.com", password: hashedPassword, role: "HR", employeeId: employees[3].id },
  });
  await prisma.user.create({
    data: { email: "employee@1megacore.com", password: hashedPassword, role: "EMPLOYEE", employeeId: employees[2].id },
  });

  // Create sample attendance for current month
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  for (const employee of employees) {
    for (let day = 1; day <= Math.min(today.getDate(), 15); day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) continue; // Skip Sundays

      const isLate = Math.random() < 0.15;
      const isOvertime = Math.random() < 0.1;
      const hourIn = isLate ? 8 + Math.floor(Math.random() * 2) : 7 + Math.floor(Math.random() * 2);
      const minuteIn = isLate ? 30 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 30);
      const hourOut = isOvertime ? 18 + Math.floor(Math.random() * 2) : 17 + Math.floor(Math.random() * 1);

      const timeIn = new Date(year, month, day, hourIn, minuteIn);
      const timeOut = new Date(year, month, day, hourOut, Math.floor(Math.random() * 60));
      const hoursWorked = Math.min((timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60) - 1, 12);

      await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          projectSiteId: employee.projectSiteId,
          date: new Date(year, month, day),
          timeIn,
          timeOut,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          overtimeHours: isOvertime ? Math.max(0, Math.floor(Math.max(0, (timeOut.getTime() - new Date(year, month, day, 17, 0).getTime()) / (1000 * 60 * 60)))) : 0,
          lateMinutes: isLate ? Math.round((hourIn * 60 + minuteIn - 8 * 60)) : 0,
          status: isLate ? "LATE" : "PRESENT",
        },
      });
    }
  }

  // Create a sample payroll period
  const payrollPeriod = await prisma.payrollPeriod.create({
    data: {
      name: `${today.toLocaleString("en-US", { month: "long" })} 1-15, ${year}`,
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month, 15),
      payDate: new Date(year, month, 20),
      status: "DRAFT",
    },
  });

  // Create payroll records for each employee
  for (const employee of employees) {
    const daysWorked = 10 + Math.floor(Math.random() * 3);
    const basicPay = daysWorked * employee.dailyRate;
    const overtimePay = Math.floor(Math.random() * 3) * employee.dailyRate * 0.25;
    const grossPay = basicPay + overtimePay;
    const sss = Math.round(basicPay * 0.045);
    const philhealth = Math.round(basicPay * 0.0225);
    const pagibig = Math.min(200, Math.round(basicPay * 0.02));
    const tax = Math.round(Math.max(0, grossPay - sss - philhealth - pagibig) * 0.1);
    const totalDeductions = sss + philhealth + pagibig + tax;

    await prisma.payrollRecord.create({
      data: {
        payrollPeriodId: payrollPeriod.id,
        employeeId: employee.id,
        basicPay,
        overtimePay,
        grossPay,
        sssDeduction: sss,
        philhealthDeduction: philhealth,
        pagibigDeduction: pagibig,
        withholdingTax: tax,
        totalDeductions,
        netPay: grossPay - totalDeductions,
        daysWorked,
        totalOvertimeHours: overtimePay / (employee.dailyRate / 8),
      },
    });
  }

  console.log("Seeding completed!");
  console.log("Login credentials:");
  console.log("  Admin: admin@1megacore.com / password123");
  console.log("  HR:    hr@1megacore.com / password123");
  console.log("  Employee: employee@1megacore.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
