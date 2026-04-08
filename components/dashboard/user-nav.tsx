"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n"
import { withLocale } from "@/lib/locale-path"
import { useI18n } from "@/components/i18n-provider"

interface UserNavProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
}

export function UserNav({ user }: UserNavProps) {
  const { t } = useI18n()
  const pathname = usePathname()
  const params = useParams<{ lang?: string }>()
  const lang = hasLocale(params.lang ?? "") ? (params.lang as Locale) : defaultLocale
  const base = `/${lang}`
  const normalizedPathname = pathname?.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname

  const isAttendance = normalizedPathname.startsWith('/attendance')
  const isStaff = !normalizedPathname.startsWith('/admin') && !isAttendance

  const profileLink = isAttendance 
    ? "/attendance/profile" 
    : isStaff 
      ? "/dashboard/profile" 
      : "/admin/profile"


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || ""} alt={user.name || ""} />
            <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={withLocale(lang, profileLink)}>
              {t("common.profile", "Profile")}
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
          {user.role === 'admin' && (
            <DropdownMenuItem asChild>
              <Link href={withLocale(lang, "/admin/school-profile")}>
                {t("nav.schoolProfile", "School Profile")}
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: withLocale(lang, "/login") })}>
          {t("common.logout", "Log out")}
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
