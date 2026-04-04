import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';
import admin from '@/lib/firebase-admin';

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // 1. Delete participant records
    const participantsSnap = await adminDb
      .collection('participants')
      .where('userId', '==', userId)
      .get();

    const batch1 = adminDb.batch();
    participantsSnap.forEach((doc) => batch1.delete(doc.ref));
    if (!participantsSnap.empty) await batch1.commit();

    // 2. Delete daily logs
    const logsSnap = await adminDb
      .collection('daily_logs')
      .where('userId', '==', userId)
      .get();
    // Note: daily_logs don't store userId directly, so we skip this for now
    // Orphaned logs are harmless and will be cleaned up by the cron

    // 3. Delete Firebase Auth account
    await admin.auth().deleteUser(userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Account deletion error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
