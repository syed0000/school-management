"use server"

import dbConnect from "@/lib/db";
import Notification from "@/models/Notification";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";

export interface CreateNotificationPayload {
  title: string;
  body: string;
  targetClassIds?: string[];
  targetTeacherIds?: string[];
  targetAllTeachers?: boolean;
}

export async function sendAppNotification(payload: CreateNotificationPayload) {
  try {
    await dbConnect();

    // 1. Save to Persistent DB
    const newNotification = new Notification({
      title: payload.title,
      body: payload.body,
      type: payload.targetClassIds?.length ? 'class' : (payload.targetTeacherIds?.length || payload.targetAllTeachers ? 'teacher' : 'broadcast'),
      targetClasses: payload.targetClassIds,
      targetTeachers: payload.targetTeacherIds,
    });
    await newNotification.save();

    // 2. Fetch push tokens
    let tokens: string[] = [];

    // Add student/parent tokens based on class
    if (payload.targetClassIds?.length) {
       const students = await Student.find({ 
         classId: { $in: payload.targetClassIds },
         isActive: true,
         "notificationSettings.pushEnabled": true
       }).select('pushTokens').lean();
       students.forEach(s => {
         if (s.pushTokens) tokens = tokens.concat(s.pushTokens);
       });
    }

    // Add teacher tokens
    if (payload.targetAllTeachers) {
       const teachers = await Teacher.find({
         "notificationSettings.pushEnabled": true
       }).select('pushTokens').lean();
       teachers.forEach(t => {
         if (t.pushTokens) tokens = tokens.concat(t.pushTokens);
       });
    } else if (payload.targetTeacherIds?.length) {
       const teachers = await Teacher.find({
         _id: { $in: payload.targetTeacherIds },
         "notificationSettings.pushEnabled": true
       }).select('pushTokens').lean();
       teachers.forEach(t => {
         if (t.pushTokens) tokens = tokens.concat(t.pushTokens);
       });
    }

    // 3. Trigger External Push (using the worker)
    const { whatsappConfig } = await import("@/lib/whatsapp-config");
    const { default: License } = await import("@/models/License");
    const license = await License.findOne().sort({ createdAt: -1 }).lean();
    
    if (license && license.schoolId && license.key && tokens.length > 0) {
      const uniqueTokens = [...new Set(tokens)];
      // Group by single target for efficiency or by individual. Let's just do a broad reach if broad.
      // But the worker expects objects with studentId or teacherId.
      const pushTargets = [{ 
        studentId: "broadcast", 
        tokens: uniqueTokens 
      }];

      try {
        await fetch(`${whatsappConfig.worker.url}/api/v1/app-notification`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-license-key': license.key
          },
          body: JSON.stringify({
            schoolId: license.schoolId,
            licenseKey: license.key,
            title: payload.title,
            body: payload.body,
            pushTargets
          }),
        });
      } catch (e) {
        console.error("Worker push error:", e);
      }
    }

    revalidatePath("/whatsapp");

    return { success: true, message: "Notification sent and saved." };
  } catch (error) {
    console.error("Error sending app notification:", error);
    return { success: false, error: "Failed to send notification" };
  }
}

export async function getNotificationHistory() {
  try {
    await dbConnect();
    return await Notification.find({})
      .sort({ sentAt: -1 })
      .populate('targetClasses', 'name')
      .populate('targetTeachers', 'name')
      .lean();
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return [];
  }
}

export async function deleteNotification(id: string) {
  try {
    await dbConnect();
    await Notification.findByIdAndDelete(id);
    revalidatePath("/whatsapp");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete notification" };
  }
}

export async function updatePushToken(userId: string, role: 'teacher' | 'parent', token: string, enable: boolean) {
  try {
    await dbConnect();
    const Model = (role === 'teacher' ? Teacher : Student) as any;
    if (enable) {
      await Model.findByIdAndUpdate(userId, {
        $addToSet: { pushTokens: token },
        $set: { "notificationSettings.pushEnabled": true }
      }, {});
    } else {
      await Model.findByIdAndUpdate(userId, {
        $pull: { pushTokens: token }
      }, {});
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update token" };
  }
}

export async function togglePushSetting(userId: string, role: 'teacher' | 'parent', enabled: boolean) {
  try {
    await dbConnect();
    const Model = (role === 'teacher' ? Teacher : Student) as any;
    await Model.findByIdAndUpdate(userId, {
      $set: { "notificationSettings.pushEnabled": enabled }
    }, {});



    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to toggle setting" };
  }
}

