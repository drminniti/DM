import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    if (!adminDb) return NextResponse.json({ error: 'No adminDb' }, { status: 500 });
    
    // 1. Get all participants to map userId -> playerName
    const participants = await adminDb.collection('participants').get();
    const namesMap = new Map<string, string>();
    
    participants.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId && data.playerName && data.playerName !== 'Jugador') {
            // Keep the first distinct name we find for them
            if (!namesMap.has(data.userId)) {
                namesMap.set(data.userId, data.playerName);
            }
        }
    });

    // 2. Scan users collection
    const users = await adminDb.collection('users').get();
    let updated = 0;

    const batch = adminDb.batch();
    
    users.docs.forEach(doc => {
        const userData = doc.data();
        const storedName = userData.displayName;
        
        // If they lack a display name or it is 'Jugador'
        if (!storedName || storedName === 'Jugador' || storedName === 'Jugador Anónimo') {
            const knownName = namesMap.get(doc.id);
            if (knownName) {
                batch.update(adminDb!.collection('users').doc(doc.id), {
                    displayName: knownName
                });
                updated++;
            }
        }
    });

    if (updated > 0) {
        await batch.commit();
    }

    return NextResponse.json({ success: true, updatedCount: updated });
}
