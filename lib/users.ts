import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
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
            createdAt: Date.now(),
        };
        await setDoc(userRef, newUser);
    }
}

export type BadgeType = '7_DAYS' | '21_DAYS' | '30_DAYS';

/**
 * Awards a badge to the user and increments their global points.
 *
 * NOTE: We must use updateDoc (not setDoc+merge) for nested field updates.
 * setDoc+merge with dot-notation keys (e.g. "badges.7_DAYS") creates a flat
 * root-level field instead of updating the nested `badges` map, which is why
 * the badge counter never incremented even though points did.
 */
export async function awardBadgeAndPoints(uid: string, badgeType: BadgeType): Promise<void> {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', uid);

    // Guarantee the document exists with the full badges structure before incrementing
    await ensureUserProfile(uid);

    const pointsToAdd = badgeType === '7_DAYS' ? 50 : badgeType === '21_DAYS' ? 150 : 300;

    // updateDoc with dot-notation correctly targets the nested badges.<type> field
    await updateDoc(userRef, {
        points: increment(pointsToAdd),
        [`badges.${badgeType}`]: increment(1),
    });
}
