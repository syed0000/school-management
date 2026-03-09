"use server"

import dbConnect from "@/lib/db"
import User from "@/models/User"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters").optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Current password is required to set a new password",
  path: ["currentPassword"],
});

export async function updateProfile(data: z.infer<typeof updateProfileSchema>) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const result = updateProfileSchema.safeParse(data);
    if (!result.success) {
      return { success: false, error: result.error.issues[0].message };
    }

    await dbConnect();
    const user = await User.findById(session.user.id);
    
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Update basic info if provided
    if (data.name) {
      user.name = data.name;
    }
    
    // Check email uniqueness if changed and provided
    if (data.email && data.email !== user.email) {
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        return { success: false, error: "Email already in use" };
      }
      user.email = data.email;
    }

    // Update password if provided
    if (data.newPassword && data.currentPassword) {
      const isMatch = await bcrypt.compare(data.currentPassword, user.password);
      if (!isMatch) {
        return { success: false, error: "Incorrect current password" };
      }
      
      const hashedPassword = await bcrypt.hash(data.newPassword, 10);
      user.password = hashedPassword;
    }

    await user.save();
    
    revalidatePath("/admin/profile");
    revalidatePath("/dashboard/profile");
    revalidatePath("/attendance/profile");
    
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, error: message };
  }
}

export async function getUserProfile(userId: string) {
  await dbConnect();
  const user = await User.findById(userId).lean();
  if (!user) return null;
  
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    id: user._id.toString()
  };
}
