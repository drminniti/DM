import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const { challengeId, participantIdToKick, creatorUserId } = await req.json();

        if (!adminDb) {
            return NextResponse.json({ ok: false, error: 'Admin DB not configured' }, { status: 500 });
        }

        // Verify challenge exists and creator matches
        const challengeDoc = await adminDb.collection('challenges').doc(challengeId).get();
        if (!challengeDoc.exists) {
            return NextResponse.json({ ok: false, error: 'Challenge not found' }, { status: 404 });
        }

        const challengeData = challengeDoc.data();
        if (challengeData?.creatorId !== creatorUserId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized: not the creator' }, { status: 403 });
        }

        // Gather all daily logs for this participant
        const logsSnap = await adminDb
            .collection('daily_logs')
            .where('challengeId', '==', challengeId)
            .where('participantId', '==', participantIdToKick)
            .get();

        const batch = adminDb.batch();

        // Delete the logs
        logsSnap.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Delete the participant
        batch.delete(adminDb.collection('participants').doc(participantIdToKick));

        await batch.commit();

        return NextResponse.json({ ok: true, deletedLogs: logsSnap.size });
    } catch (err) {
        console.error('Kick participant error:', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}
