import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    // Protect with secret
    const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // Get all active challenges
    const challengesSnap = await adminDb
        .collection('challenges')
        .where('status', '==', 'ACTIVE')
        .get();

    let processed = 0;

    for (const challengeDoc of challengesSnap.docs) {
        const challenge = challengeDoc.data();
        const challengeId = challengeDoc.id;
        const mode = challenge.mode as 'TEAM' | 'INDIVIDUAL';
        const tz = challenge.timezone || 'America/Argentina/Buenos_Aires';
        
        const now = new Date();
        const hourStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            hour: '2-digit',
            hour12: false
        }).format(now);

        // En node, '00' o '24' pueden representar la medianoche dependiendo de la versión
        if (hourStr !== '00' && hourStr !== '24') {
            continue; // NO es medianoche local para este desafío, saltamos
        }

        // Si es medianoche, evaluamos si CUMPLIERON "AYER"
        // Le restamos 2 horas a "ahora" para asegurarnos de caer en el día anterior local
        const yesterdayTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const yesterdayString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(yesterdayTime);

        // Get all participants
        const participantsSnap = await adminDb
            .collection('participants')
            .where('challengeId', '==', challengeId)
            .get();

        const participantIds = participantsSnap.docs.map((d) => d.id);

        // Get yesterday's logs for this challenge
        const logsSnap = await adminDb
            .collection('daily_logs')
            .where('challengeId', '==', challengeId)
            .where('date', '==', yesterdayString)
            .where('isCompleted', '==', true)
            .get();

        const completedParticipantIds = new Set(
            logsSnap.docs.map((d) => d.data().participantId as string)
        );

        const failedParticipantIds = participantIds.filter(
            (pid) => !completedParticipantIds.has(pid)
        );

        if (failedParticipantIds.length === 0) {
            // Everyone completed — no resets needed
            processed++;
            continue;
        }

        if (mode === 'INDIVIDUAL') {
            // Only reset streaks of those who failed
            const batch = adminDb.batch();
            for (const pid of failedParticipantIds) {
                batch.update(adminDb.collection('participants').doc(pid), { currentStreak: 0 });
            }
            await batch.commit();
        } else if (mode === 'TEAM') {
            // At least one failed — reset ALL streaks
            const batch = adminDb.batch();
            for (const pid of participantIds) {
                batch.update(adminDb.collection('participants').doc(pid), { currentStreak: 0 });
            }
            await batch.commit();
        }

        processed++;
    }

    return NextResponse.json({ ok: true, challengesProcessed: processed });
}
