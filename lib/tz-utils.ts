import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getTimezoneSetting } from '@/actions/school-settings';

/**
 * Returns UTC boundaries for a given date in the specific timezone.
 * date: The client local Javascript Date object (where new Date(date).getHours/etc returns local time representation).
 * We effectively treat `date` as representing the intended logical Day in the school's Timezone.
 */
export async function getSchoolDateBoundaries(date: Date) {
    const tz = await getTimezoneSetting();
    
    const dateString = formatInTimeZone(date, tz, 'yyyy-MM-dd');
    
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
