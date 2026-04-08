import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Counter from '@/models/Counter';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const counter = await Counter.findById('registrationNumber');
    return NextResponse.json({ 
      success: true, 
      currentSeq: counter ? counter.seq : 0,
      nextRegistrationNumber: counter ? String(counter.seq + 1).padStart(4, '0') : '0215'
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch counter' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user?.isDemo === true) {
      return NextResponse.json({ success: true, demo: true });
    }

    const body = await req.json();
    const { seq } = body;

    if (typeof seq !== 'number') {
      return NextResponse.json({ success: false, error: 'Invalid sequence number' }, { status: 400 });
    }

    await dbConnect();
    const counter = await Counter.findByIdAndUpdate(
      'registrationNumber',
      { seq },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, counter });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update counter' }, { status: 500 });
  }
}
