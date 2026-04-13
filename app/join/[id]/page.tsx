'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getChallenge, joinChallenge } from '@/lib/challenges';

type Stage =
  | 'loading'      // auth or challenge not yet resolved
  | 'joining'      // running joinChallenge + about to redirect
  | 'needs-login'  // confirmed: no session, must sign in
  | 'error';

export default function JoinPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [challengeName, setChallengeName] = useState('');
  const [stage, setStage] = useState<Stage>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch challenge name once
  useEffect(() => {
    if (!id) return;
    getChallenge(id)
      .then((ch) => {
        if (!ch) {
          setErrorMsg('Desafío no encontrado.');
          setStage('error');
        } else {
          setChallengeName(ch.name);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch challenge name (likely needs login):', err);
        // We set a generic name so the Join flow can continue to the Login screen
        setChallengeName('este desafío de fitness');
      });
  }, [id]);

  const doJoin = useCallback(async () => {
    if (!user || !id) return;
    setStage('joining');
    try {
      await joinChallenge(id, user.uid, user.displayName ?? 'Jugador');
      router.replace(`/challenge/${id}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'TOO_LATE') {
        setErrorMsg('El desafío ya comenzó. No puedes unirte después del Día 1.');
      } else {
        setErrorMsg('Error al unirte. Intenta de nuevo.');
      }
      setStage('error');
    }
  }, [user, id, router]);

  /**
   * Main decision logic — runs whenever auth or challengeName settle.
   * We only advance out of 'loading' when BOTH are resolved:
   *   - auth: !loading (AuthProvider finished)
   *   - challenge: challengeName is set (or error stage was set)
   */
  useEffect(() => {
    if (stage === 'joining' || stage === 'error') return; // already decided

    const authReady = !loading;
    const challengeReady = challengeName !== '';

    if (!authReady || !challengeReady) return; // still waiting

    setTimeout(() => {
      if (user) {
        // Session exists → join immediately (no login screen shown)
        doJoin();
      } else {
        // Confirmed no session → show login button
        setStage('needs-login');
      }
    }, 0);
  }, [loading, user, challengeName, stage, doJoin]);

  const handleSignIn = async () => {
    setStage('loading'); // show spinner while auth resolves
    try {
      await signInWithGoogle();
      // If popup: auth is done, user is set, the effect above will run doJoin
      // If redirect: page navigates away — will return with user set
    } catch {
      setStage('needs-login');
    }
  };

  // ---- RENDER ----

  if (stage === 'error') {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>😕</div>
        <p className="font-bold">{errorMsg}</p>
      </div>
    );
  }

  if (stage === 'loading' || stage === 'joining') {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p className="text-muted">
          {stage === 'joining' ? 'Uniéndote al desafío...' : 'Cargando...'}
        </p>
      </div>
    );
  }

  // stage === 'needs-login'
  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🤝</div>
        <h1 className="page-title" style={{ marginBottom: 8, fontSize: '1.5rem' }}>
          Te invitaron a un desafío
        </h1>
        {challengeName && (
          <p className="font-bold text-accent" style={{ fontSize: '1.1rem', marginBottom: 24 }}>
            &ldquo;{challengeName}&rdquo;
          </p>
        )}
        <p className="text-muted text-sm" style={{ marginBottom: 32 }}>
          Iniciá sesión para unirte automáticamente.
        </p>
        <button
          id="join-google-btn"
          className="btn btn-primary"
          onClick={handleSignIn}
          style={{ gap: 12 }}
        >
          Continuar con Google →
        </button>
      </div>
    </div>
  );
}
