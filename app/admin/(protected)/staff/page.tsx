import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getStaffList } from "@/actions/admin"
import { CreateStaffDialog } from "@/components/admin/create-staff-dialog"
import { StaffActions } from "@/components/admin/staff-actions"
import { format } from "date-fns"
import { BackButton } from "@/components/ui/back-button"

export default async function AdminStaffPage() {
  const staffList = await getStaffList()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Staff Management</h2>
        <CreateStaffDialog />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No staff members found.
                </TableCell>
              </TableRow>
            ) : (
              staffList.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.name}</TableCell>
                  <TableCell>{staff.email}</TableCell>
                  <TableCell>{staff.phone}</TableCell>
                  <TableCell className="capitalize">{staff.role.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${staff.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {staff.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>{format(new Date(staff.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <StaffActions id={staff.id} isActive={staff.isActive} />
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
