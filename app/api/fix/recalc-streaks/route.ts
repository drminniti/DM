import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * One-time fix: recalculates currentStreak for all INDIVIDUAL mode challenge
 * participants by counting their actual completed daily_logs.
 *
 * This corrects participants whose streak was incorrectly reset to 0 by the
 * nightly cron (which used consecutive-day semantics instead of cumulative).
 *
 * Usage: GET /api/fix/recalc-streaks?secret=YOUR_CRON_SECRET
 * Optional: ?challengeId=XXX to limit to a specific challenge
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const filterChallengeId = req.nextUrl.searchParams.get('challengeId');

    // Get active INDIVIDUAL challenges (or the specific one)
    let challengesQuery = adminDb.collection('challenges').where('mode', '==', 'INDIVIDUAL');
    const challengesSnap = await challengesQuery.get();

    const log: Record<string, unknown>[] = [];
    let totalFixed = 0;

    for (const challengeDoc of challengesSnap.docs) {
        const challengeId = challengeDoc.id;

        if (filterChallengeId && challengeId !== filterChallengeId) continue;

        const challengeName = challengeDoc.data().name;

        // Get all non-archived participants for this challenge
        const partsSnap = await adminDb
            .collection('participants')
            .where('challengeId', '==', challengeId)
            .get();

        const activeParticipants = partsSnap.docs.filter((d) => !d.data().isArchived);

        // Get all completed logs for this challenge
        const logsSnap = await adminDb
            .collection('daily_logs')
            .where('challengeId', '==', challengeId)
            .where('isCompleted', '==', true)
            .get();

        // Count completed days per participant
        const completedCountByParticipant: Record<string, number> = {};
        for (const logDoc of logsSnap.docs) {
            const pid = logDoc.data().participantId as string;
            completedCountByParticipant[pid] = (completedCountByParticipant[pid] || 0) + 1;
        }

        const challengeLog: { participantId: string; playerName: string; oldStreak: number; newStreak: number }[] = [];

        // Update each participant's streak to match their actual log count
        const batch = adminDb.batch();
        for (const partDoc of activeParticipants) {
            const pid = partDoc.id;
            const oldStreak = partDoc.data().currentStreak as number ?? 0;
            const newStreak = completedCountByParticipant[pid] || 0;

            if (oldStreak !== newStreak) {
                batch.update(adminDb.collection('participants').doc(pid), { currentStreak: newStreak });
                totalFixed++;
            }

            challengeLog.push({
                participantId: pid,
                playerName: partDoc.data().playerName,
                oldStreak,
                newStreak,
            });
        }
        await batch.commit();

        log.push({ challengeId, challengeName, participants: challengeLog });
    }

    return NextResponse.json({
        ok: true,
        totalParticipantsFixed: totalFixed,
        challenges: log,
    });
}
