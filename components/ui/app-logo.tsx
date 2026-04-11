import Image from "next/image";
import { schoolConfig } from "@/lib/config";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  href?: string;
  className?: string;
}

export function AppLogo({ href, className }: AppLogoProps) {
  const content = (
    <div className={cn("hidden md:flex items-center gap-3 transition-opacity hover:opacity-90", className)}>
      <div className="relative h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full overflow-hidden bg-background">
        <Image
          src="/android-chrome-512x512.png"
          alt={schoolConfig.name || "Institute"}
          width={64}
          height={64}
          className="object-contain"
          priority
        />
      </div>
      <div className="font-bold text-base md:text-lg tracking-tight text-foreground truncate max-w-[220px] md:max-w-md">
        {schoolConfig.name || "Institute Name"}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        {content}
      </Link>
    );
  }

  return content;
}
