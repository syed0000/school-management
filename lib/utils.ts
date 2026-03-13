import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCurrentSession(): string {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11 (Jan-Dec)
    const currentYear = now.getFullYear();

    // Session starts in April (Month 3)
    // If current month is Jan (0), Feb (1), March (2), then session is (currentYear - 1) - currentYear
    // If current month is April (3) or later, then session is currentYear - (currentYear + 1)

    if (currentMonth < 3) {
        return `${currentYear - 1}-${currentYear}`;
    } else {
        return `${currentYear}-${currentYear + 1}`;
    }
}

export function getCurrentSessionStartYear(): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return currentMonth < 3 ? currentYear - 1 : currentYear;
}

export function getYearForMonth(monthIndex: number, sessionStartYear: number): number {
    // Academic year: April (3) to March (2)
    // months 3-11 are in sessionStartYear
    // months 0-2 are in sessionStartYear + 1
    return monthIndex >= 3 ? sessionStartYear : sessionStartYear + 1;
}

export function getAcademicYearStart(year: number): Date {
    // Academic year starts on April 1st of the given year
    return new Date(year, 3, 1);
}

export function getAcademicYearEnd(year: number): Date {
    // Academic year ends on March 31st of the next year
    return new Date(year + 1, 2, 31);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(amount);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
