import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const { challengeId, completedByName } = await req.json();

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
            const token = doc.data().fcmToken as string;
            if (token) tokens.push(token);
        });

        if (tokens.length === 0) {
            return NextResponse.json({ ok: true, sent: 0 });
        }

        const message = {
            notification: {
                title: '🔥 ¡Alguien cumplió!',
                body: completedByName
                    ? `${completedByName} marcó su día como cumplido. ¡Tu turno!`
                    : '¡Un participante cumplió su desafío hoy!',
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
