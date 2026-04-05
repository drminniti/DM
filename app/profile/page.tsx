'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserProfile } from '@/lib/users';

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError('');
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No user');

      // Re-authenticate first (Firebase requires this for sensitive operations)
      try {
        await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      } catch {
        // If re-auth fails or is dismissed, abort
        setDeleting(false);
        setShowConfirm(false);
        setError('Re-autenticación cancelada. Intentá de nuevo.');
        return;
      }

      // Call API to delete Firestore data + Auth account
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.uid }),
      });

      if (!res.ok) throw new Error('Error al eliminar la cuenta');

      // Clear local auth state and redirect
      await signOut();
      router.replace('/login');
    } catch (err) {
      setError('Error al eliminar la cuenta. Intentá de nuevo.');
      console.error(err);
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="app-container">
      <header className="page-header">
        <div>
          <Link href="/" className="text-muted text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            ← Mis desafíos
          </Link>
          <h1 className="page-title" style={{ fontSize: '1.75rem' }}>Mi Perfil</h1>
        </div>
      </header>

      {/* Avatar + info */}
      <div className="card mb-6" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt="Avatar"
            style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--color-surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', fontWeight: 700, flexShrink: 0,
              color: 'var(--color-accent)',
            }}
          >
            {user.displayName?.charAt(0).toUpperCase() ?? '?'}
          </div>
        )}
        <div>
          <p className="font-bold" style={{ fontSize: '1.125rem' }}>{user.displayName ?? '—'}</p>
          <p className="text-muted text-sm mt-2">{user.email ?? '—'}</p>
        </div>
      </div>

      {/* Gamification Shelf */}
      {userProfile && (
        <div className="card mb-6" style={{ background: 'linear-gradient(135deg, rgba(255,160,0,0.1), rgba(255,87,34,0.05))', borderColor: 'rgba(255,160,0,0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Puntos Globales</p>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>
              {userProfile.points}
            </div>
          </div>
          
          <h3 className="text-sm font-semibold mb-4 text-center">Tus Insignias</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <BadgeItem 
               icon="🥉" 
               name="Víspera" 
               days="7D" 
               count={userProfile.badges?.['7_DAYS'] || 0} 
            />
            <BadgeItem 
               icon="🥈" 
               name="Creciente" 
               days="21D" 
               count={userProfile.badges?.['21_DAYS'] || 0} 
            />
            <BadgeItem 
               icon="🥇" 
               name="Eterno" 
               days="30D" 
               count={userProfile.badges?.['30_DAYS'] || 0} 
            />
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="mb-4">
        <button
          id="signout-btn"
          className="btn btn-secondary"
          onClick={handleSignOut}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Delete account */}
      {!showConfirm ? (
        <button
          className="btn btn-ghost"
          style={{ color: 'var(--color-danger)', width: 'auto', margin: '0 auto' }}
          onClick={() => setShowConfirm(true)}
        >
          Eliminar cuenta
        </button>
      ) : (
        <div
          className="card"
          style={{ borderColor: 'var(--color-danger)', marginTop: 8 }}
        >
          <p className="font-semibold" style={{ marginBottom: 8 }}>
            ⚠️ ¿Estás seguro?
          </p>
          <p className="text-muted text-sm" style={{ marginBottom: 16, lineHeight: 1.5 }}>
            Se eliminarán tu cuenta y todos tus datos de participación. Esta acción no se puede deshacer.
            Se te pedirá que confirmes con Google.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setShowConfirm(false)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              className="btn"
              style={{
                flex: 1,
                background: 'rgba(255,68,68,0.15)',
                color: 'var(--color-danger)',
                border: '1px solid var(--color-danger)',
              }}
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? <span className="spinner" /> : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: 16, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function BadgeItem({ icon, name, days, count }: { icon: string; name: string; days: string; count: number }) {
    const isUnlocked = count > 0;
    return (
        <div style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            background: isUnlocked ? 'var(--color-surface-2)' : 'rgba(255,255,255,0.02)',
            padding: '16px 8px', borderRadius: 12,
            border: isUnlocked ? '1px solid rgba(255,255,255,0.1)' : '1px dashed rgba(255,255,255,0.05)',
            opacity: isUnlocked ? 1 : 0.4,
            position: 'relative'
        }}>
            <div style={{ fontSize: '2rem', marginBottom: 8, filter: isUnlocked ? 'none' : 'grayscale(100%)' }}>
                {icon}
            </div>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>{name}</p>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{days}</span>
            
            {isUnlocked && (
                <div style={{
                    position: 'absolute', top: -6, right: -6,
                    background: 'var(--color-primary)', color: '#000',
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,230,118,0.4)'
                }}>
                    x{count}
                </div>
            )}
        </div>
    );
}
