"use client"

import { useState, useTransition, useCallback } from "react"
import { getExpenses } from "@/actions/expense"
import { ExpenseTable } from "@/components/admin/expenses/expense-table"
import { ExpenseDialog } from "@/components/admin/expenses/expense-dialog"
import { ExpenseFilters } from "@/components/admin/expenses/expense-filters"
import { ExportButton } from "@/components/admin/expenses/export-button"
import { Pagination } from "@/components/admin/expenses/pagination"
import { BackButton } from "@/components/ui/back-button"

interface ExpenseContentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialExpenses: any[]
  initialTotalPages: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formattedTeachers: any[]
}

export function ExpenseContent({ initialExpenses, initialTotalPages, formattedTeachers }: ExpenseContentProps) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  // Keep track of filters
  const [currentFilters, setCurrentFilters] = useState<{
    search?: string
    category?: string
    startDate?: string
    endDate?: string
  }>({})

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchData = useCallback((filters: any, newPage: number) => {
    startTransition(async () => {
      const { expenses: newExpenses, totalPages: newTotalPages } = await getExpenses({
        page: newPage,
        limit: 10,
        search: filters.search,
        category: filters.category,
        startDate: filters.startDate,
        endDate: filters.endDate
      })

      setExpenses(newExpenses)
      setTotalPages(newTotalPages)
      setPage(newPage)
    })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFilter = useCallback((filters: any) => {
    setCurrentFilters(filters)
    fetchData(filters, 1)
  }, [fetchData])

  const handlePageChange = useCallback((newPage: number) => {
    fetchData(currentFilters, newPage)
  }, [fetchData, currentFilters])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExpenseDeleted = (id: string) => {
    setExpenses(expenses.filter(ex => ex.id !== id))
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <BackButton />
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Expense Management</h2>
        <div className="flex items-center space-x-2">
          <ExportButton 
            search={currentFilters.search}
            category={currentFilters.category}
            startDate={currentFilters.startDate}
            endDate={currentFilters.endDate}
          />
          <ExpenseDialog 
            mode="create" 
            teachers={formattedTeachers} 
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <ExpenseFilters onFilter={handleFilter} isLoading={isPending} />
        
        <div className={isPending ? 'opacity-50 pointer-events-none' : ''}>
            <ExpenseTable 
              data={expenses} 
              teachers={formattedTeachers}
            />
            
            {totalPages > 1 && (
              <Pagination 
                currentPage={page} 
                totalPages={totalPages} 
                onPageChange={handlePageChange}
              />
            )}
        </div>
      </div>
    </div>
  )
}
