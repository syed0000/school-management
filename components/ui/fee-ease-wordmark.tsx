import Image from "next/image"
import Link from "next/link"

type FeeEaseWordmarkProps = {
  href?: string
  className?: string
}

export function FeeEaseWordmark({ href, className }: FeeEaseWordmarkProps) {
  const content = (
    <div className={className}>
      <div className="relative h-9 w-28 md:h-10 md:w-36">
        <Image
          src="/images/assets/logo-horizontal.png"
          alt="FeeEase"
          fill
          sizes="(min-width: 768px) 144px, 112px"
          className="object-contain"
          priority
        />
      </div>
    </div>
  )

  if (!href) return content

  return (
    <Link href={href} className="transition-opacity hover:opacity-90">
      {content}
    </Link>
  )
}
