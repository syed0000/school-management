"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Power } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toggleDemoUserStatus } from "@/actions/admin"

interface DemoUserActionsProps {
  id: string
  isActive: boolean
}

export function DemoUserActions({ id, isActive }: DemoUserActionsProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleToggleStatus() {
    setIsLoading(true)
    try {
      const result = await toggleDemoUserStatus(id, !isActive)
      if (result.success) {
        toast.success(`Demo user ${isActive ? "deactivated" : "activated"}`)
      } else {
        toast.error(result.error || "Failed to update status")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

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
        <DropdownMenuItem onClick={handleToggleStatus}>
          <Power className="mr-2 h-4 w-4" />
          {isActive ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

