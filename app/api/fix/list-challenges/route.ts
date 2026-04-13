import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    if (!adminDb) return NextResponse.json({ error: 'No adminDb' }, { status: 500 });

    const challengesSnap = await adminDb.collection('challenges').get();
    const challenges = challengesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ challenges });
}
