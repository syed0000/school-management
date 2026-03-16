import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import License from '@/models/License';
import User from '@/models/User';
import WhatsAppPricing from '@/models/WhatsAppPricing';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        const license = await License.findOne({});
        const admin = await User.findOne({ role: 'admin' });
        
        // Ensure initial pricing exists
        const pricing = await WhatsAppPricing.findOne({});
        if (!pricing) {
            console.log("No WhatsApp pricing found, seeding initial pricing...");
            await WhatsAppPricing.create({
                pricePerRequest: 0.18,
                effectiveFrom: new Date('2025-04-01'),
            });
        }
        
        return NextResponse.json({ 
            initialized: !!(license && admin),
            hasLicense: !!license,
            hasAdmin: !!admin
        });
    } catch (e) {
        console.error("Failed to check initialization:", e);
        return NextResponse.json({ initialized: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
