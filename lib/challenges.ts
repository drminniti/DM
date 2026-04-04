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

export type ChallengeMode = 'TEAM' | 'INDIVIDUAL';
export type ChallengeStatus = 'ACTIVE' | 'COMPLETED';

export interface Challenge {
    id: string;
    name: string;
    totalDays: number;
    mode: ChallengeMode;
    creatorId: string;
    createdAt: Timestamp;
    status: ChallengeStatus;
}

export interface Participant {
    id: string;
    challengeId: string;
    userId: string;
    playerName: string;
    currentStreak: number;
    fcmToken?: string;
    isArchived?: boolean;
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
    // Use local timezone midnight to count discrete calendar days
    const createdDayText = createdDate.toLocaleDateString('en-CA');
    const todayText = new Date().toLocaleDateString('en-CA');
    
    const createdTz = new Date(createdDayText + 'T00:00:00');
    const todayTz = new Date(todayText + 'T00:00:00');
    
    const calendarDaysElapsed = Math.round((todayTz.getTime() - createdTz.getTime()) / (1000 * 60 * 60 * 24));
    
    // Streaks shouldn't logically outpace calendar days elapsed + 1, but if they do 
    // due to timezones, we trust the streak to ensure progress doesn't lag visually.
    const streakDaysElapsed = highestStreak > 0 ? highestStreak - (completedToday ? 1 : 0) : 0;
    
    const effectiveDaysElapsed = Math.max(calendarDaysElapsed, streakDaysElapsed);
    
    const currentDay = Math.min(effectiveDaysElapsed + 1, challenge.totalDays);
    const progress = Math.min(currentDay / challenge.totalDays, 1);
    
    const completedVal = highestStreak >= challenge.totalDays && completedToday;
    let daysLeft = Math.max(0, challenge.totalDays - effectiveDaysElapsed);
    
    if (completedVal) {
        daysLeft = 0;
    }

    return {
        currentDay,
        daysLeft,
        progress,
        isFinished: daysLeft === 0,
    };
}

// ---------- CHALLENGES ----------

export async function createChallenge(
    name: string,
    totalDays: number,
    mode: ChallengeMode,
    userId: string
): Promise<string> {
    const db = getFirebaseDb();
    const ref = await addDoc(collection(db, 'challenges'), {
        name,
        totalDays,
        mode,
        creatorId: userId,
        createdAt: serverTimestamp(),
        status: 'ACTIVE',
    });
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

    const ref = await addDoc(collection(db, 'participants'), {
        challengeId,
        userId,
        playerName,
        currentStreak: 0,
        fcmToken: '',
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

export async function updateParticipantFcmToken(participantId: string, token: string) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'participants', participantId), { fcmToken: token });
}

// ---------- DAILY LOGS ----------

function todayString(): string {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

export async function getTodayLog(
    participantId: string,
    challengeId: string
): Promise<DailyLog | null> {
    const db = getFirebaseDb();
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
    participantId: string
): Promise<void> {
    const db = getFirebaseDb();
    const today = todayString();

    const existing = await getDocs(
        query(
            collection(db, 'daily_logs'),
            where('participantId', '==', participantId),
            where('challengeId', '==', challengeId),
            where('date', '==', today)
        )
    );

    if (existing.empty) {
        await addDoc(collection(db, 'daily_logs'), {
            participantId,
            challengeId,
            date: today,
            isCompleted: true,
        });
    } else {
        await updateDoc(doc(db, 'daily_logs', existing.docs[0].id), {
            isCompleted: true,
        });
    }

    // Increment streak
    const pSnap = await getDoc(doc(db, 'participants', participantId));
    if (pSnap.exists()) {
        const current = (pSnap.data().currentStreak as number) || 0;
        await updateDoc(doc(db, 'participants', participantId), {
            currentStreak: current + 1,
        });
    }
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
    callback: (completedParticipantIds: Set<string>) => void
): () => void {
    const db = getFirebaseDb();
    const today = new Date().toLocaleDateString('en-CA');
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
