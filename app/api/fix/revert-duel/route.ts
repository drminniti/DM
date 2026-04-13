import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    if (!adminDb) return NextResponse.json({ error: 'No adminDb' }, { status: 500 });

    const chId = 's0wTqj1b4arWenvgu4dJ'; // "100 flexiones"

    const chDoc = await adminDb.collection('challenges').doc(chId).get();
    if (!chDoc.exists) return NextResponse.json({ error: 'Challenge not found' });

    const batch = adminDb.batch();

    // Set back to SURVIVAL with pot
    batch.update(adminDb.collection('challenges').doc(chId), {
        mode: 'SURVIVAL',
        pot: 50 * 4, // 4 participantes × $50
    });

    // Ensure players with streak 0 are marked eliminated
    const partsSnap = await adminDb.collection('participants').where('challengeId', '==', chId).get();
    const eliminated: string[] = [];

    for (const p of partsSnap.docs) {
        const pData = p.data();
        if (pData.currentStreak === 0 && !pData.isEliminated) {
            batch.update(adminDb.collection('participants').doc(p.id), { isEliminated: true });
            eliminated.push(pData.playerName ?? p.id);
        }
    }

    await batch.commit();

    return NextResponse.json({
        success: true,
        challenge: chDoc.data()?.name,
        newMode: 'SURVIVAL',
        eliminatedNow: eliminated,
        participants: partsSnap.docs.map(p => ({
            name: p.data().playerName,
            streak: p.data().currentStreak,
            isEliminated: p.data().isEliminated ?? false,
        })),
    });
}
