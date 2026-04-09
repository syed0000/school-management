import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getTimezoneSetting } from '@/actions/school-settings';

function isYmdString(value: unknown): value is string {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

function ymdToUtcDate(ymd: string): Date {
    const [y, m, d] = ymd.split("-").map((v) => Number(v))
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0))
}

export function listYmdRange(startYmd: string, endYmd: string): string[] {
    const start = ymdToUtcDate(startYmd)
    const end = ymdToUtcDate(endYmd)
    const out: string[] = []
    for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
        const dt = new Date(t)
        const y = dt.getUTCFullYear()
        const m = String(dt.getUTCMonth() + 1).padStart(2, "0")
        const d = String(dt.getUTCDate()).padStart(2, "0")
        out.push(`${y}-${m}-${d}`)
    }
    return out
}

/**
 * Returns UTC boundaries for a given date in the specific timezone.
 * date: The client local Javascript Date object (where new Date(date).getHours/etc returns local time representation).
 * We effectively treat `date` as representing the intended logical Day in the school's Timezone.
 */
export async function getSchoolDateBoundaries(date: Date | string) {
    const tz = await getTimezoneSetting();

    const dateString = isYmdString(date) ? date.trim() : formatInTimeZone(date, tz, 'yyyy-MM-dd');
    
    // Compute the start and end of that calendar day in the school timezone, and convert to UTC
    const startUtc = fromZonedTime(`${dateString}T00:00:00.000`, tz);
    const endUtc = fromZonedTime(`${dateString}T23:59:59.999`, tz);
    
    return { startUtc, endUtc };
}

/**
 * If you need the timezone string synchronously
 */
export async function getSchoolTimezone() {
    return await getTimezoneSetting();
}
