'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { reauthenticateWithPopup, GoogleAuthProvider, deleteUser } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

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
