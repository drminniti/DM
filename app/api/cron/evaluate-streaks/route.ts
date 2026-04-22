import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    // Protect with secret.
    // Vercel automatically sends: Authorization: Bearer <CRON_SECRET> for cron invocations.
    // Manual calls (debugging) can pass x-cron-secret header or ?secret= query param.
    const authHeader = req.headers.get('authorization');
    const manualSecret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isManualCall = manualSecret === process.env.CRON_SECRET;
    if (!isVercelCron && !isManualCall) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const now = new Date();
    const runLog: Record<string, unknown>[] = [];

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

        // Robustly determine "yesterday" in the challenge's local timezone.
        // The cron runs at 03:00 UTC (= 00:00 ART). We subtract 3.5 hours to
        // safely land in the previous calendar day regardless of small timing drift.
        const safeYesterday = new Date(now.getTime() - 3.5 * 60 * 60 * 1000);
        const yesterdayString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(safeYesterday);

        const entry: Record<string, unknown> = {
            challengeId,
            challengeName: challenge.name,
            mode,
            tz,
            yesterdayString,
        };

        // Get ALL participants (including already eliminated)
        const allParticipantsSnap = await adminDb
            .collection('participants')
            .where('challengeId', '==', challengeId)
            .get();

        // Only process non-eliminated, non-archived participants
        const activeParticipants = allParticipantsSnap.docs.filter(
            (d) => !d.data().isEliminated && !d.data().isArchived
        );
        const participantIds = activeParticipants.map((d) => d.id);

        entry['activeCount'] = participantIds.length;

        // ── SURVIVAL ONLY: close game if only 0 or 1 active player remains ──
        // This handles the case where earlier crons eliminated most players and
        // only 1 survivor is left — they should win immediately.
        if (mode === 'SURVIVAL' && participantIds.length <= 1) {
            await adminDb.collection('challenges').doc(challengeId).update({ status: 'COMPLETED' });

            if (participantIds.length === 1) {
                const winnerDoc = activeParticipants[0];
                const uid = winnerDoc.data().userId;
                const totalPlayers = allParticipantsSnap.docs.length;
                const pot = (totalPlayers - 1) * 50;

                if (uid && pot > 0) {
                    const userRef = adminDb.collection('users').doc(uid);
                    await adminDb.runTransaction(async (t) => {
                        const uSnap = await t.get(userRef);
                        if (uSnap.exists) {
                            const pts = uSnap.data()?.points || 0;
                            const badges = uSnap.data()?.badges || {};
                            t.update(userRef, {
                                points: pts + pot,
                                'badges.SURVIVOR': (badges.SURVIVOR || 0) + 1,
                            });
                        }
                    });
                    entry['winner'] = uid;
                    entry['pot'] = pot;
                }
            }

            entry['action'] = 'survival_closed_sole_survivor';
            runLog.push(entry);
            processed++;
            continue;
        }

        // Get yesterday's completed logs for this challenge
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

        entry['completedYesterday'] = [...completedParticipantIds];
        entry['failedYesterday'] = failedParticipantIds;

        // If nobody failed, nothing to do for this challenge
        if (failedParticipantIds.length === 0) {
            entry['action'] = 'all_completed_no_action';
            runLog.push(entry);
            processed++;
            continue;
        }

        const failedParticipants = activeParticipants.filter(d => failedParticipantIds.includes(d.id));

        // Apply point penalties to everyone who failed (-10 pts, floor at 0)
        for (const pDoc of failedParticipants) {
            const uid = pDoc.data().userId;
            if (uid) {
                const userRef = adminDb.collection('users').doc(uid);
                const uSnap = await userRef.get();
                if (uSnap.exists) {
                    const currentPts = uSnap.data()?.points || 0;
                    await userRef.update({ points: Math.max(0, currentPts - 10) });
                }
            }
        }

        if (mode === 'SURVIVAL') {
            // Eliminate all who failed yesterday
            const batch = adminDb.batch();
            for (const pid of failedParticipantIds) {
                batch.update(adminDb.collection('participants').doc(pid), {
                    isEliminated: true,
                    currentStreak: 0,
                });
            }
            await batch.commit();
            entry['eliminated'] = failedParticipantIds;

            const survivorsCount = participantIds.length - failedParticipantIds.length;
            entry['survivorsAfter'] = survivorsCount;

            if (survivorsCount <= 1) {
                await adminDb.collection('challenges').doc(challengeId).update({ status: 'COMPLETED' });

                const totalPlayers = allParticipantsSnap.docs.length;
                const pot = (totalPlayers - 1) * 50;

                if (survivorsCount === 1) {
                    // Only one survivor — they take the full pot
                    const winnerId = participantIds.find(pid => !failedParticipantIds.includes(pid));
                    const winnerDoc = activeParticipants.find(d => d.id === winnerId);
                    if (winnerDoc && winnerDoc.data().userId) {
                        const uid = winnerDoc.data().userId;
                        const userRef = adminDb.collection('users').doc(uid);
                        await adminDb.runTransaction(async (t) => {
                            const uSnap = await t.get(userRef);
                            if (uSnap.exists) {
                                const pts = uSnap.data()?.points || 0;
                                const badges = uSnap.data()?.badges || {};
                                t.update(userRef, {
                                    points: pts + pot,
                                    'badges.SURVIVOR': (badges.SURVIVOR || 0) + 1,
                                });
                            }
                        });
                        entry['winner'] = uid;
                        entry['pot'] = pot;
                    }
                } else if (survivorsCount === 0 && failedParticipants.length > 0 && pot > 0) {
                    // Everyone fell the same day — split pot equally among last survivors
                    const share = Math.floor(pot / failedParticipants.length);
                    const winners: string[] = [];
                    for (const pDoc of failedParticipants) {
                        const uid = pDoc.data().userId;
                        if (uid) {
                            const userRef = adminDb.collection('users').doc(uid);
                            const uSnap = await userRef.get();
                            if (uSnap.exists) {
                                const pts = uSnap.data()?.points || 0;
                                await userRef.update({ points: pts + share });
                                winners.push(uid);
                            }
                        }
                    }
                    entry['potSplitAmong'] = winners;
                    entry['sharePerPlayer'] = share;
                    entry['pot'] = pot;
                }
                entry['action'] = 'survival_ended';
            } else {
                entry['action'] = 'survival_eliminated_some';
            }

        } else if (mode === 'INDIVIDUAL') {
            const batch = adminDb.batch();
            for (const pid of failedParticipantIds) {
                batch.update(adminDb.collection('participants').doc(pid), { currentStreak: 0 });
            }
            await batch.commit();
            entry['action'] = 'individual_streaks_reset';

        } else if (mode === 'TEAM') {
            const batch = adminDb.batch();
            for (const pid of participantIds) {
                batch.update(adminDb.collection('participants').doc(pid), { currentStreak: 0 });
            }
            await batch.commit();
            entry['action'] = 'team_all_reset';
        }

        runLog.push(entry);
        processed++;
    }

    return NextResponse.json({
        ok: true,
        challengesProcessed: processed,
        runAt: now.toISOString(),
        log: runLog,
    });
}
