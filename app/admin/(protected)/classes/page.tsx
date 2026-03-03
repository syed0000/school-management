import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getClassesWithFees } from "@/actions/class"
import { AddClassDialog } from "@/components/admin/add-class-dialog"
import { UpdateFeeDialog } from "@/components/admin/update-fee-dialog"
import { BackButton } from "@/components/ui/back-button"

export default async function ClassesPage() {
  const classes = await getClassesWithFees()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Classes & Fees</h2>
        <AddClassDialog />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class Name</TableHead>
              <TableHead>Monthly Fee</TableHead>
              <TableHead>Exam Fee</TableHead>
              <TableHead>Admission Fee</TableHead>
              <TableHead>Registration Fee</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  No classes found.
                </TableCell>
              </TableRow>
            ) : (
              classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>₹{cls.monthlyFee.toLocaleString()}</TableCell>
                  <TableCell>₹{cls.examFee.toLocaleString()}</TableCell>
                  <TableCell>₹{(cls.admissionFee || 0).toLocaleString()}</TableCell>
                  <TableCell>₹{(cls.registrationFee || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <UpdateFeeDialog classId={cls.id} className={cls.name} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
