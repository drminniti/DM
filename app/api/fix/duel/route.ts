import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    if (!adminDb) return NextResponse.json({ error: 'No adminDb' }, { status: 500 });
    
    // Find challenges created by the user or the one named '7 días entrando a la app del chami'
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

    // 1. Convert to SURVIVAL mode
    batch.update(adminDb.collection('challenges').doc(chId), {
        mode: 'SURVIVAL',
        pot: 50 * 3
    });

    // 2. Eliminate players with streak 0
    const partsSnap = await adminDb.collection('participants').where('challengeId', '==', chId).get();
    let eliminatedCount = 0;

    for (const p of partsSnap.docs) {
        const pData = p.data();
        if (pData.currentStreak === 0) {
            batch.update(adminDb.collection('participants').doc(p.id), {
                isEliminated: true
            });
            eliminatedCount++;
        }
    }

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        challengeConverted: targetCh.name,
        eliminatedPlayers: eliminatedCount
    });
}
