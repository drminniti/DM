import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Emergency route: runs the survival evaluation logic RIGHT NOW for all active
 * challenges, eliminating participants that have missed one or more past days.
 *
 * Protected by the same CRON_SECRET as the nightly cron.
 * Usage: GET /api/fix/force-evaluate?secret=YOUR_CRON_SECRET
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const now = new Date();
    const runLog: Record<string, unknown>[] = [];

    const challengesSnap = await adminDb
        .collection('challenges')
        .where('status', '==', 'ACTIVE')
        .get();

    for (const challengeDoc of challengesSnap.docs) {
        const challenge = challengeDoc.data();
        const challengeId = challengeDoc.id;
        const mode = challenge.mode as string;
        const tz = challenge.timezone || 'America/Argentina/Buenos_Aires';

        if (mode !== 'SURVIVAL') continue; // Only survival challenges need elimination

        const entry: Record<string, unknown> = {
            challengeId,
            challengeName: challenge.name,
            mode,
            tz,
            evaluatedAt: now.toISOString(),
        };

        // Determine how many calendar days have elapsed since challenge creation
        const createdDate: Date = challenge.createdAt?.toDate?.() ?? new Date();
        const createdDayText = createdDate.toLocaleDateString('en-CA', { timeZone: tz });
        const todayText = now.toLocaleDateString('en-CA', { timeZone: tz });
        const createdTz = new Date(createdDayText + 'T00:00:00');
        const todayTz = new Date(todayText + 'T00:00:00');
        const calendarDaysElapsed = Math.round(
            (todayTz.getTime() - createdTz.getTime()) / (1000 * 60 * 60 * 24)
        );

        entry['calendarDaysElapsed'] = calendarDaysElapsed;

        // Get all non-eliminated, non-archived participants
        const allPartsSnap = await adminDb
            .collection('participants')
            .where('challengeId', '==', challengeId)
            .get();

        const activeParticipants = allPartsSnap.docs.filter(
            (d) => !d.data().isEliminated && !d.data().isArchived
        );

        entry['activeParticipants'] = activeParticipants.length;

        // A survival participant must have streak >= calendarDaysElapsed to be alive.
        // (They need a log for every completed past day.)
        // We verify day by day using the actual daily_logs collection.

        // Get ALL completed logs for this challenge
        const allLogsSnap = await adminDb
            .collection('daily_logs')
            .where('challengeId', '==', challengeId)
            .where('isCompleted', '==', true)
            .get();

        // Build a set of "participantId|date" for quick lookup
        const completedSet = new Set<string>(
            allLogsSnap.docs.map((d) => `${d.data().participantId}|${d.data().date}`)
        );

        // Build the list of dates that have already PASSED (yesterday and before)
        const pastDates: string[] = [];
        for (let i = 0; i < calendarDaysElapsed; i++) {
            const d = new Date(createdTz.getTime() + i * 86400_000);
            pastDates.push(d.toLocaleDateString('en-CA', { timeZone: tz }));
        }

        entry['pastDates'] = pastDates;

        const toEliminate: string[] = [];

        for (const partDoc of activeParticipants) {
            const pid = partDoc.id;
            // Check if the participant completed ALL past days
            const missedAny = pastDates.some((date) => !completedSet.has(`${pid}|${date}`));
            if (missedAny) {
                toEliminate.push(pid);
            }
        }

        entry['toEliminate'] = toEliminate;

        if (toEliminate.length === 0) {
            entry['action'] = 'no_eliminations_needed';
            runLog.push(entry);
            continue;
        }

        // Eliminate participants that missed at least one past day
        const batch = adminDb.batch();
        for (const pid of toEliminate) {
            batch.update(adminDb.collection('participants').doc(pid), {
                isEliminated: true,
            });
        }
        await batch.commit();

        const survivorsCount = activeParticipants.length - toEliminate.length;
        entry['survivorsAfter'] = survivorsCount;

        // If 1 or 0 survivors remain, close the challenge
        if (survivorsCount <= 1) {
            await adminDb.collection('challenges').doc(challengeId).update({ status: 'COMPLETED' });

            if (survivorsCount === 1) {
                const winnerId = activeParticipants.find((d) => !toEliminate.includes(d.id));
                if (winnerId) {
                    const uid = winnerId.data().userId;
                    const totalPlayers = allPartsSnap.docs.length;
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
            }
            entry['action'] = 'survival_closed';
        } else {
            entry['action'] = 'survival_eliminated_stragglers';
        }

        runLog.push(entry);
    }

    return NextResponse.json({
        ok: true,
        evaluatedAt: now.toISOString(),
        log: runLog,
    });
}
