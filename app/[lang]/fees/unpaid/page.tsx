import { getUnpaidStudents } from '@/actions/unpaid-students'
import { UnpaidContent } from '@/components/fees/unpaid-content'
import { getClasses } from '@/actions/class'
import { startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function UnpaidStudentsPage() {
    const initialStartDate = startOfMonth(new Date(new Date().getFullYear(), 0, 1))
    const initialEndDate = endOfMonth(new Date())

    const filter = {
        startDate: initialStartDate,
        endDate: initialEndDate
    }

    const [unpaidStudents, classes] = await Promise.all([
        getUnpaidStudents(filter),
        getClasses()
    ])

    return (
        <UnpaidContent 
            initialStudents={unpaidStudents}
            classes={classes}
            initialStartDate={initialStartDate}
            initialEndDate={initialEndDate}
        />
    )
}
