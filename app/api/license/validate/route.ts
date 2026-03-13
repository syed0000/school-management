import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import License from "@/models/License";
import { verifyLicense } from "@/lib/license";
import { SignJWT } from "jose";

const FEEEASE_URL = process.env.NEXT_PUBLIC_FEEEASE_URL;

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const nextUrl = req.nextUrl.searchParams.get("next") || "/dashboard";

    // Find the single license document
    const license = await License.findOne({});

    if (!license) {
      // No license found -> Redirect to Activate
      const response = NextResponse.redirect(new URL("/activate", req.url));
      response.cookies.set("license_status", "missing");
      return response;
    }

    // 1. Verify Signed Token (Cryptographic Check)
    // We do NOT trust license.expiresAt from DB for enforcement.
    // We trust the signed token.
    const payload = await verifyLicense(license.token);
    
    let isExpired = false;
    let expiryTimestamp = 0;

    if (!payload) {
        // Token invalid or signature mismatch -> Corrupt/Tampered
        console.error("Local license token verification failed");
        isExpired = true;
    } else {
        // Token is valid signed by FeeEase. Check expiry claim.
        // payload.exp is in seconds
        expiryTimestamp = payload.exp * 1000;
        
        // Check if expired (Grace period: end of the expiry day?)
        // Usually exp is precise. If generated as "End of Day", then strictly > now.
        // If generated as "Start of Day", we might want to allow "until end of day".
        // But better to fix generation to be End of Day.
        // Here we just respect the token's exp.
        if (expiryTimestamp < Date.now()) {
            isExpired = true;
        }
    }

    // 2. Double check with FeeEase server (Sync)
    // We do this to catch updates (e.g. admin extended validity or revoked license)
    try {
        const verifyRes = await fetch(`${FEEEASE_URL}/api/public/license/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ licenseKey: license.key }),
            cache: "no-store" // Ensure fresh check
        });

        if (verifyRes.ok) {
            const data = await verifyRes.json();
            if (data.success && data.school) {
                const remoteExpiry = new Date(data.school.subscription.expiryDate);
                const remoteStatus = data.school.license.status;

                // Update local license if changed
                if (remoteExpiry.getTime() !== license.expiresAt.getTime() || 
                    remoteStatus !== 'active' || // If revoked/suspended
                    data.school.license.token !== license.token) {
                    
                    license.expiresAt = remoteExpiry;
                    license.token = data.school.license.token;
                    await license.save();
                    
                    // Re-verify the NEW token immediately
                    const newPayload = await verifyLicense(license.token);
                    if (newPayload) {
                        expiryTimestamp = newPayload.exp * 1000;
                        isExpired = expiryTimestamp < Date.now() || remoteStatus !== 'active';
                    } else {
                        isExpired = true;
                    }
                }
            }
        } else if (verifyRes.status === 403 || verifyRes.status === 404) {
             // License invalid on server (e.g. deleted or manually set to inactive)
             isExpired = true;
        }
    } catch (e) {
        console.error("Failed to sync with licensing server:", e);
        // Fallback to local token verification status
    }

    if (isExpired) {
        // Create response with redirect to expired
        const expiredResponse = NextResponse.redirect(new URL("/expired", req.url));
        expiredResponse.cookies.set("license_status", "expired");
        expiredResponse.cookies.set("license_expiry", expiryTimestamp.toString());
        return expiredResponse;
    }

    // Valid License
    const validResponse = NextResponse.redirect(new URL(nextUrl, req.url));
    
    // Create signed cookie
    const secret = new TextEncoder().encode(process.env.LICENSE_COOKIE_SECRET || "fallback_secret_must_change_in_prod");
    const token = await new SignJWT({ 
        status: "active", 
        expiry: expiryTimestamp, 
        verifiedAt: Date.now() 
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h') // Cookie valid for 24h (forces re-check naturally)
    .sign(secret);

    validResponse.cookies.set("license_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });
    
    return validResponse;

  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
