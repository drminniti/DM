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
            createdAt: Date.now()
        };
        await setDoc(userRef, newUser);
    }
}

/**
 * Awards a badge to the user and increments their global points.
 */
export async function awardBadgeAndPoints(uid: string, badgeType: '7_DAYS' | '21_DAYS' | '30_DAYS'): Promise<void> {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', uid);
    
    // Ensure it exists first, just in case (e.g., old user who never logged in again but completed a cron job, though cron doesn't do this)
    await ensureUserProfile(uid);

    let pointsToAdd = 0;
    if (badgeType === '7_DAYS') pointsToAdd = 50;
    if (badgeType === '21_DAYS') pointsToAdd = 150;
    if (badgeType === '30_DAYS') pointsToAdd = 300;

    await updateDoc(userRef, {
        points: increment(pointsToAdd),
        [`badges.${badgeType}`]: increment(1)
    });
}
