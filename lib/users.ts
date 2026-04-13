import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

export interface UserProfile {
    uid: string;
    points: number;
    displayName?: string;
    photoURL?: string;
    badges: {
        '7_DAYS': number;
        '21_DAYS': number;
        '30_DAYS': number;
        'SURVIVOR': number;
    };
    createdAt: number;
}

/**
 * Ensures a user profile exists in the `users` collection, and patches missing presentation info.
 */
export async function ensureUserProfile(uid: string, displayName?: string, photoURL?: string): Promise<void> {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const newUser: UserProfile = {
            uid,
            points: 0,
            displayName: displayName || 'Jugador',
            photoURL: photoURL || '',
            badges: {
                '7_DAYS': 0,
                '21_DAYS': 0,
                '30_DAYS': 0,
                'SURVIVOR': 0,
            },
            createdAt: Date.now(),
        };
        await setDoc(userRef, newUser);
    } else {
        const data = snap.data();
        const updates: Record<string, any> = {};
        
        if (displayName && data.displayName !== displayName) updates.displayName = displayName;
        if (photoURL && data.photoURL !== photoURL) updates.photoURL = photoURL;
        
        // Fix for legacy users who have absolutely no displayName field
        if (!data.displayName && displayName) updates.displayName = displayName;

        if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
        }
    }
}

export type BadgeType = '7_DAYS' | '21_DAYS' | '30_DAYS' | 'SURVIVOR';

/**
 * Awards a badge to the user and increments their global points.
 */
export async function awardBadgeAndPoints(uid: string, badgeType: BadgeType, customPoints?: number): Promise<void> {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', uid);

    await ensureUserProfile(uid);

    let pointsToAdd = 0;
    if (customPoints !== undefined) {
        pointsToAdd = customPoints;
    } else {
        pointsToAdd = badgeType === '7_DAYS' ? 50 : badgeType === '21_DAYS' ? 150 : badgeType === '30_DAYS' ? 300 : 0;
    }

    await updateDoc(userRef, {
        points: increment(pointsToAdd),
        [`badges.${badgeType}`]: increment(1),
    });
}

/**
 * Adds daily points and updates user profile info for the leaderboard
 */
export async function addDailyPoints(uid: string, displayName?: string, photoURL?: string): Promise<void> {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', uid);
    
    await ensureUserProfile(uid, displayName, photoURL);

    const updates: Record<string, any> = {
        points: increment(5),
    };
    if (displayName) updates.displayName = displayName;
    if (photoURL) updates.photoURL = photoURL;

    await updateDoc(userRef, updates);
}

