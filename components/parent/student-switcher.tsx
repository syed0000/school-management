"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import type { ParentStudentProfile } from "@/types";

interface StudentSwitcherProps {
  students: ParentStudentProfile[];
  activeStudentId: string;
}

export function StudentSwitcher({ students, activeStudentId }: StudentSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const activeStudent = students.find((s) => s._id === activeStudentId) ?? students[0];

  if (!activeStudent) return null;

  // Only show switcher when there is more than one student
  if (students.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-medium">
        <Avatar className="h-6 w-6">
          <AvatarImage src={activeStudent.photo} />
          <AvatarFallback className="text-[10px]">{activeStudent.name[0]}</AvatarFallback>
        </Avatar>
        <span>{activeStudent.name}</span>
        <span className="text-muted-foreground text-xs">· {activeStudent.className} {activeStudent.section}</span>
      </div>
    );
  }

  const switchStudent = (studentId: string) => {
    setOpen(false);
    router.replace(`/parent/dashboard?studentId=${studentId}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full pr-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={activeStudent.photo} />
            <AvatarFallback className="text-[10px]">{activeStudent.name[0]}</AvatarFallback>
          </Avatar>
          <span className="font-medium max-w-[120px] truncate">{activeStudent.name}</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">
            · {activeStudent.className} {activeStudent.section}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch student profile
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {students.map((student) => (
          <DropdownMenuItem
            key={student._id}
            className="gap-3 cursor-pointer py-2"
            onClick={() => switchStudent(student._id)}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={student.photo} />
              <AvatarFallback>{student.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{student.name}</div>
              <div className="text-xs text-muted-foreground">
                {student.className} – Section {student.section}
              </div>
            </div>
            {student._id === activeStudentId && (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
