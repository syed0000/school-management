"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const queryStudentId = searchParams.get("studentId");
  const effectiveActiveId = queryStudentId || activeStudentId;

  const activeStudent = students.find((s) => s._id === effectiveActiveId) ?? students[0];

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
        <Button variant="outline" size="sm" className="gap-2 rounded-full pr-3 bg-background shadow-sm hover:bg-accent transition-colors">
          <Avatar className="h-6 w-6 border">
            <AvatarImage src={activeStudent.photo} />
            <AvatarFallback className="text-[10px]">{activeStudent.name[0]}</AvatarFallback>
          </Avatar>
          <span className="font-semibold max-w-[120px] truncate">{activeStudent.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border-accent">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-2 py-1.5">
          Switch student profile
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        {students.map((student) => {
          const isActive = student._id === effectiveActiveId;
          return (
            <DropdownMenuItem
              key={student._id}
              className={`gap-3 cursor-pointer py-3 px-3 rounded-lg transition-all ${
                isActive ? 'bg-primary/5 font-semibold text-primary' : 'hover:bg-muted'
              }`}
              onClick={() => switchStudent(student._id)}
            >
              <Avatar className={`h-10 w-10 border transition-transform ${isActive ? 'scale-110 border-primary/50' : 'border-background shadow-sm'}`}>
                <AvatarImage src={student.photo} />
                <AvatarFallback>{student.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate leading-tight">{student.name}</div>
                <div className="text-[11px] opacity-70 leading-normal">
                  {student.className} – Section {student.section}
                </div>
              </div>
              {isActive && (
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
