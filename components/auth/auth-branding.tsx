import { schoolConfig } from "@/lib/config"
import Image from "next/image"

export function AuthBranding({
  subtitle,
}: {
  subtitle?: string
}) {
  const name = schoolConfig.name || schoolConfig.shortName || "School"

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-20 w-20">
        <Image
          src="/logo.jpeg"
          alt={name}
          fill
          sizes="80px"
          className="object-contain rounded-full"
        />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        {name}
      </div>
      {subtitle ? (
        <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  )
}
