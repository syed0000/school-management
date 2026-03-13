import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import License from "@/models/License";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { verifyLicense } from "@/lib/license";

const FEEEASE_URL = process.env.NEXT_PUBLIC_FEEEASE_URL;

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { licenseKey } = await req.json();

    if (!licenseKey) {
      return NextResponse.json({ error: "License key is required" }, { status: 400 });
    }

    // 1. Call FeeEase Server to get school data and admin password
    const response = await fetch(`${FEEEASE_URL}/api/public/license/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json({ error: data.error || "Activation failed on server" }, { status: 400 });
    }

    const { school, adminPassword } = data;

    // Verify token to extract expiry date securely
    const token = school.license.token;
    const payload = await verifyLicense(token);
    
    if (!payload) {
        return NextResponse.json({ error: "Received invalid license token from server" }, { status: 400 });
    }

    const expiryDate = new Date(payload.exp * 1000);

    // 2. Save License locally
    // Remove existing license if any (re-activation)
    await License.deleteMany({});
    
    await License.create({
      key: licenseKey, // Store immutable key
      token: token, // Store signed token
      schoolId: school._id,
      plan: school.subscription.plan,
      expiresAt: expiryDate, // Extracted from verified token
      lastVerifiedAt: new Date(),
    });

    // 3. Seed Admin User
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (!existingAdmin) {
      if (!adminPassword) {
         return NextResponse.json({ error: "Admin password not received from server" }, { status: 500 });
      }

      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      console.log("Seeding admin user with username:", school.adminEmail || `admin_${school._id}`);

      await User.create({
        username: school.adminEmail,
        email: school.adminEmail,
        password: hashedPassword,
        name: school.adminName,
        role: 'admin',
        isActive: true,
      });
      
      console.log("Admin user seeded successfully");
    } else {
        console.log("Admin user already exists, skipping seed.");
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error("Activation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
