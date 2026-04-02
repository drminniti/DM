import { getMessaging, getToken } from 'firebase/messaging';
import { getFirebaseApp } from './firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Request notification permission and return the FCM token, or null if denied. */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (err) {
    console.error('FCM token error:', err);
    return null;
  }
}

/** Get current FCM token without prompting (returns null if not granted). */
export async function getCurrentFcmToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch {
    return null;
  }
}
