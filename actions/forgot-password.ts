"use server"

import dbConnect from "@/lib/db";
import User from "@/models/User";
import Otp from "@/models/Otp";
import License from "@/models/License";
import crypto from "crypto";
import { addMinutes } from "date-fns";
import bcrypt from "bcryptjs";
import { whatsappConfig } from "@/lib/whatsapp-config";

export async function requestForgotPasswordOtp(phone: string) {
  try {
    await dbConnect();

    // 1. Validate phone number format (simple check)
    if (!/^\d{10,12}$/.test(phone)) {
        return { success: false, error: "Invalid phone number format" };
    }

    const user = await User.findOne({ phone: phone });
    if (!user) {
        return { success: false, error: "User with this phone number not found in our records" };
    }

    // 2. Generate 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = addMinutes(new Date(), 10);

    // 3. Save to DB (upsert/new)
    await Otp.findOneAndUpdate(
        { phone, role: user.role },
        { 
            otp: otpCode, 
            refId: user._id, 
            expiresAt, 
            isUsed: false,
            createdAt: new Date()
        },
        { upsert: true }
    );

    // 4. Send via System OTP route (dedicated route from feeease-worker)
    const license = await License.findOne().sort({ createdAt: -1 }).lean();
    const scName = (license as { schoolName?: string })?.schoolName || whatsappConfig.schoolName || 'School';

    const res = await fetch(`${whatsappConfig.worker.url}/api/v1/system/otp`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${whatsappConfig.worker.webhookSecret}`
        },
        body: JSON.stringify({
            phone: phone,
            userName: user.name,
            otp: otpCode,
            role: user.role,
            schoolName: scName,
            source: `${scName} Admin Portal`
        })
    });

    if (res.ok) {
        return { success: true, message: "OTP sent successfully to your WhatsApp" };
    } else {
        const err = await res.json().catch(() => ({}));
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Forgot Password OTP for ${phone} is: ${otpCode}`);
            return { success: true, debug: true, message: "Development: OTP is " + otpCode };
        }
        return { success: false, error: err.detail || "Failed to send WhatsApp OTP. Please try again later." };
    }

  } catch (error) {
    console.error("Forgot Password Request Error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function verifyOtpAndResetPassword(phone: string, otp: string, newPassword: string) {
    try {
        await dbConnect();
        
        const otpDoc = await Otp.findOne({
            phone: phone,
            otp: otp,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpDoc) {
            return { success: false, error: "Invalid or expired OTP" };
        }

        // Mark as used
        otpDoc.isUsed = true;
        await otpDoc.save();

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update User password
        await User.findByIdAndUpdate(otpDoc.refId, { password: hashedPassword });

        return { 
            success: true, 
            message: "Password reset successfully. You can now login with your new password."
        };

    } catch (error) {
        console.error("Password reset failure:", error);
        return { success: false, error: "Password reset failed. Please contact support." };
    }
}
