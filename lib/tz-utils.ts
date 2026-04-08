import { fromZonedTime } from 'date-fns-tz';
import { getTimezoneSetting } from '@/actions/school-settings';

/**
 * Returns UTC boundaries for a given date in the specific timezone.
 * date: The client local Javascript Date object (where new Date(date).getHours/etc returns local time representation).
 * We effectively treat `date` as representing the intended logical Day in the school's Timezone.
 */
export async function getSchoolDateBoundaries(date: Date) {
    const tz = await getTimezoneSetting();
    
    // Format the date into YYYY-MM-DD in local time of the client (Assuming client picked that day)
    // Actually, `date` coming from UI (say April 4) might be April 3 18:30 UTC if client timezone offset.
    // If we just extract the YYYY-MM-DD string that the date represents to the client (we assume date.getDate() etc is the intended calendar day).
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const dateString = `${year}-${month}-${day}`;
    
    // Compute the start and end of that calendar day in the school timezone, and convert to UTC
    const startUtc = fromZonedTime(`${dateString} 00:00:00`, tz);
    const endUtc = fromZonedTime(`${dateString} 23:59:59.999`, tz);
    
    return { startUtc, endUtc };
}

/**
 * If you need the timezone string synchronously
 */
export async function getSchoolTimezone() {
    return await getTimezoneSetting();
}
