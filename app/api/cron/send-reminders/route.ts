import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';

/**
 * Cron: /api/cron/send-reminders
 * Schedule: 0 23 * * *  (23:00 UTC = 20:00 Argentina / Buenos Aires, UTC-3)
 *
 * Sends a push notification to every participant who has NOT completed
 * their daily task yet. Each user (identified by userId) gets at most ONE
 * notification, even if they participate in multiple active challenges.
 *
 * Auth: Vercel invokes crons with  Authorization: Bearer <CRON_SECRET>
 * You can also call it manually with ?secret=<CRON_SECRET> for debugging.
 */
export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  // Vercel automatically sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const querySecret = req.nextUrl.searchParams.get('secret');
  const secret = bearerToken ?? querySecret;

  if (secret !== process.env.CRON_SECRET) {
    console.error('[send-reminders] Unauthorized. Received secret:', secret ? '(present but wrong)' : '(missing)');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Firebase check ───────────────────────────────────────────────────────
  if (!adminDb || !adminMessaging) {
    console.error('[send-reminders] Firebase Admin not configured — check FIREBASE_ADMIN_* env vars in Vercel.');
    return NextResponse.json(
      { error: 'Firebase Admin not configured. Check FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in Vercel environment variables.' },
      { status: 500 }
    );
  }

  const now = new Date();
  console.log(`[send-reminders] Running at ${now.toISOString()}`);

  // ── Fetch all active challenges ──────────────────────────────────────────
  const challengesSnap = await adminDb
    .collection('challenges')
    .where('status', '==', 'ACTIVE')
    .get();

  console.log(`[send-reminders] Active challenges: ${challengesSnap.size}`);

  if (challengesSnap.empty) {
    return NextResponse.json({ ok: true, message: 'No active challenges', notificationsSent: 0 });
  }

  /**
   * We deduplicate by userId: each real person gets at most 1 reminder,
   * even if they're in multiple active challenges.
   * Map: userId → { fcmToken, pendingChallenges: string[] }
   */
  const userPending = new Map<string, { fcmToken: string; challenges: string[] }>();

  for (const challengeDoc of challengesSnap.docs) {
    const challengeId = challengeDoc.id;
    const challenge = challengeDoc.data();
    const challengeName = challenge.name as string;
    const tz = (challenge.timezone as string) || 'America/Argentina/Buenos_Aires';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

    console.log(`[send-reminders] Challenge "${challengeName}" (${challengeId}) — today in ${tz}: ${todayStr}`);

    // All non-archived, non-eliminated participants
    const participantsSnap = await adminDb
      .collection('participants')
      .where('challengeId', '==', challengeId)
      .get();

    const activeParts = participantsSnap.docs.filter(
      (d) => !d.data().isArchived && !d.data().isEliminated
    );

    if (activeParts.length === 0) {
      console.log(`[send-reminders]   → No active participants, skipping.`);
      continue;
    }

    // Today's completed logs for this challenge
    const logsSnap = await adminDb
      .collection('daily_logs')
      .where('challengeId', '==', challengeId)
      .where('date', '==', todayStr)
      .where('isCompleted', '==', true)
      .get();

    const completedIds = new Set(logsSnap.docs.map((d) => d.data().participantId as string));
    console.log(`[send-reminders]   → ${completedIds.size}/${activeParts.length} completed today.`);

    for (const partDoc of activeParts) {
      const data = partDoc.data();

      // Skip those who already completed
      if (completedIds.has(partDoc.id)) continue;

      const fcmToken = data.fcmToken as string | undefined;
      const userId = data.userId as string | undefined;

      if (!fcmToken || !userId) {
        console.log(`[send-reminders]   → Participant ${partDoc.id} has no FCM token or userId — skipping.`);
        continue;
      }

      // Accumulate pending challenges per user (for a richer notification body)
      const existing = userPending.get(userId);
      if (existing) {
        existing.challenges.push(challengeName);
      } else {
        userPending.set(userId, { fcmToken, challenges: [challengeName] });
      }
    }
  }

  console.log(`[send-reminders] Users to notify: ${userPending.size}`);

  if (userPending.size === 0) {
    return NextResponse.json({
      ok: true,
      challengesChecked: challengesSnap.size,
      message: 'Everyone already completed their challenge today, or no FCM tokens registered.',
      notificationsSent: 0,
    });
  }

  // ── Send notifications ───────────────────────────────────────────────────
  const tokens = Array.from(userPending.values()).map((v) => v.fcmToken);

  // Build per-token messages (FCM sendEachForMulticast needs a single notification)
  // We send one batch; body will be generic but title mentions the app.
  // For richer per-user bodies we'd need individual sends — keep it simple for now.
  let notificationsSent = 0;
  let tokenErrors = 0;
  const staleTokens: string[] = [];

  try {
    const result = await adminMessaging.sendEachForMulticast({
      notification: {
        title: '🏃 ¡Faltan pocas horas!',
        body: 'Todavía no completaste tu desafío de hoy. ¡Vas a poder!',
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          // vibrate is not in FCM types but some browsers respect it via webpush
        },
        fcmOptions: {
          link: '/',
        },
      },
      tokens,
    });

    notificationsSent = result.successCount;
    tokenErrors = result.failureCount;

    // Collect stale/invalid tokens to clean up
    result.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        console.warn(`[send-reminders] Token[${idx}] failed: ${errorCode}`);
        // registration-token-not-registered or invalid-registration-token → stale
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(tokens[idx]);
        }
      }
    });
  } catch (err) {
    console.error('[send-reminders] FCM sendEachForMulticast error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }

  // ── Clean up stale FCM tokens ────────────────────────────────────────────
  if (staleTokens.length > 0) {
    console.log(`[send-reminders] Cleaning up ${staleTokens.length} stale tokens...`);
    const staleSet = new Set(staleTokens);

    // Find participant docs with stale tokens and clear them
    const allPartsWithTokens = await adminDb
      .collection('participants')
      .where('fcmToken', 'in', [...staleSet].slice(0, 10)) // Firestore 'in' limit: 10
      .get();

    const batch = adminDb.batch();
    allPartsWithTokens.forEach((doc) => {
      batch.update(doc.ref, { fcmToken: '' });
    });
    await batch.commit();
    console.log(`[send-reminders] Cleared ${allPartsWithTokens.size} stale tokens.`);
  }

  console.log(`[send-reminders] Done — sent: ${notificationsSent}, errors: ${tokenErrors}`);

  return NextResponse.json({
    ok: true,
    challengesChecked: challengesSnap.size,
    usersNotified: userPending.size,
    notificationsSent,
    tokenErrors,
    staleTokensCleaned: staleTokens.length,
  });
}
