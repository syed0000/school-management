import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import License from '@/models/License';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await dbConnect();
        const license = await License.findOne({});
        const admin = await User.findOne({ role: 'admin' });
        
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
