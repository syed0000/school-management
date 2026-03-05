import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getExpenses } from "@/actions/expense"
import { getTeachers } from "@/actions/teacher"
import { ExpenseContent } from "@/components/admin/expenses/expense-content"

export const metadata: Metadata = {
  title: "Expenses | Modern Nursery",
  description: "Manage expenses and salaries",
}

interface TeacherDoc {
  _id: string;
  name: string;
  salary?: { amount: number; effectiveDate?: string };
}

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/login")
  }

  const { expenses, totalPages } = await getExpenses({
    page: 1,
    limit: 10,
    search: "",
    category: "all"
  })

  // Fetch all teachers for the dialog
  const teachers = await getTeachers()
  const formattedTeachers = (teachers as unknown as TeacherDoc[]).map((t) => ({
    id: t._id,
    name: t.name,
    salary: t.salary // { amount: number, effectiveDate: string }
  }))

  return (
    <ExpenseContent 
        initialExpenses={expenses}
        initialTotalPages={totalPages}
        formattedTeachers={formattedTeachers}
        userRole={session.user.role}
    />
  )
}
