import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  // Protect with secret
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb || !adminMessaging) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
  }

  // Get all active challenges
  const challengesSnap = await adminDb
    .collection('challenges')
    .where('status', '==', 'ACTIVE')
    .get();

  let notificationsSent = 0;
  let participantsReminded = 0;

  for (const challengeDoc of challengesSnap.docs) {
    const challengeId = challengeDoc.id;
    const challenge = challengeDoc.data();
    const challengeName = challenge.name as string;
    const tz = challenge.timezone || 'America/Argentina/Buenos_Aires';

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false
    });
    const hourStr = formatter.format(now);

    // Only send reminders at 20:00 (8 PM) local time
    if (hourStr !== '20') continue;

    const todayString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

    // Get all participants with an FCM token
    const participantsSnap = await adminDb
      .collection('participants')
      .where('challengeId', '==', challengeId)
      .get();

    // Get today's completed logs for this challenge
    const logsSnap = await adminDb
      .collection('daily_logs')
      .where('challengeId', '==', challengeId)
      .where('date', '==', todayString)
      .where('isCompleted', '==', true)
      .get();

    const completedParticipantIds = new Set(
      logsSnap.docs.map((d) => d.data().participantId as string)
    );

    // Collect tokens of participants who haven't completed yet
    const tokensToNotify: string[] = [];
    participantsSnap.forEach((doc) => {
      const { fcmToken, id: participantId } = { id: doc.id, ...doc.data() } as {
        id: string;
        fcmToken?: string;
        [key: string]: unknown;
      };
      if (!completedParticipantIds.has(doc.id) && fcmToken) {
        tokensToNotify.push(fcmToken);
        participantsReminded++;
      }
    });

    if (tokensToNotify.length === 0) continue;

    // Send reminder push to those who haven't completed
    try {
      const result = await adminMessaging.sendEachForMulticast({
        notification: {
          title: '⏰ ¡Recordatorio de desafío!',
          body: `Todavía no completaste "${challengeName}" hoy. ¡Quedan pocas horas!`,
        },
        tokens: tokensToNotify,
      });
      notificationsSent += result.successCount;
    } catch (err) {
      console.error(`Error sending reminders for challenge ${challengeId}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    challengesChecked: challengesSnap.size,
    participantsReminded,
    notificationsSent,
  });
}
