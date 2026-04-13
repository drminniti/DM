'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  AuthErrorCodes,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { ensureUserProfile } from '@/lib/users';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let authUnsub: (() => void) | null = null;

    // KEY FIX: First await the redirect result so Firebase updates its
    // internal auth state. THEN subscribe to onAuthStateChanged, which
    // will fire with the correct (post-redirect) user — no race condition.
    getRedirectResult(auth)
      .then((result) => {
        // If there was a pending redirect sign-in, capture the user immediately
        if (result?.user) setUser(result.user);
      })
      .catch(() => {
        // No pending redirect — safe to ignore
      })
      .finally(() => {
        // Subscribe AFTER getRedirectResult— Firebase's internal state is
        // now settled, so the first onAuthStateChanged emission is correct.
        authUnsub = onAuthStateChanged(auth, (u) => {
          setUser(u);
          setLoading(false);
          // Fire-and-forget: ensure user profile exists in db
          if (u) {
            ensureUserProfile(u.uid, u.displayName || '', u.photoURL || '').catch(console.error);
          }
        });
      });

    return () => {
      authUnsub?.();
    };
  }, []);

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // Popup blocked / not supported → fall back to full-page redirect
      if (
        code === AuthErrorCodes.POPUP_BLOCKED ||
        code === AuthErrorCodes.POPUP_CLOSED_BY_USER ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/web-storage-unsupported'
      ) {
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  };

  const signOut = async () => {
    await fbSignOut(getFirebaseAuth());
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
