"use server"

import dbConnect from "@/lib/db";
import Notification from "@/models/Notification";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard";
import { Types } from "mongoose";

export interface CreateNotificationPayload {
  title: string;
  body: string;
  targetClassIds?: string[];
  targetStudentIds?: string[];
  targetTeacherIds?: string[];
  targetAllTeachers?: boolean;
}

export async function sendAppNotification(payload: CreateNotificationPayload) {
  try {
    const session = await getServerSession(authOptions);
    if (isDemoSession(session)) return demoWriteSuccess();
    await dbConnect();

    // 1. Fetch push tokens
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

    // Add specific student tokens
    if (payload.targetStudentIds?.length) {
       const students = await Student.find({ 
         _id: { $in: payload.targetStudentIds },
         isActive: true,
         "notificationSettings.pushEnabled": true
       }).select('pushTokens').lean();
       students.forEach(s => {
         if (s.pushTokens) tokens = tokens.concat(s.pushTokens);
       });
    }

    // 3. Trigger External Push (using the worker)
    const { whatsappConfig } = await import("@/lib/whatsapp-config");
    const { default: License } = await import("@/models/License");
    const license = await License.findOne().sort({ createdAt: -1 }).lean();
    
    if (!license || !license.schoolId || !license.key) {
      return { success: false, error: "Worker configuration missing (Could not find License in DB)" };
    }
    if (tokens.length === 0) {
      return { success: false, error: "No recipients have push notifications enabled." };
    }

    const uniqueTokens = [...new Set(tokens)];
    const pushTargets = [{
      studentId: "broadcast",
      tokens: uniqueTokens
    }];

    const workerRes = await fetch(`${whatsappConfig.worker.url}/api/v1/app-notification`, {
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

    if (!workerRes.ok) {
      return { success: false, error: "Failed to dispatch notification." };
    }

    // 2. Save to Persistent DB only after successful dispatch
    const newNotification = new Notification({
      title: payload.title,
      body: payload.body,
      type: payload.targetClassIds?.length ? 'class' : (payload.targetStudentIds?.length ? 'individual' : (payload.targetTeacherIds?.length || payload.targetAllTeachers ? 'teacher' : 'broadcast')),
      targetClasses: payload.targetClassIds,
      targetTeachers: payload.targetTeacherIds,
      targetStudents: payload.targetStudentIds,
    });
    await newNotification.save();

    revalidatePath("/whatsapp");

    return { success: true, message: "Notification sent and saved." };
  } catch (error) {
    console.error("Error sending app notification:", error);
    return { success: false, error: "Failed to send notification" };
  }
}

type NotificationHistoryItem = {
  _id: { toString: () => string }
  title: string
  body: string
  type: string
  targetClasses?: Array<{ toString: () => string }>
  targetTeachers?: Array<{ toString: () => string }>
  targetStudents?: Array<{ toString: () => string }>
  sentAt?: Date
}

export async function getNotificationHistoryPage(cursor?: string, limit = 20) {
  try {
    await dbConnect();
    const q: Record<string, unknown> = {}
    if (cursor && Types.ObjectId.isValid(cursor)) {
      q._id = { $lt: new Types.ObjectId(cursor) }
    }

    const rows = await Notification.find(q)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean() as NotificationHistoryItem[]

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? items[items.length - 1]?._id?.toString() : null

    return { items, nextCursor }
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return { items: [], nextCursor: null }
  }
}

export async function deleteNotification(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (isDemoSession(session)) return demoWriteSuccess();
    await dbConnect();
    await Notification.findByIdAndDelete(id);
    revalidatePath("/whatsapp");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete notification" };
  }
}

type FeedItem = {
  _id: { toString: () => string }
  title: string
  body: string
  sentAt?: Date
  type: string
}

export async function getTeacherNotificationFeed(cursor?: string, limit = 20) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== "teacher" && session.user.role !== "admin")) {
    return { items: [], nextCursor: null }
  }

  await dbConnect()
  const teacherId = session.user.id

  const baseQuery: Record<string, unknown> = {
    $or: [
      { type: "broadcast" },
      { type: "teacher", $or: [{ targetTeachers: teacherId }, { targetTeachers: { $exists: false } }, { targetTeachers: { $size: 0 } }] },
    ],
  }

  if (cursor && Types.ObjectId.isValid(cursor)) {
    baseQuery._id = { $lt: new Types.ObjectId(cursor) }
  }

  const rows = await Notification.find(baseQuery)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean() as FeedItem[]

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1]?._id?.toString() : null
  return { items, nextCursor }
}

export async function getParentNotificationFeed(studentId: string, cursor?: string, limit = 20) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== "parent" && session.user.role !== "admin")) {
    return { items: [], nextCursor: null }
  }

  await dbConnect()

  if (!Types.ObjectId.isValid(studentId)) return { items: [], nextCursor: null }

  if (session.user.role === "parent") {
    const sessionStudent = await Student.findById(session.user.id).select("contacts.mobile").lean() as { contacts?: { mobile?: string[] } } | null
    const phone = sessionStudent?.contacts?.mobile?.[0] ?? ""
    if (!phone) return { items: [], nextCursor: null }
    const hasAccess = await Student.exists({ _id: studentId, "contacts.mobile": phone, isActive: true })
    if (!hasAccess) return { items: [], nextCursor: null }
  }

  const student = await Student.findById(studentId).select("classId").lean() as { classId?: Types.ObjectId } | null
  const classId = student?.classId?.toString()

  const baseOr: Record<string, unknown>[] = [
    { type: "broadcast" },
    { type: "individual", targetStudents: studentId },
  ]
  if (classId) {
    baseOr.push({ type: "class", targetClasses: classId })
  }

  const q: Record<string, unknown> = { $or: baseOr }
  if (cursor && Types.ObjectId.isValid(cursor)) {
    q._id = { $lt: new Types.ObjectId(cursor) }
  }

  const rows = await Notification.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean() as FeedItem[]

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1]?._id?.toString() : null
  return { items, nextCursor }
}

export async function updatePushToken(userId: string, role: 'teacher' | 'parent', token: string, enable: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (isDemoSession(session)) return demoWriteSuccess();
    await dbConnect();
    const Model = (role === 'teacher' ? Teacher : Student) as unknown as { findByIdAndUpdate: (id: string, update: Record<string, unknown>, options: Record<string, unknown>) => Promise<void> };
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
  } catch {
    return { success: false, error: "Failed to update token" };
  }
}

export async function togglePushSetting(userId: string, role: 'teacher' | 'parent', enabled: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (isDemoSession(session)) return demoWriteSuccess();
    await dbConnect();
    const Model = (role === 'teacher' ? Teacher : Student) as unknown as { findByIdAndUpdate: (id: string, update: Record<string, unknown>, options: Record<string, unknown>) => Promise<void> };
    await Model.findByIdAndUpdate(userId, {
      $set: { "notificationSettings.pushEnabled": enabled }
    }, {});



    return { success: true };
  } catch {
    return { success: false, error: "Failed to toggle setting" };
  }
}
