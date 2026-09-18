import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount).replace("PHP", "₱");
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function getPayPeriodDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Philippine BIR Withholding Tax Table (2023 onwards, graduated)
export function computeWithholdingTax(taxableIncome: number): number {
  if (taxableIncome <= 20833) return 0;
  if (taxableIncome <= 33333) return (taxableIncome - 20833) * 0.15;
  if (taxableIncome <= 66667) return 1875 + (taxableIncome - 33333) * 0.20;
  if (taxableIncome <= 166667) return 8541.67 + (taxableIncome - 66667) * 0.25;
  if (taxableIncome <= 666667) return 33541.67 + (taxableIncome - 166667) * 0.30;
  return 183541.67 + (taxableIncome - 666667) * 0.35;
}

// SSS Contribution Table 2024 (simplified)
export function computeSSS(monthlySalary: number): number {
  const bracket = [
    [3250, 3750, 135], [3750, 4250, 157.5], [4250, 4750, 180],
    [4750, 5250, 202.5], [5250, 5750, 225], [5750, 6250, 247.5],
    [6250, 6750, 270], [6750, 7250, 292.5], [7250, 7750, 315],
    [7750, 8250, 337.5], [8250, 8750, 360], [8750, 9250, 382.5],
    [9250, 9750, 405], [9750, 10250, 427.5], [10250, 10750, 450],
    [10750, 11250, 472.5], [11250, 11750, 495], [11750, 12250, 517.5],
    [12250, 12750, 540], [12750, 13250, 562.5], [13250, 13750, 585],
    [13750, 14250, 607.5], [14250, 14750, 630], [14750, 15250, 652.5],
    [15250, 15750, 675], [15750, 16250, 697.5], [16250, 16750, 720],
    [16750, 17250, 742.5], [17250, 17750, 765], [17750, 18250, 787.5],
    [18250, 18750, 810], [18750, 19250, 832.5], [19250, 19750, 855],
    [19750, 20250, 877.5], [20250, 20750, 900], [20750, 21250, 922.5],
    [21250, 21750, 945], [21750, 22250, 967.5], [22250, 22750, 990],
    [22750, 23250, 1012.5], [23250, 23750, 1035], [23750, 24250, 1057.5],
  ];
  for (const [min, max, contribution] of bracket) {
    if (monthlySalary >= min && monthlySalary < max) return contribution;
  }
  return 1080; // max
}

// PhilHealth Contribution 2024
export function computePhilHealth(monthlySalary: number): number {
  if (monthlySalary <= 10000) return 10000 * 0.0225 / 2;
  if (monthlySalary >= 100000) return 100000 * 0.05 / 2;
  return monthlySalary * 0.05 / 2;
}

// Pag-IBIG Contribution 2024
export function computePagIBIG(monthlySalary: number): number {
  if (monthlySalary <= 1500) return monthlySalary * 0.01;
  if (monthlySalary >= 5000) return 200; // max employee share
  return monthlySalary * 0.02;
}
