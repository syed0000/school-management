import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import Otp from "@/models/Otp";
import bcrypt from "bcryptjs";
import { demoConfig } from "@/lib/demo-config";
import { escapeRegExp } from "@/lib/regex";

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
        role: { label: "Role", type: "text" },
        demo: { label: "Demo", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials) return null;
        await dbConnect();

        if (credentials.demo === "true") {
          if (!demoConfig.adminInstitute) {
            throw new Error("Demo login is not enabled");
          }

          const email = (credentials.email || "").trim();
          if (!email) {
            throw new Error("Demo email is required");
          }

          const demoUser = await User.findOne({
            isDemo: true,
            isActive: true,
            email: { $regex: `^${escapeRegExp(email)}$`, $options: "i" },
          });
          if (!demoUser) {
            throw new Error("Demo user not found");
          }

          return {
            id: demoUser._id.toString(),
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            requiresPasswordChange: false,
            isDemo: true
          };
        }
        
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
                email: (() => {
                  const maybe = entity as unknown as { email?: unknown; contacts?: { email?: unknown } };
                  const direct = typeof maybe.email === "string" ? maybe.email : "";
                  const contactArr = Array.isArray(maybe.contacts?.email) ? maybe.contacts?.email : [];
                  const contact = typeof contactArr[0] === "string" ? contactArr[0] : "";
                  return direct || contact || "";
                })(),
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
    maxAge: 365 * 24 * 60 * 60, // 1 year persistence (long lived token)
    updateAge: 30 * 60, // Throttle cookie writes to once every 30 minutes (refresh logic)
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.requiresPasswordChange = user.requiresPasswordChange;
        token.id = user.id;
        token.isDemo = (user as unknown as { isDemo?: boolean }).isDemo === true;
        token.impersonation = null;
        token.lastRefetchedAt = Math.floor(Date.now() / 1000);
      }
      
      // Allow manual refresh via update() if needed
      if (trigger === "update" && session) {
        if (token.isDemo) {
          token.impersonation = session.user?.impersonation ?? null;
        }
        token.lastRefetchedAt = Math.floor(Date.now() / 1000);
      }

      // Throttled re-validation for non-OTP roles
      if (token.id && !token.isDemo && !['teacher', 'parent'].includes(token.role as string)) {
        const now = Math.floor(Date.now() / 1000);
        const lastRefetched = (token.lastRefetchedAt as number) || 0;

        // Only hit the DB if 30 minutes (1800s) have passed since the last fetch
        if (now - lastRefetched > 1800) {
          try {
            await dbConnect();
            const dbUser = await User.findById(token.id);
            if (!dbUser || !dbUser.isActive) {
               return { ...token, error: "AccountInactive" };
            }
            // Update token with latest user data
            token.role = dbUser.role;
            token.requiresPasswordChange = dbUser.requiresPasswordChange;
            token.lastRefetchedAt = now;
          } catch (error) {
            console.error("Error checking user status:", error);
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token.error === "AccountInactive") {
         return null as unknown as typeof session;
      }
      
      if (token) {
        session.user.isDemo = token.isDemo === true;
        session.user.actorId = token.id as string;
        session.user.impersonation = token.impersonation ?? null;

        const effectiveRole = token.impersonation?.role || token.role;
        const effectiveId = token.impersonation?.id || (token.id as string);

        session.user.role = effectiveRole;
        session.user.requiresPasswordChange = token.requiresPasswordChange;
        session.user.id = effectiveId;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Default signin page
    error: '/login', // Error page
  }
};
