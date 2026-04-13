import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    if (!adminDb) return NextResponse.json({ error: 'No adminDb' }, { status: 500 });

    // Find the challenge that was incorrectly converted to SURVIVAL (was the "chami" challenge)
    const challengesSnap = await adminDb.collection('challenges').get();

    let targetCh: any = null;
    let chId = '';

    for (const doc of challengesSnap.docs) {
        const data = doc.data();
        if (data.name && data.name.includes('chami')) {
            targetCh = data;
            chId = doc.id;
            break;
        }
    }

    if (!targetCh) return NextResponse.json({ error: 'Challenge not found' });

    const batch = adminDb.batch();

    // 1. Revert mode back to INDIVIDUAL and remove the pot field
    batch.update(adminDb.collection('challenges').doc(chId), {
        mode: 'INDIVIDUAL',
        pot: null,
    });

    // 2. Eliminate players with streak 0 (Guillermo failed day 1)
    const partsSnap = await adminDb.collection('participants').where('challengeId', '==', chId).get();
    let eliminatedCount = 0;
    const eliminatedNames: string[] = [];

    for (const p of partsSnap.docs) {
        const pData = p.data();
        if (pData.currentStreak === 0 && !pData.isEliminated) {
            batch.update(adminDb.collection('participants').doc(p.id), {
                isEliminated: true,
            });
            eliminatedCount++;
            eliminatedNames.push(pData.playerName ?? p.id);
        }
    }

    await batch.commit();

    return NextResponse.json({
        success: true,
        challengeReverted: targetCh.name,
        newMode: 'INDIVIDUAL',
        eliminatedPlayers: eliminatedCount,
        eliminatedNames,
    });
}
