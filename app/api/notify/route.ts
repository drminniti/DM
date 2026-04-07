import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const { challengeId, completedByName, challengeName, triggerParticipantId } = await req.json();

        if (!adminDb || !adminMessaging) {
            // Firebase Admin not configured — skip silently
            return NextResponse.json({ ok: true, skipped: true });
        }

        // Get all participants to notify
        const snap = await adminDb
            .collection('participants')
            .where('challengeId', '==', challengeId)
            .get();

        const tokens: string[] = [];
        snap.forEach((doc) => {
            if (doc.id === triggerParticipantId) return; // Skip the person who triggered it
            const token = doc.data().fcmToken as string;
            if (token) tokens.push(token);
        });

        if (tokens.length === 0) {
            return NextResponse.json({ ok: true, sent: 0 });
        }

        // Build title: "🔥 Juan · 30 días sin azúcar"  (fallback if names missing)
        const title = completedByName && challengeName
            ? `🔥 ${completedByName} · ${challengeName}`
            : completedByName
            ? `🔥 ${completedByName} cumplió hoy`
            : '🔥 ¡Alguien cumplió el desafío!';

        const message = {
            notification: {
                title,
                body: '¡Cumplió su objetivo del día!',
            },
            webpush: {
                notification: {
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                }
            },
            tokens,
        };

        const result = await adminMessaging.sendEachForMulticast(message);
        return NextResponse.json({ ok: true, sent: result.successCount });
    } catch (err) {
        console.error('Notify error:', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}
