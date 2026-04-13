import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    if (!adminDb) return NextResponse.json({ error: 'No adminDb' }, { status: 500 });

    // Target: "100 flexiones" challenge that was incorrectly converted from INDIVIDUAL to SURVIVAL
    const chId = 's0wTqj1b4arWenvgu4dJ';

    const chDoc = await adminDb.collection('challenges').doc(chId).get();
    if (!chDoc.exists) return NextResponse.json({ error: 'Challenge not found' });
    const chData = chDoc.data()!;

    const batch = adminDb.batch();

    // 1. Revert to INDIVIDUAL and clear pot
    batch.update(adminDb.collection('challenges').doc(chId), {
        mode: 'INDIVIDUAL',
        pot: null,
    });

    // 2. Get participants and mark eliminated those with currentStreak === 0
    const partsSnap = await adminDb.collection('participants').where('challengeId', '==', chId).get();
    let eliminatedCount = 0;
    const eliminatedNames: string[] = [];
    const alreadyEliminated: string[] = [];

    for (const p of partsSnap.docs) {
        const pData = p.data();
        if (pData.currentStreak === 0 && !pData.isEliminated) {
            batch.update(adminDb.collection('participants').doc(p.id), {
                isEliminated: true,
            });
            eliminatedCount++;
            eliminatedNames.push(pData.playerName ?? p.id);
        } else if (pData.isEliminated) {
            alreadyEliminated.push(pData.playerName ?? p.id);
        }
    }

    await batch.commit();

    return NextResponse.json({
        success: true,
        challengeName: chData.name,
        previousMode: chData.mode,
        newMode: 'INDIVIDUAL',
        eliminatedNow: eliminatedNames,
        alreadyEliminated,
        participants: partsSnap.docs.map(p => ({
            name: p.data().playerName,
            streak: p.data().currentStreak,
            wasEliminated: p.data().isEliminated ?? false,
        })),
    });
}
