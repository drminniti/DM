import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
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
}

export interface DailyLog {
    id: string;
    participantId: string;
    challengeId: string;
    date: string; // YYYY-MM-DD
    isCompleted: boolean;
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

    const challengeIds = [...new Set(pSnap.docs.map((d) => d.data().challengeId as string))];

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
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Participant;
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
