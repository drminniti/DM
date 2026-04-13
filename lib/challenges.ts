import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { awardBadgeAndPoints, BadgeType } from './users';

export type ChallengeMode = 'TEAM' | 'INDIVIDUAL' | 'SURVIVAL';
export type ChallengeStatus = 'ACTIVE' | 'COMPLETED';

export interface Challenge {
    id: string;
    name: string;
    totalDays: number;
    mode: ChallengeMode;
    creatorId: string;
    createdAt: Timestamp;
    status: ChallengeStatus;
    timezone?: string; // The official timezone of this challenge
    pot?: number; // Total points bet in SURVIVAL mode
}

export interface Participant {
    id: string;
    challengeId: string;
    userId: string;
    playerName: string;
    currentStreak: number;
    fcmToken?: string;
    isArchived?: boolean;
    isEliminated?: boolean;
}

export interface DailyLog {
    id: string;
    participantId: string;
    challengeId: string;
    date: string; // YYYY-MM-DD
    isCompleted: boolean;
}

export function getChallengeProgress(
    challenge: Challenge,
    highestStreak: number,
    completedToday: boolean
) {
    const createdDate = challenge.createdAt?.toDate?.() || new Date();
    // Use the challenge's timezone to calculate days consistently for all participants
    const tz = challenge.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const createdDayText = createdDate.toLocaleDateString('en-CA', { timeZone: tz });
    const todayText = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    
    const createdTz = new Date(createdDayText + 'T00:00:00');
    const todayTz = new Date(todayText + 'T00:00:00');
    
    const calendarDaysElapsed = Math.round((todayTz.getTime() - createdTz.getTime()) / (1000 * 60 * 60 * 24));

    // currentDay label = calendar elapsed + 1 (capped at totalDays)
    const currentDay = Math.min(calendarDaysElapsed + 1, challenge.totalDays);

    // Progress bar = days actually COMPLETED (streak), not just elapsed.
    // This way Day 1 starts at 0% and moves only when you press the button.
    const progress = Math.min(highestStreak / challenge.totalDays, 1);

    const isFinished = highestStreak >= challenge.totalDays && completedToday;
    const daysLeft = isFinished ? 0 : Math.max(0, challenge.totalDays - calendarDaysElapsed);

    return {
        currentDay,
        daysLeft,
        progress,
        isFinished,
    };
}

export function getChallengeDates(createdAt: unknown, totalDays: number, timezone?: string): string[] {
    const createdDate = (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt && typeof createdAt.toDate === 'function') ? createdAt.toDate() : new Date(createdAt as string | number);
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const createdDayText = createdDate.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
    const startTz = new Date(createdDayText + 'T00:00:00');
    
    const dates = [];
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startTz.getTime() + i * 1000 * 60 * 60 * 24);
        dates.push(d.toLocaleDateString('en-CA')); // startTz is explicitly constructed to avoid timezone shifting here
    }
    return dates;
}

// ---------- CHALLENGES ----------

export async function createChallenge(
    name: string,
    totalDays: number,
    mode: ChallengeMode,
    userId: string
): Promise<string> {
    const db = getFirebaseDb();
    const data: any = {
        name,
        totalDays,
        mode,
        creatorId: userId,
        createdAt: serverTimestamp(),
        status: 'ACTIVE',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (mode === 'SURVIVAL') {
        data.pot = 0;
    }
    const ref = await addDoc(collection(db, 'challenges'), data);
    return ref.id;
}

export async function getChallenge(challengeId: string): Promise<Challenge | null> {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, 'challenges', challengeId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Challenge;
}

export async function getUserChallenges(userId: string): Promise<Challenge[]> {
    const db = getFirebaseDb();
    const pSnap = await getDocs(
        query(collection(db, 'participants'), where('userId', '==', userId))
    );
    if (pSnap.empty) return [];

    const activeParticipantDocs = pSnap.docs.filter((d) => d.data().isArchived !== true);
    if (activeParticipantDocs.length === 0) return [];

    const challengeIds = [...new Set(activeParticipantDocs.map((d) => d.data().challengeId as string))];

    const challenges = await Promise.all(challengeIds.map((id) => getChallenge(id)));
    return challenges.filter(Boolean) as Challenge[];
}

// ---------- PARTICIPANTS ----------

export async function joinChallenge(
    challengeId: string,
    userId: string,
    playerName: string
): Promise<string> {
    const db = getFirebaseDb();
    const existing = await getDocs(
        query(
            collection(db, 'participants'),
            where('challengeId', '==', challengeId),
            where('userId', '==', userId)
        )
    );
    if (!existing.empty) return existing.docs[0].id;

    const cSnap = await getDoc(doc(db, 'challenges', challengeId));
    if (!cSnap.exists()) throw new Error('Challenge not found');
    const challengeData = cSnap.data() as Challenge;

    if (challengeData.mode === 'SURVIVAL') {
        // Entry is free. Pot will be calculated automatically at the end by the Cron.
    }

    const ref = await addDoc(collection(db, 'participants'), {
        challengeId,
        userId,
        playerName,
        currentStreak: 0,
        fcmToken: '',
        isEliminated: false
    });
    return ref.id;
}

export async function getParticipants(challengeId: string): Promise<Participant[]> {
    const db = getFirebaseDb();
    const snap = await getDocs(
        query(collection(db, 'participants'), where('challengeId', '==', challengeId))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Participant));
}

export async function getParticipantByUser(
    challengeId: string,
    userId: string
): Promise<Participant | null> {
    const db = getFirebaseDb();
    const snap = await getDocs(
        query(
            collection(db, 'participants'),
            where('challengeId', '==', challengeId),
            where('userId', '==', userId)
        )
    );
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    if (data.isArchived) return null; // Treat archived as if not joined
    return { id: snap.docs[0].id, ...data } as Participant;
}

export async function archiveParticipant(participantId: string): Promise<void> {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'participants', participantId), { isArchived: true });
}

export async function kickParticipant(
    challengeId: string,
    participantId: string,
    creatorUserId: string
): Promise<void> {
    const res = await fetch('/api/challenge/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, participantIdToKick: participantId, creatorUserId }),
    });

    if (!res.ok) {
        throw new Error('Failed to kick participant');
    }
}

export async function updateParticipantFcmToken(participantId: string, token: string) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'participants', participantId), { fcmToken: token });
}

// ---------- DAILY LOGS ----------

export function todayString(timezone?: string): string {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
}

export async function getTodayLog(
    participantId: string,
    challengeId: string
): Promise<DailyLog | null> {
    const db = getFirebaseDb();
    // Assuming the challenge timezone is what matters. Since getTodayLog is called less often,
    // we'll pass the timezone of the challenge if known, otherwise fallback.
    // Wait, getTodayLog isn't currently receiving the challenge's timezone.
    // It's mainly safe because we subscribe in real-time now via subscribeToTodayLogs.
    const snap = await getDocs(
        query(
            collection(db, 'daily_logs'),
            where('participantId', '==', participantId),
            where('challengeId', '==', challengeId),
            where('date', '==', todayString())
        )
    );
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as DailyLog;
}

export async function markDayComplete(
    challengeId: string,
    participantId: string,
    timezone?: string
): Promise<BadgeType | null> {
    const db = getFirebaseDb();
    const today = todayString(timezone);

    const existing = await getDocs(
        query(
            collection(db, 'daily_logs'),
            where('participantId', '==', participantId),
            where('challengeId', '==', challengeId),
            where('date', '==', today)
        )
    );

    let alreadyCompleted = false;

    if (existing.empty) {
        await addDoc(collection(db, 'daily_logs'), {
            participantId,
            challengeId,
            date: today,
            isCompleted: true,
        });
    } else {
        alreadyCompleted = existing.docs[0].data().isCompleted;
        if (!alreadyCompleted) {
            await updateDoc(doc(db, 'daily_logs', existing.docs[0].id), {
                isCompleted: true,
            });
        }
    }

    // Evaluate and mathematically cap the streak so it never exceeds totalDays
    const pSnap = await getDoc(doc(db, 'participants', participantId));
    const cSnap = await getDoc(doc(db, 'challenges', challengeId));
    
    if (pSnap.exists() && cSnap.exists()) {
        if (pSnap.data().isEliminated) return null; // Eliminated players cannot act

        const current = (pSnap.data().currentStreak as number) || 0;
        const totalDays = (cSnap.data().totalDays as number) || 1000;
        
        if (!alreadyCompleted) {
            // Increment logic capped at totalDays
            const newStreak = Math.min(current + 1, totalDays);
            await updateDoc(doc(db, 'participants', participantId), {
                currentStreak: newStreak,
            });

            const userId: string = pSnap.data().userId;
            const playerName: string = pSnap.data().playerName || '';

            if (userId) {
                // IMPORTANT: Wait for the dynamic import to avoid circular dependency issues
                // or just call it directly since we import it at the top
                const { addDailyPoints, awardBadgeAndPoints } = await import('./users');
                
                // Get the user from auth to pass the photoURL if possible
                // since we don't have it directly in the participant doc easily
                // For now we just pass playerName. photoURL will be fetched by other processes or left blank
                await addDailyPoints(userId, playerName);

                // Gamification Engine: Award Badges based on the newly reached streak
                let badgeEarned: BadgeType | null = null;
                if (newStreak === 7)  { await awardBadgeAndPoints(userId, '7_DAYS');  badgeEarned = '7_DAYS'; }
                if (newStreak === 21) { await awardBadgeAndPoints(userId, '21_DAYS'); badgeEarned = '21_DAYS'; }
                if (newStreak === 30) { await awardBadgeAndPoints(userId, '30_DAYS'); badgeEarned = '30_DAYS'; }
                
                return badgeEarned;
            }
        } else if (current > totalDays) {
            // Self-healing mechanism
            await updateDoc(doc(db, 'participants', participantId), {
                currentStreak: totalDays,
            });
        }
    }
    return null;
}

// ---------- REAL-TIME LISTENERS (onSnapshot) ----------

/** Subscribe to live participant updates for a challenge. Returns unsubscribe fn. */
export function subscribeToParticipants(
    challengeId: string,
    callback: (participants: Participant[]) => void
): () => void {
    const db = getFirebaseDb();
    const q = query(collection(db, 'participants'), where('challengeId', '==', challengeId));
    return onSnapshot(q, (snap) => {
        const parts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Participant));
        callback(parts.filter(p => !p.isArchived));
    });
}

/** Subscribe to all historical logs for a challenge. Useful for the compliance grid. */
export function subscribeToAllLogs(
    challengeId: string,
    callback: (logs: DailyLog[]) => void
): () => void {
    const db = getFirebaseDb();
    const q = query(collection(db, 'daily_logs'), where('challengeId', '==', challengeId));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyLog)));
    });
}

/** Subscribe to live challenge document updates. Returns unsubscribe fn. */
export function subscribeToChallenge(
    challengeId: string,
    callback: (challenge: Challenge | null) => void
): () => void {
    const db = getFirebaseDb();
    return onSnapshot(doc(db, 'challenges', challengeId), (snap) => {
        callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Challenge) : null);
    });
}

/** Subscribe to today's daily logs for a challenge. Returns unsubscribe fn. */
export function subscribeToTodayLogs(
    challengeId: string,
    timezone: string | undefined,
    callback: (completedParticipantIds: Set<string>) => void
): () => void {
    const db = getFirebaseDb();
    const today = todayString(timezone);
    const q = query(
        collection(db, 'daily_logs'),
        where('challengeId', '==', challengeId),
        where('date', '==', today),
        where('isCompleted', '==', true)
    );
    return onSnapshot(q, (snap) => {
        const ids = new Set(snap.docs.map((d) => d.data().participantId as string));
        callback(ids);
    });
}
