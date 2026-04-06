import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

export interface UserProfile {
    uid: string;
    points: number;
    badges: {
        '7_DAYS': number;
        '21_DAYS': number;
        '30_DAYS': number;
    };
    createdAt: number;
}

/**
 * Ensures a user profile exists in the `users` collection.
 */
export async function ensureUserProfile(uid: string): Promise<void> {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        const newUser: UserProfile = {
            uid,
            points: 0,
            badges: {
                '7_DAYS': 0,
                '21_DAYS': 0,
                '30_DAYS': 0,
            },
            createdAt: Date.now()
        };
        await setDoc(userRef, newUser);
    }
}

export type BadgeType = '7_DAYS' | '21_DAYS' | '30_DAYS';

/**
 * Awards a badge to the user and increments their global points.
 * Uses setDoc with merge:true to safely handle any existing document structure.
 */
export async function awardBadgeAndPoints(uid: string, badgeType: BadgeType): Promise<void> {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', uid);

    // Ensure document exists with proper structure first
    await ensureUserProfile(uid);

    const pointsToAdd = badgeType === '7_DAYS' ? 50 : badgeType === '21_DAYS' ? 150 : 300;

    // Use setDoc with merge so it works even if the document structure differs slightly
    await setDoc(userRef, {
        points: increment(pointsToAdd),
        [`badges.${badgeType}`]: increment(1),
    }, { merge: true });
}
