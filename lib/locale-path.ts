export function withLocale(locale: string, href: string) {
  if (!href.startsWith("/")) return href
  if (href === "/") return `/${locale}`
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) return href
  return `/${locale}${href}`
}
