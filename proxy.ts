import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getToken } from "next-auth/jwt";

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

  // Skip public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check License
  const licenseCheck = await checkLicense(req);

  if (licenseCheck.valid) {
    // RBAC Check (After License Check)
    let token = null;
    try {
      token = await getToken({ 
        req: req as any, 
        secret: process.env.NEXTAUTH_SECRET 
      });
    } catch (e) {
      // If decryption fails (e.g. secret changed), treat as no token
      token = null;
    }

    // Handle root path and login pages redirect
    if (pathname === "/" || pathname === "/login" || pathname === "/admin/login" || pathname === "/login/otp") {
      if (!token) {
        if (pathname === "/") {
          return NextResponse.redirect(new URL("/login", req.url));
        }
        return NextResponse.next();
      }
      
      const role = token.role;
      if (role === "admin") return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      if (role === "attendance_staff") return NextResponse.redirect(new URL("/attendance/dashboard", req.url));
      if (role === "teacher") return NextResponse.redirect(new URL("/teacher/dashboard", req.url));
      if (role === "parent") return NextResponse.redirect(new URL("/parent/dashboard", req.url));
      
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // 1. Admin & Staff Routes
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
      if (!token || (token.role !== "admin" && token.role !== "staff")) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    // 2. Attendance Staff Routes
    if (pathname.startsWith("/attendance")) {
      if (!token || (token.role !== "attendance_staff" && token.role !== "admin")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // 3. General Staff/Admin Dashboard & Management
    if (pathname.startsWith("/dashboard") || 
        pathname.startsWith("/students") || 
        pathname.startsWith("/teachers") || 
        pathname.startsWith("/fees") || 
        pathname.startsWith("/whatsapp") || 
        pathname.startsWith("/id-cards")
    ) {
      if (!token || (token.role !== "staff" && token.role !== "admin")) {
         if (token?.role === 'parent') return NextResponse.redirect(new URL("/parent/dashboard", req.url));
         if (token?.role === 'teacher') return NextResponse.redirect(new URL("/teacher/dashboard", req.url));
         return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // 4. Parent Portal Routes
    if (pathname.startsWith("/parent")) {
      if (!token || (token.role !== "parent" && token.role !== "admin")) {
        return NextResponse.redirect(new URL("/login/otp", req.url));
      }
    }

    // 5. Teacher Portal Routes
    if (pathname.startsWith("/teacher") && !pathname.startsWith("/teachers")) {
      if (!token || (token.role !== "teacher" && token.role !== "admin")) {
        return NextResponse.redirect(new URL("/login/otp", req.url));
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
  return NextResponse.redirect(new URL("/activate", req.url));
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
