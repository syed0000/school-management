import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose"; // We'll use this for signed cookies

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
  "/static",
  "/images",
  "/public"
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
     * - api (API routes) -> We handle specific API routes in PUBLIC_PATHS, others should be protected?
     *   Actually, let's protect everything and allowlist specific APIs.
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
