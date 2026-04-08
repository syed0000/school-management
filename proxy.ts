import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n";

// Define public paths that don't require license check
const PUBLIC_PATHS = [
  "/activate",
  "/expired",
  "/api/license", // Allow license API calls
  "/api/auth", // Allow auth API calls
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/site.webmanifest",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/robots.txt",
  "/sitemap.xml",
  "/feeEasyLogo.png",
  "/dark-logo.jpeg",
  "/logo.jpeg",
  "/NotoSans-Regular.ttf",
  "/static",
  "/images",
  "/public",
  "/api/whatsapp",
  "/api/public-receipt"
];

const LICENSE_COOKIE_SECRET = new TextEncoder().encode(process.env.LICENSE_COOKIE_SECRET);

function getPreferredLocale(req: NextRequest): Locale {
  const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value ?? req.cookies.get("lang")?.value;
  if (cookieLocale && hasLocale(cookieLocale)) return cookieLocale;

  const accept = req.headers.get("accept-language") ?? "";
  const parts = accept
    .split(",")
    .map((p) => p.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  for (const p of parts) {
    const base = p.split("-")[0]!;
    if (hasLocale(base)) return base;
  }

  return defaultLocale;
}

function withLocale(locale: Locale, href: string) {
  if (!href.startsWith("/")) return href;
  if (href === "/") return `/${locale}`;
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) return href;
  return `/${locale}${href}`;
}

// Helper to verify signed cookie
async function verifySignedCookie(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, LICENSE_COOKIE_SECRET);
    return payload as { status: string; expiry: number; verifiedAt: number };
  } catch {
    return null; // Invalid signature
  }
}

// Helper to check if license is valid
async function checkLicense(req: NextRequest) {
  // Check signed cookie cache first
  const signedCookie = req.cookies.get("license_session")?.value;
  const payload = await verifySignedCookie(signedCookie);

  if (payload && payload.status === 'active') {
    const expiryDate = new Date(payload.expiry);

    // Check if cookie is expired (time-based)
    if (expiryDate <= new Date()) {
      return { valid: false, needsValidation: true };
    }

    // Check if verification is stale (Force re-check every 24 hours)
    // 24 hours balances security with server load.
    if (!payload.verifiedAt || (Date.now() - payload.verifiedAt > 24 * 60 * 60 * 1000)) {
      return { valid: false, needsValidation: true };
    }

    return { valid: true };
  }

  return { valid: false, needsValidation: true };
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/");
  const first = segments[1];

  if (!first || !hasLocale(first)) {
    const locale = getPreferredLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  const locale: Locale = first;
  const normalizedPathname = pathname.slice(`/${locale}`.length) || "/";

  // Skip public paths
  if (PUBLIC_PATHS.some(path => normalizedPathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check License
  const licenseCheck = await checkLicense(req);

  if (licenseCheck.valid) {
    // RBAC Check (After License Check)
    let token: JWT | null = null;
    try {
      token = await getToken({
        req: req as unknown as Parameters<typeof getToken>[0]["req"],
        secret: process.env.NEXTAUTH_SECRET
      });
    } catch {
      // If decryption fails (e.g. secret changed), treat as no token
      token = null;
    }

    // Handle root path and login pages redirect
    if (normalizedPathname === "/" || normalizedPathname === "/login" || normalizedPathname === "/admin/login" || normalizedPathname === "/login/otp") {
      if (!token) {
        if (normalizedPathname === "/") {
          return NextResponse.redirect(new URL(withLocale(locale, "/login"), req.url));
        }
        return NextResponse.next();
      }

      const isDemo = token?.isDemo === true;
      if (isDemo) {
        return NextResponse.redirect(new URL(withLocale(locale, "/demo/access-as"), req.url));
      }

      const role = token.role;
      if (role === "admin") return NextResponse.redirect(new URL(withLocale(locale, "/admin/dashboard"), req.url));
      if (role === "attendance_staff") return NextResponse.redirect(new URL(withLocale(locale, "/attendance/dashboard"), req.url));
      if (role === "teacher") return NextResponse.redirect(new URL(withLocale(locale, "/teacher/dashboard"), req.url));
      if (role === "parent") return NextResponse.redirect(new URL(withLocale(locale, "/parent/dashboard"), req.url));

      return NextResponse.redirect(new URL(withLocale(locale, "/dashboard"), req.url));
    }

    // 1. Admin & Staff Routes
    if (normalizedPathname.startsWith("/admin") && !normalizedPathname.startsWith("/admin/login")) {
      const isDemo = token?.isDemo === true;
      const effectiveRole = token?.impersonation?.role || token?.role;
      if (isDemo) {
        return NextResponse.next();
      }
      if (!token || (effectiveRole !== "admin" && effectiveRole !== "staff")) {
        return NextResponse.redirect(new URL(withLocale(locale, "/admin/login"), req.url));
      }
    }

    // 2. Attendance Staff Routes
    if (normalizedPathname.startsWith("/attendance")) {
      const isDemo = token?.isDemo === true;
      const effectiveRole = token?.impersonation?.role || token?.role;
      if (isDemo) {
        return NextResponse.next();
      }
      if (!token || (effectiveRole !== "attendance_staff" && effectiveRole !== "admin")) {
        return NextResponse.redirect(new URL(withLocale(locale, "/dashboard"), req.url));
      }
    }

    // 3. General Staff/Admin Dashboard & Management
    if (normalizedPathname.startsWith("/dashboard") ||
      normalizedPathname.startsWith("/students") ||
      normalizedPathname.startsWith("/teachers") ||
      normalizedPathname.startsWith("/fees") ||
      normalizedPathname.startsWith("/whatsapp") ||
      normalizedPathname.startsWith("/id-cards")
    ) {
      const isDemo = token?.isDemo === true;
      const effectiveRole = token?.impersonation?.role || token?.role;
      if (isDemo) {
        return NextResponse.next();
      }
      if (!token || (effectiveRole !== "staff" && effectiveRole !== "admin")) {
        if (effectiveRole === 'parent') return NextResponse.redirect(new URL(withLocale(locale, "/parent/dashboard"), req.url));
        if (effectiveRole === 'teacher') return NextResponse.redirect(new URL(withLocale(locale, "/teacher/dashboard"), req.url));
        return NextResponse.redirect(new URL(withLocale(locale, "/login"), req.url));
      }
    }

    // 4. Parent Portal Routes
    if (normalizedPathname.startsWith("/parent")) {
      const isDemo = token?.isDemo === true;
      const effectiveRole = token?.impersonation?.role || token?.role;
      if (isDemo) {
        return NextResponse.next();
      }
      if (!token || (effectiveRole !== "parent" && effectiveRole !== "admin")) {
        return NextResponse.redirect(new URL(withLocale(locale, "/login/otp"), req.url));
      }
    }

    // 5. Teacher Portal Routes
    if (normalizedPathname.startsWith("/teacher") && !normalizedPathname.startsWith("/teachers")) {
      const isDemo = token?.isDemo === true;
      const effectiveRole = token?.impersonation?.role || token?.role;
      if (isDemo) {
        return NextResponse.next();
      }
      if (!token || (effectiveRole !== "teacher" && effectiveRole !== "admin")) {
        return NextResponse.redirect(new URL(withLocale(locale, "/login/otp"), req.url));
      }
    }

    return NextResponse.next();
  }

  if (licenseCheck.needsValidation) {
    // Redirect to validation endpoint
    const url = new URL("/api/license/validate", req.url);
    url.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // If validation failed or no license, redirect to activate
  // We can check if we have an explicit "expired" status in the signed cookie too, but simpler to just redirect to validate/activate
  return NextResponse.redirect(new URL(withLocale(locale, "/activate"), req.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
