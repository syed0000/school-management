import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getExpenses } from "@/actions/expense"
import { getTeachers } from "@/actions/teacher"
import { ExpenseContent } from "@/components/admin/expenses/expense-content"
import type { Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"

export const metadata: Metadata = {
  title: "Expenses | Institute Management",
  description: "Manage expenses and salaries",
}

interface TeacherDoc {
  _id: string;
  name: string;
  salary?: { amount: number; effectiveDate?: string };
}

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ lang: Locale }>
}) {
  const { lang } = await params
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect(withLocale(lang, "/login"))
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
