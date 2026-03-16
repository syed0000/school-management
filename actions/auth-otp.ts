"use server"

import dbConnect from "@/lib/db";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import Otp from "@/models/Otp";
import License from "@/models/License";
import WhatsAppStat from "@/models/WhatsAppStat";
import WhatsAppPricing from "@/models/WhatsAppPricing";
import { whatsappConfig } from "@/lib/whatsapp-config";
import crypto from "crypto";
import { addMinutes } from "date-fns";

export async function requestOtp(phone: string, role: 'teacher' | 'parent') {
  try {
    await dbConnect();

    // 1. Validate phone number format (simple check)
    if (!/^\d{10,12}$/.test(phone)) {
        return { success: false, error: "Invalid phone number format" };
    }

    let userEntity = null;
    let userName = "";
    let refId = null;

    if (role === 'teacher') {
        userEntity = await Teacher.findOne({ phone: phone });
        if (!userEntity) return { success: false, error: "Teacher with this phone number not found" };
        userName = userEntity.name;
        refId = userEntity._id;
    } else {
        // Parent: Find student by contact mobile
        userEntity = await Student.findOne({ "contacts.mobile": phone });
        if (!userEntity) return { success: false, error: "Parent with this phone number not registered" };
        userName = userEntity.parents?.father?.name || userEntity.parents?.mother?.name || userEntity.name;
        refId = userEntity._id;
    }

    // 2. Generate 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = addMinutes(new Date(), 5);

    // 3. Save to DB (upsert/new)
    await Otp.findOneAndUpdate(
        { phone, role },
        { 
            otp: otpCode, 
            refId, 
            expiresAt, 
            isUsed: false,
            createdAt: new Date()
        },
        { upsert: true }
    );

    // 4. Send via Worker
    if (whatsappConfig.enabled) {
        const license = await License.findOne().sort({ createdAt: -1 }).lean();
        if (!license) return { success: false, error: "System configuration error (No license found)" };

        // 5. Build Stat Payload
        const cost = await WhatsAppPricing.getCurrentPrice();
        const stat = new WhatsAppStat({
            type: 'otp',
            description: `OTP Login for ${userName} (${role})`,
            recipientCount: 1,
            cost,
            status: 'failed',
        });
        await stat.save();

        const res = await fetch(`${whatsappConfig.worker.url}/api/v1/whatsapp/otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schoolId: license.schoolId,
                licenseKey: license.key,
                campaignName: whatsappConfig.templates.otp,
                phone: phone,
                userName: userName,
                otp: otpCode,
                validity: "5 minutes",
                source: "FeeEase Auth"
            })
        });

        if (res.ok) {
            await WhatsAppStat.findByIdAndUpdate(stat._id, { status: 'success' });
        } else {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.detail || "Failed to send WhatsApp OTP" };
        }
    } else {
        // For development/testing without WA enabled
        console.log(`[DEBUG] OTP for ${phone} is: ${otpCode}`);
        return { success: true, debug: true, message: "Development mode: OTP displayed in console" };
    }

    return { success: true, message: "OTP sent successfully to WhatsApp" };

  } catch (error) {
    console.error("Request OTP error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function verifyOtp(phone: string, otp: string, role: 'teacher' | 'parent') {
    try {
        await dbConnect();
        
        const otpDoc = await Otp.findOne({
            phone,
            otp,
            role,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpDoc) {
            return { success: false, error: "Invalid or expired OTP" };
        }

        // Mark as used
        otpDoc.isUsed = true;
        await otpDoc.save();

        // At this point we know the phone is verified.
        // We return the payload that can be used for session creation
        return { 
            success: true, 
            refId: otpDoc.refId, 
            role: role,
            phone: phone
        };

    } catch (error) {
        console.error("Verify OTP error:", error);
        return { success: false, error: "Verification failed" };
    }
}
