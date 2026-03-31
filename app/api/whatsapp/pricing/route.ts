import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import WhatsAppPricing from "@/models/WhatsAppPricing"

export async function GET() {
  try {
    await dbConnect()
    const price = await WhatsAppPricing.getCurrentPrice()
    return NextResponse.json({ price })
  } catch {
    return NextResponse.json({ price: 0 }, { status: 500 })
  }
}
