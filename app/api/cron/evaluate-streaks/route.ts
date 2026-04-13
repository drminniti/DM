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
        const mode = challenge.mode as 'TEAM' | 'INDIVIDUAL' | 'SURVIVAL';
        const tz = challenge.timezone || 'America/Argentina/Buenos_Aires';
        
        const now = new Date();
        // Daily Cron: evaluamos todos globalmente porque Vercel Hobby solo permite 1 vez al día

        // Si es medianoche, evaluamos si CUMPLIERON "AYER"
        // Le restamos 2 horas a "ahora" para asegurarnos de caer en el día anterior local
        const yesterdayTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const yesterdayString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(yesterdayTime);

        // Get all participants
        const allParticipantsSnap = await adminDb
            .collection('participants')
            .where('challengeId', '==', challengeId)
            .get();

        // Ignore already eliminated participants
        const activeParticipants = allParticipantsSnap.docs.filter((d) => !d.data().isEliminated);
        const participantIds = activeParticipants.map((d) => d.id);

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

        const failedParticipants = activeParticipants.filter(d => failedParticipantIds.includes(d.id));

        if (failedParticipants.length === 0) {
            // Everyone completed — no resets needed (or SURVIVAL check if totalDays reached, but handle simple for now)
            processed++;
            continue;
        }

        // Apply point penalties to everyone who failed (-15 points, min 0)
        // We do this individually before modifying the streaks
        for (const pDoc of failedParticipants) {
            const uid = pDoc.data().userId;
            if (uid) {
                // Read current points and subtract carefully
                const userRef = adminDb.collection('users').doc(uid);
                // We use a simple read-then-write fallback since batch increment with floor is tricky.
                const uSnap = await userRef.get();
                if (uSnap.exists) {
                    const currentPts = uSnap.data()?.points || 0;
                    const newPts = Math.max(0, currentPts - 15);
                    await userRef.update({ points: newPts });
                }
            }
        }

        if (mode === 'SURVIVAL') {
            const batch = adminDb.batch();
            for (const pid of failedParticipantIds) {
                batch.update(adminDb.collection('participants').doc(pid), { isEliminated: true, currentStreak: 0 });
            }
            await batch.commit();

            const survivorsCount = participantIds.length - failedParticipantIds.length;
            
            // If 1 or 0 players left, the game ends
            if (survivorsCount <= 1) {
                await adminDb.collection('challenges').doc(challengeId).update({ status: 'COMPLETED' });

                // If exactly 1 survivor, they take the pot and the badge
                if (survivorsCount === 1) {
                    const winnerId = participantIds.find(pid => !failedParticipantIds.includes(pid));
                    const winnerDoc = activeParticipants.find(d => d.id === winnerId);
                    if (winnerDoc && winnerDoc.data().userId) {
                        const uid = winnerDoc.data().userId;
                        const pot = challenge.pot || 0;
                        const userRef = adminDb.collection('users').doc(uid);
                        
                        await adminDb.runTransaction(async (t) => {
                            const uSnap = await t.get(userRef);
                            if (uSnap.exists) {
                                const pts = uSnap.data()?.points || 0;
                                const badges = uSnap.data()?.badges || {};
                                t.update(userRef, { 
                                    points: pts + pot,
                                    'badges.SURVIVOR': (badges.SURVIVOR || 0) + 1
                                });
                            }
                        });
                    }
                }
            }
        } else if (mode === 'INDIVIDUAL') {
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
