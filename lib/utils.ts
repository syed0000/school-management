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

export function getAcademicYearStart(year: number): Date {
    // Academic year starts on April 1st of the given year
    return new Date(year, 3, 1);
}

export function getAcademicYearEnd(year: number): Date {
    // Academic year ends on March 31st of the next year
    return new Date(year + 1, 2, 31);
}
