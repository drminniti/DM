'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import {
  getUserChallenges,
  getParticipantByUser,
  getTodayLog,
  Challenge,
} from '@/lib/challenges';
import ChallengeCard from '@/components/ChallengeCard';

interface ChallengeWithMeta {
  challenge: Challenge;
  streak: number;
  completedToday: boolean;
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<ChallengeWithMeta[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const list = await getUserChallenges(user.uid);
      const withMeta = await Promise.all(
        list.map(async (ch) => {
          const participant = await getParticipantByUser(ch.id, user.uid);
          const streak = participant?.currentStreak ?? 0;
          let completedToday = false;
          if (participant) {
            const log = await getTodayLog(participant.id, ch.id);
            completedToday = log?.isCompleted ?? false;
          }
          return { challenge: ch, streak, completedToday };
        })
      );
      setChallenges(withMeta);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  if (loading || !user) return null;

  const active = challenges.filter((c) => c.challenge.status === 'ACTIVE');

  return (
    <div className="app-container">
      <header className="page-header" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Mis Desafíos</h1>
          <p className="page-subtitle">
            Hola, {user.displayName?.split(' ')[0] ?? 'Campeón'} 👋
          </p>
        </div>
        <Link href="/profile" style={{ display: 'block', flexShrink: 0 }}>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt="Perfil"
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-surface-2)' }}
            />
          ) : (
            <div
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--color-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.25rem', fontWeight: 600,
                color: 'var(--color-accent)',
                border: '2px solid transparent',
              }}
            >
              {user.displayName?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )}
        </Link>
      </header>

      {fetching ? (
        <div className="flex items-center" style={{ justifyContent: 'center', flex: 1, gap: 12 }}>
          <span className="spinner" />
          <span className="text-muted">Cargando...</span>
        </div>
      ) : active.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 16,
            paddingBottom: 80,
          }}
        >
          <div style={{ fontSize: '3.5rem' }}>🎯</div>
          <p className="font-bold" style={{ fontSize: '1.125rem' }}>
            Sin desafíos activos
          </p>
          <p className="text-muted text-sm">Crea uno nuevo o únete con un enlace.</p>
        </div>
      ) : (
        <div
          className="flex flex-col"
          style={{ gap: 12, flex: 1 }}
        >
          {active.map(({ challenge, streak, completedToday }) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              streak={streak}
              completedToday={completedToday}
            />
          ))}
        </div>
      )}

      <div
        style={{
          padding: '24px 0 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <Link href="/create" className="btn btn-primary" id="create-challenge-btn">
          + Crear Desafío
        </Link>
      </div>
    </div>
  );
}
