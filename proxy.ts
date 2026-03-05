import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isAuth = !!token;

    // 1. Handle Unauthenticated Users
    if (!isAuth) {
      // If accessing /admin/login, allow it
      if (path === "/admin/login") {
        return NextResponse.next();
      }

      // If trying to access other admin routes, redirect to admin login
      if (path.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }

      // For all other protected routes (dashboard, students, etc.), redirect to staff login
      // Note: /login is not in the matcher, so we don't need to check for it explicitly here
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // 2. Handle Authenticated Users
    
    // Admin routes protection
    if (path.startsWith("/admin")) {
      // If accessing login page while logged in, let the page handle the redirect
      // (The page component checks session and redirects if needed)
      if (path === "/admin/login") {
         return NextResponse.next();
      }
      
      // For other admin routes, check role
      if (token?.role !== "admin") {
        // Allow staff to access expenses
        if (token?.role === "staff" && path.startsWith("/admin/expenses")) {
             return NextResponse.next();
        }

        // Non-admin trying to access admin pages
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Allow access to other protected routes
    return NextResponse.next();
  },
  {
    callbacks: {
      // Always return true to let the middleware function handle all logic
      // including unauthenticated redirection
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/students/:path*",
    "/fees/:path*",
    "/id-cards/:path*",
  ],
};
