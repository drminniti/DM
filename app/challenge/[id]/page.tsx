'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import {
  getParticipantByUser,
  Challenge,
  Participant,
  subscribeToChallenge,
  subscribeToParticipants,
  subscribeToTodayLogs,
} from '@/lib/challenges';
import CompleteButton from '@/components/CompleteButton';
import ParticipantList from '@/components/ParticipantList';
import StreakBadge from '@/components/StreakBadge';
import NotificationButton from '@/components/NotificationButton';

export default function ChallengePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Track how many listeners have fired at least once
  const readyRef = useRef({ challenge: false, participants: false, logs: false });

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Load current user's participant record once (doesn't need real-time)
  useEffect(() => {
    if (!user || !id) return;
    getParticipantByUser(id, user.uid).then(setMyParticipant);
  }, [user, id]);

  // Real-time listeners
  useEffect(() => {
    if (!id) return;

    function checkReady() {
      const { challenge, participants, logs } = readyRef.current;
      if (challenge && participants && logs) setInitialLoading(false);
    }

    const unsubChallenge = subscribeToChallenge(id, (ch) => {
      setChallenge(ch);
      readyRef.current.challenge = true;
      checkReady();
    });

    const unsubParticipants = subscribeToParticipants(id, (parts) => {
      setParticipants(parts);
      readyRef.current.participants = true;
      checkReady();

      // Keep myParticipant in sync with live streak updates
      if (user) {
        const mine = parts.find((p) => p.userId === user.uid) ?? null;
        setMyParticipant(mine);
      }
    });

    const unsubLogs = subscribeToTodayLogs(id, (ids) => {
      setCompletedIds(ids);
      readyRef.current.logs = true;
      checkReady();
    });

    return () => {
      unsubChallenge();
      unsubParticipants();
      unsubLogs();
    };
  }, [id, user]);

  if (loading || initialLoading || !user) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
        <p className="text-muted">Cargando...</p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <p className="font-bold">Desafío no encontrado.</p>
        <Link href="/" className="btn btn-secondary" style={{ marginTop: 24, display: 'inline-flex' }}>
          ← Inicio
        </Link>
      </div>
    );
  }

  const daysSince = Math.floor(
    (Date.now() - (challenge.createdAt?.toMillis?.() ?? Date.now())) / (1000 * 60 * 60 * 24)
  );
  const currentDay = Math.min(daysSince + 1, challenge.totalDays);
  const daysLeft = challenge.totalDays - daysSince;
  const progress = currentDay / challenge.totalDays;

  const completedToday = myParticipant ? completedIds.has(myParticipant.id) : false;

  // Team streak = minimum streak among all participants
  const teamStreak =
    challenge.mode === 'TEAM' && participants.length > 0
      ? Math.min(...participants.map((p) => p.currentStreak))
      : myParticipant?.currentStreak ?? 0;

  const notJoined = !myParticipant;

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/join/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="page-header">
        <div style={{ flex: 1 }}>
          <Link href="/" className="text-muted text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            ← Mis desafíos
          </Link>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
            {challenge.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-muted text-sm">
              {challenge.mode === 'TEAM' ? '👥 Equipo' : '🧑 Individual'}
            </span>
            <span className="text-muted text-sm">·</span>
            <span className="text-muted text-sm">
              Día {currentDay} de {challenge.totalDays}
            </span>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="mb-6">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-muted text-xs">{Math.round(progress * 100)}% completado</span>
          <span className="text-muted text-xs">
            {daysLeft > 0 ? `${daysLeft} días restantes` : '¡Terminado!'}
          </span>
        </div>
      </div>

      {/* Live streak card */}
      <div className="card mb-6" style={{ textAlign: 'center', padding: '24px 0' }}>
        {challenge.mode === 'TEAM' ? (
          <>
            <div className="text-muted text-sm mb-4">Racha del equipo</div>
            <StreakBadge streak={teamStreak} size="lg" />
            <div className="text-muted text-xs mt-4">
              {completedIds.size}/{participants.length} completaron hoy
            </div>
          </>
        ) : (
          <>
            <div className="text-muted text-sm mb-4">Tu racha personal</div>
            <StreakBadge streak={myParticipant?.currentStreak ?? 0} size="lg" />
          </>
        )}
      </div>

      {/* Main action button */}
      {notJoined ? (
        <Link href={`/join/${id}`} className="btn btn-primary btn-xl mb-6">
          Unirme al desafío
        </Link>
      ) : (
        <div className="mb-6">
          <CompleteButton
            challengeId={id}
            participantId={myParticipant.id}
            alreadyDone={completedToday}
            onComplete={() => {/* onSnapshot handles the update automatically */}}
          />
        </div>
      )}

      {/* Notification opt-in */}
      {myParticipant && (
        <div className="mb-6">
          <NotificationButton participantId={myParticipant.id} />
        </div>
      )}

      {/* Invite link */}
      <div className="mb-8">
        <p className="text-muted text-xs mb-3">Invitar amigos:</p>
        <div className="invite-box">
          <span className="invite-url">
            {typeof window !== 'undefined' ? `${window.location.origin}/join/${id}` : `/join/${id}`}
          </span>
          <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopyInvite}>
            {copied ? '✓' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Live participants leaderboard */}
      <div className="mb-10">
        <h2
          style={{
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-muted)',
            marginBottom: 16,
            fontWeight: 600,
          }}
        >
          Participantes ({participants.length})
        </h2>
        <ParticipantList participants={participants} currentUserId={user.uid} completedIds={completedIds} />
      </div>
    </div>
  );
}
