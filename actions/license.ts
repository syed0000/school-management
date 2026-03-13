"use server"

import dbConnect from "@/lib/db"
import License from "@/models/License"
import User from "@/models/User"

export async function checkActivationStatus() {
  try {
    await dbConnect()
    const license = await License.findOne({})
    const admin = await User.findOne({ role: 'admin' })

    return {
      success: true,
      isActivated: !!(license && admin),
      hasLicense: !!license
    }
  } catch (error) {
    console.error("Failed to check activation status:", error)
    return { success: false, isActivated: false, hasLicense: false }
  }
}
