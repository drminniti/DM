import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * One-time retroactive route: distributes the pot of an already-COMPLETED
 * survival challenge where nobody received their share (everyone fell the same day).
 *
 * Finds all non-archived participants with the highest streak (the last survivors)
 * and splits the pot equally among them.
 *
 * Usage: GET /api/fix/award-pot?secret=YOUR_CRON_SECRET&challengeId=CHALLENGE_ID
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const challengeId = req.nextUrl.searchParams.get('challengeId');
    if (!challengeId) {
        return NextResponse.json({ error: 'Missing challengeId param' }, { status: 400 });
    }

    const challengeSnap = await adminDb.collection('challenges').doc(challengeId).get();
    if (!challengeSnap.exists) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const challenge = challengeSnap.data()!;
    if (challenge.mode !== 'SURVIVAL') {
        return NextResponse.json({ error: 'Only SURVIVAL challenges have a pot' }, { status: 400 });
    }

    // Get all participants (including eliminated, excluding archived)
    const partsSnap = await adminDb
        .collection('participants')
        .where('challengeId', '==', challengeId)
        .get();

    const allParticipants = partsSnap.docs.filter((d) => !d.data().isArchived);
    const totalPlayers = allParticipants.length;
    const pot = (totalPlayers - 1) * 50;

    if (pot <= 0) {
        return NextResponse.json({ error: 'No pot to distribute (need at least 2 players)' });
    }

    // Find the max streak among all participants (the "last survivors")
    const maxStreak = Math.max(...allParticipants.map((d) => d.data().currentStreak as number ?? 0));

    // All participants tied at the max streak are considered "last survivors"
    const lastSurvivors = allParticipants.filter(
        (d) => (d.data().currentStreak as number ?? 0) === maxStreak
    );

    if (lastSurvivors.length === 0) {
        return NextResponse.json({ error: 'No participants found' });
    }

    const share = Math.floor(pot / lastSurvivors.length);
    const awarded: { uid: string; playerName: string; share: number }[] = [];

    for (const pDoc of lastSurvivors) {
        const uid = pDoc.data().userId as string;
        const playerName = pDoc.data().playerName as string;
        if (!uid) continue;

        const userRef = adminDb.collection('users').doc(uid);
        const uSnap = await userRef.get();
        if (uSnap.exists) {
            const pts = uSnap.data()?.points || 0;
            await userRef.update({ points: pts + share });
            awarded.push({ uid, playerName, share });
        }
    }

    return NextResponse.json({
        ok: true,
        challengeId,
        challengeName: challenge.name,
        totalPlayers,
        pot,
        maxStreak,
        splitAmong: lastSurvivors.length,
        sharePerPlayer: share,
        awarded,
    });
}
