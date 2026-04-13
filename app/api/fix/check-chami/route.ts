import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    if (!adminDb) return NextResponse.json({ error: 'No adminDb' }, { status: 500 });

    const challengesSnap = await adminDb.collection('challenges').get();

    let targetCh: any = null;
    let chId = '';

    for (const doc of challengesSnap.docs) {
        const data = doc.data();
        if (data.name && data.name.includes('chami')) {
            targetCh = { ...data, id: doc.id };
            chId = doc.id;
            break;
        }
    }

    if (!targetCh) return NextResponse.json({ error: 'Challenge not found' });

    const partsSnap = await adminDb.collection('participants').where('challengeId', '==', chId).get();
    const participants = partsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({
        challenge: { id: chId, name: targetCh.name, mode: targetCh.mode, pot: targetCh.pot ?? null },
        participants,
    });
}
