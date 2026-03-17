import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import Otp from "@/models/Otp";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET, // Ensure secret is explicitly passed
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        phone: { label: "Phone", type: "text" },
        otp: { label: "OTP", type: "text" },
        role: { label: "Role", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials) return null;
        await dbConnect();
        
        // Handle OTP-based login (Teacher/Parent)
        if (credentials.phone && credentials.otp && credentials.role) {
            const role = credentials.role as 'teacher' | 'parent';
            
            const otpDoc = await Otp.findOne({
                phone: credentials.phone,
                otp: credentials.otp,
                role: role,
                isUsed: false,
                expiresAt: { $gt: new Date() }
            });

            if (!otpDoc) {
                throw new Error("Invalid or expired OTP");
            }

            // Mark OTP as used
            otpDoc.isUsed = true;
            await otpDoc.save();

            let entity;
            if (role === 'teacher') {
                entity = await Teacher.findById(otpDoc.refId);
            } else {
                entity = await Student.findById(otpDoc.refId).populate('parents.father parents.mother');
            }

            if (!entity) {
                throw new Error("User record not found");
            }

            return {
                id: entity._id.toString(),
                name: entity.name,
                email: (entity as any).email || (entity as any).contacts?.email?.[0] || "",
                role: role,
                requiresPasswordChange: false
            };
        }

        // Handle Password-based login (Admin/Staff)
        if (!credentials?.password) {
          throw new Error("Password is required");
        }

        let user;
        
        console.log("Authorize attempt for:", credentials.username || credentials.email);
        
        // Login with username (Admin) or email (Staff)
        if (credentials.username && credentials.username !== "undefined" && credentials.username !== "null") {
          user = await User.findOne({ username: credentials.username });
        } else if (credentials.email && credentials.email !== "undefined" && credentials.email !== "null") {
          user = await User.findOne({ email: credentials.email });
        }
        
        if (!user) {
          console.log("User not found in DB");
          throw new Error("User not found");
        }
        
        if (!user.isActive) {
          console.log("User account is inactive");
          throw new Error("Account is inactive. Please contact administrator.");
        }
        
        console.log("Found user, comparing passwords...");
        const isValid = await bcrypt.compare(credentials.password, user.password);
        
        if (!isValid) {
          console.log("Password comparison failed");
          throw new Error("Invalid password");
        }
        
        console.log("Password comparison successful");
        
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          requiresPasswordChange: user.requiresPasswordChange
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.requiresPasswordChange = user.requiresPasswordChange;
        token.id = user.id;
      }
      
      // On subsequent calls, check if user is still active for non-OTP roles
      if (token.id && !['teacher', 'parent'].includes(token.role as string)) {
        try {
          await dbConnect();
          const dbUser = await User.findById(token.id);
          if (!dbUser || !dbUser.isActive) {
             // Return null or empty token to invalidate?
             // Actually, returning null here might cause issues. 
             // Better to throw error or handle in session callback?
             // NextAuth doesn't handle errors well in jwt callback (it just logs them).
             // But if we return an invalid token, session will be invalid.
             // Let's set an error flag.
             return { ...token, error: "AccountInactive" };
          }
          // Update token with latest user data if needed
          token.role = dbUser.role;
          token.requiresPasswordChange = dbUser.requiresPasswordChange;
        } catch (error) {
          console.error("Error checking user status:", error);
          // If DB fails, we might want to let the user continue with existing token
          // or force logout. For safety, let's keep the token but maybe log the error.
          // Returning existing token allows temporary DB glitches without logging out users immediately.
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token.error === "AccountInactive") {
         // Return null or invalid session to force signout
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         return null as any; 
      }
      
      if (token) {
        session.user.role = token.role;
        session.user.requiresPasswordChange = token.requiresPasswordChange;
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Default signin page
    error: '/login', // Error page
  }
};
