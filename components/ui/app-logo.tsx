import Image from "next/image";
import { X } from "lucide-react";
import { schoolConfig } from "@/lib/config";
import Link from "next/link";

interface AppLogoProps {
  href?: string;
}

export function AppLogo({ href }: AppLogoProps) {
  const content = (
    <div className="flex items-center gap-2 sm:gap-3 transition-opacity hover:opacity-90">
      <div className="relative h-8 w-24 md:h-10 md:w-32 flex items-center justify-center rounded-md overflow-hidden bg-background">
        <Image
          src="/images/assets/logo-horizontal.png"
          alt="FeeEase"
          width={100}
          height={100}
          className="object-contain p-1"
          priority
        />
      </div>
      <X className="h-4 w-4 md:h-5 md:w-5 text-foreground hidden sm:block" strokeWidth={3} />
      <div className="font-bold text-base md:text-lg tracking-tight hidden sm:block text-foreground truncate max-w-[150px] md:max-w-xs">
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
