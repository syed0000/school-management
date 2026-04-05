import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import License from "@/models/License";
import { verifyLicense } from "@/lib/license";

const FEEEASE_URL = process.env.NEXT_PUBLIC_FEEEASE_URL;

export async function POST(req: NextRequest) {
  try {
    void req; 
    await dbConnect();
    
    const license = await License.findOne({});
    if (!license) {
      return NextResponse.json({ success: false, error: "No license found to refresh" }, { status: 404 });
    }

    if (!license.schoolId) {
         return NextResponse.json({ success: false, error: "Local license record missing Institute ID" });
    }

    const response = await fetch(`${FEEEASE_URL}/api/license/latest/${license.schoolId}`, {
        method: 'GET',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
         return NextResponse.json({ success: false, error: data.error || "Failed to fetch latest license" });
    }

    const newLicenseKey = data.license.key || data.license.licenseKey; 
    const newToken = data.license.token;

    // Verify the new token to extract expiry securely
    const payload = await verifyLicense(newToken);
    if (!payload) {
        return NextResponse.json({ success: false, error: "Received invalid license token from server" });
    }

    const newExpiry = new Date(payload.exp * 1000);

    // Update local DB
    license.key = newLicenseKey;
    license.token = newToken; // Update the token!
    license.expiresAt = newExpiry; // Extracted from verified token
    license.lastVerifiedAt = new Date();
    await license.save();

    // Update Cookies
    const res = NextResponse.json({ success: true });
    res.cookies.set("license_status", "active");
    res.cookies.set("license_expiry", newExpiry.getTime().toString());

    return res;

  } catch (error: unknown) {
    console.error("Refresh error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
