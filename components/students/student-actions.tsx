"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Trash, Edit, Eye } from "lucide-react"
import { toast } from "sonner"
import { deleteStudent } from "@/actions/student"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useConfirm } from "@/context/ConfirmDialogContext"

interface StudentActionsProps {
  id: string
  name: string
  registrationNumber: string
  isAdmin: boolean
}

export function StudentActions({ id, name, registrationNumber, isAdmin }: StudentActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { confirm } = useConfirm()

  async function handleDelete() {
    if (!await confirm({
      title: "Delete Student",
      description: `Delete ${name} (${registrationNumber})? This will deactivate the student and remove them from active lists.`,
      confirmText: "Delete Student",
      variant: "destructive"
    })) return

    setIsLoading(true)
    try {
      const result = await deleteStudent(id)
      if (result.success) {
        toast.success("Student deleted successfully")
        router.refresh()
      } else {
        toast.error(`Failed to delete student: ${result.error}`)
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const editPath = `/students/${id}`;
  const viewPath = `/students/${id}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
          <span className="sr-only">Open menu</span>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={viewPath}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={editPath}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-red-600">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
