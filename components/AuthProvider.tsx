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

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Start as true — don't render anything until both
  // onAuthStateChanged AND getRedirectResult have resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let authStateResolved = false;
    let redirectResolved = false;
    let latestUser: User | null = null;

    function maybeFinish() {
      if (authStateResolved && redirectResolved) {
        setUser(latestUser);
        setLoading(false);
      }
    }

    // 1. Listen for auth state changes
    const unsub = onAuthStateChanged(auth, (u) => {
      latestUser = u;
      authStateResolved = true;
      maybeFinish();
    });

    // 2. Process pending redirect result (runs after page reload from signInWithRedirect)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          // Redirect sign-in succeeded — use this user immediately
          latestUser = result.user;
          authStateResolved = true; // treat as resolved too
        }
      })
      .catch(() => {
        // No redirect in progress — safe to ignore
      })
      .finally(() => {
        redirectResolved = true;
        maybeFinish();
      });

    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      // Try popup first (instant UX, works on desktop)
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // Popup blocked / not supported → full-page redirect (Safari, mobile, strict browsers)
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
