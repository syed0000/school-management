"use server"

import dbConnect from "@/lib/db"
import User from "@/models/User"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { demoConfig } from "@/lib/demo-config"
import { randomUUID } from "crypto"

const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(12, "Invalid phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['staff', 'attendance_staff']).default('staff'),
})

import logger from "@/lib/logger"
import { demoWriteSuccess, isDemoSession } from "@/lib/demo-guard"

export async function createStaff(data: z.infer<typeof createStaffSchema>) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== 'admin') throw new Error('Unauthorized');
    if (isDemoSession(session)) return demoWriteSuccess();

    // Validate input
    createStaffSchema.parse(data);
    
    await dbConnect();
    
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      return { success: false, error: "Email already exists" };
    }
    
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone, // Added phone
      password: hashedPassword,
      role: data.role,
      isActive: true,
      requiresPasswordChange: false 
    });
    
    return { success: true };
  } catch (error: unknown) {
    logger.error(error, "Failed to create staff");
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

const createDemoUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
})

export async function createDemoUser(data: z.infer<typeof createDemoUserSchema>) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== 'admin') throw new Error('Unauthorized');
    if (isDemoSession(session)) return demoWriteSuccess();
    if (!demoConfig.adminInstitute) throw new Error('Demo is not enabled');

    createDemoUserSchema.parse(data);
    await dbConnect();

    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      return { success: false, error: "Email already exists" };
    }

    const hashedPassword = await bcrypt.hash(randomUUID(), 10);

    await User.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: 'admin',
      isDemo: true,
      isActive: true,
      requiresPasswordChange: false,
    });

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error: unknown) {
    logger.error(error, "Failed to create demo user");
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function getDemoUsers() {
  if (!demoConfig.adminInstitute) return [];
  await dbConnect();
  const users = await User.find({ isDemo: true }).sort({ createdAt: -1 }).lean();
  return users.map((u: Record<string, unknown>) => ({
    id: String(u._id),
    name: String(u.name),
    email: String(u.email),
    isActive: Boolean(u.isActive),
    createdAt: u.createdAt as Date,
  }));
}

export async function toggleDemoUserStatus(id: string, isActive: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== 'admin') throw new Error('Unauthorized');
    if (isDemoSession(session)) return demoWriteSuccess();
    if (!demoConfig.adminInstitute) throw new Error('Demo is not enabled');

    await dbConnect();
    await User.findByIdAndUpdate(id, { isActive });
    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error: unknown) {
    logger.error(error, `Failed to toggle demo user status for ${id}`);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

interface StaffUser {
  _id: { toString: () => string };
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export async function getStaffList() {
  await dbConnect();
  const staff = await User.find({ role: { $in: ['staff', 'attendance_staff'] } }).sort({ createdAt: -1 }).lean();
  return staff.map((u: unknown) => {
    const user = u as StaffUser;
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || "", // Added phone
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };
  });
}

export async function toggleStaffStatus(id: string, isActive: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== 'admin') throw new Error('Unauthorized');
    if (isDemoSession(session)) return demoWriteSuccess();

    await dbConnect();
    await User.findByIdAndUpdate(id, { isActive });
    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error: unknown) {
    logger.error(error, `Failed to toggle staff status for ${id}`);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function deleteStaff(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== 'admin') throw new Error('Unauthorized');
    if (isDemoSession(session)) return demoWriteSuccess();

    await dbConnect();
    await User.findByIdAndDelete(id);
    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error: unknown) {
    logger.error(error, `Failed to delete staff ${id}`);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function updateStaffPassword(id: string, newPassword: string) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== 'admin') throw new Error('Unauthorized');
    if (isDemoSession(session)) return demoWriteSuccess();

    if (!newPassword || newPassword.length < 6) {
        return { success: false, error: "Password must be at least 6 characters" };
    }

    await dbConnect();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(id, { password: hashedPassword });
    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error: unknown) {
    logger.error(error, `Failed to update password for ${id}`);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}
