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
  getChallengeProgress,
} from '@/lib/challenges';
import ChallengeCard from '@/components/ChallengeCard';
import BottomNav from '@/components/BottomNav';

interface ChallengeWithMeta {
  challenge: Challenge;
  streak: number;
  completedToday: boolean;
  isEliminated: boolean;
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
          const isEliminated = participant?.isEliminated ?? false;
          let completedToday = false;
          if (participant) {
            const log = await getTodayLog(participant.id, ch.id);
            completedToday = log?.isCompleted ?? false;
          }
          return { challenge: ch, streak, completedToday, isEliminated };
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

  const active = challenges.filter(({ challenge, streak, completedToday }) => {
    if (challenge.status === 'COMPLETED') return false;
    const { isFinished } = getChallengeProgress(challenge, streak, completedToday);
    return !isFinished;
  });

  const finished = challenges.filter(({ challenge, streak, completedToday }) => {
    if (challenge.status === 'COMPLETED') return true;
    const { isFinished } = getChallengeProgress(challenge, streak, completedToday);
    return isFinished;
  });

  // Group active challenges by mode
  const groups: { mode: string; icon: string; label: string; accent?: string; items: typeof active }[] = [
    {
      mode: 'SURVIVAL',
      icon: '☠️',
      label: 'Supervivencia',
      accent: '#ff3b30',
      items: active.filter(c => c.challenge.mode === 'SURVIVAL'),
    },
    {
      mode: 'INDIVIDUAL',
      icon: '🧑',
      label: 'Individual',
      items: active.filter(c => c.challenge.mode === 'INDIVIDUAL'),
    },
    {
      mode: 'TEAM',
      icon: '👥',
      label: 'Equipo',
      items: active.filter(c => c.challenge.mode === 'TEAM'),
    },
  ].filter(g => g.items.length > 0);

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
      ) : (
        <>
          {/* Active challenges grouped by mode */}
          {active.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 16,
                paddingBottom: 24,
                paddingTop: 24,
              }}
            >
              <div style={{ fontSize: '3.5rem' }}>🎯</div>
              <p className="font-bold" style={{ fontSize: '1.125rem' }}>
                Sin desafíos activos
              </p>
              <p className="text-muted text-sm">Crea uno nuevo o únete con un enlace.</p>
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: 28, flex: 1 }}>
              {groups.map(({ mode, icon, label, accent, items }) => (
                <div key={mode}>
                  {/* Section header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: `1px solid ${accent ? 'rgba(255,59,48,0.25)' : 'var(--color-border)'}`,
                  }}>
                    <span style={{ fontSize: '1rem' }}>{icon}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: accent ?? 'var(--color-text-muted)',
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: accent ?? 'var(--color-text-muted)',
                      background: accent ? 'rgba(255,59,48,0.1)' : 'var(--color-surface-2)',
                      borderRadius: 99,
                      padding: '1px 8px',
                      marginLeft: 2,
                    }}>
                      {items.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="flex flex-col" style={{ gap: 12 }}>
                    {items.map(({ challenge, streak, completedToday, isEliminated }) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        streak={streak}
                        completedToday={completedToday}
                        isEliminated={isEliminated}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Finished challenges — collapsible section */}
          {finished.length > 0 && (
            <details style={{ marginTop: 32 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-muted)',
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-border)',
                  userSelect: 'none',
                }}
              >
                <span style={{ transition: 'transform 0.2s' }}>▶</span>
                Finalizados ({finished.length})
              </summary>
              <div className="flex flex-col" style={{ gap: 12, marginTop: 12 }}>
                {finished.map(({ challenge, streak, completedToday, isEliminated }) => {
                  // Estimate points earned: 5 pts per completed day (streak as proxy)
                  // This matches addDailyPoints (+5 per day in lib/users.ts)
                  const pointsEarned = streak * 5;
                  return (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      streak={streak}
                      completedToday={completedToday}
                      isEliminated={isEliminated}
                      isFinished
                      pointsEarned={pointsEarned}
                    />
                  );
                })}
              </div>
            </details>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}
