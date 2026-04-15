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
  subscribeToAllLogs,
  getChallengeProgress,
  getChallengeDates,
  archiveParticipant,
  kickParticipant,
  isSurvivalEliminated,
  DailyLog,
} from '@/lib/challenges';
import CompleteButton from '@/components/CompleteButton';
import ParticipantList from '@/components/ParticipantList';
import StreakBadge from '@/components/StreakBadge';
import NotificationButton from '@/components/NotificationButton';
import ChallengeCompletedModal from '@/components/ChallengeCompletedModal';
import ShareButton from '@/components/ShareButton';

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
  const [showEndModal, setShowEndModal] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isKicking, setIsKicking] = useState(false);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);

  // Track how many listeners have fired at least once
  const readyRef = useRef({ challenge: false, participants: false, logs: false, allLogs: false });

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
      const { challenge, participants } = readyRef.current;
      if (challenge && participants) setInitialLoading(false);
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

    const unsubAllLogs = subscribeToAllLogs(id, (logsArray) => {
      setAllLogs(logsArray);
      readyRef.current.allLogs = true;
      checkReady();
    });

    return () => {
      unsubChallenge();
      unsubParticipants();
      unsubAllLogs();
    };
  }, [id, user]);

  useEffect(() => {
    if (!id || !challenge) return;
    const unsubLogs = subscribeToTodayLogs(id, challenge.timezone, (ids) => {
      setCompletedIds(ids);
      readyRef.current.logs = true;
    });
    return () => unsubLogs();
  }, [id, challenge?.timezone]);

  useEffect(() => {
    if (!challenge) return;
    const completedToday = myParticipant ? completedIds.has(myParticipant.id) : false;
    const teamStreak = challenge.mode === 'TEAM' && participants.length > 0
      ? Math.min(...participants.map((p) => p.currentStreak))
      : myParticipant?.currentStreak ?? 0;
    
    const { result } = getChallengeProgress(
      challenge, 
      challenge.mode === 'TEAM' ? teamStreak : (myParticipant?.currentStreak ?? 0), 
      completedToday
    );
    
    // Only show the celebration modal when the player actually WON
    if (result === 'WON' && typeof window !== 'undefined') {
      const storageKey = `seen_finish_${challenge.id}`;
      if (!localStorage.getItem(storageKey)) {
        const timer = setTimeout(() => setShowEndModal(true), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [challenge, participants, completedIds, myParticipant]);

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

  const notJoined = !myParticipant;

  const completedToday = myParticipant ? completedIds.has(myParticipant.id) : false;

  // Team streak = minimum streak among all participants
  const teamStreak =
    challenge.mode === 'TEAM' && participants.length > 0
      ? Math.min(...participants.map((p) => p.currentStreak))
      : myParticipant?.currentStreak ?? 0;

  const { currentDay, daysLeft, progress, isFinished, result } = getChallengeProgress(challenge, challenge.mode === 'TEAM' ? teamStreak : (myParticipant?.currentStreak ?? 0), completedToday);

  const handleCloseEndModal = () => {
    if (challenge) localStorage.setItem(`seen_finish_${challenge.id}`, 'true');
    setShowEndModal(false);
  };

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/join/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKickParticipant = async (participantId: string, playerName: string) => {
    if (!window.confirm(`¿Seguro que quieres eliminar a ${playerName} del desafío? Esto borrará su progreso.`)) return;
    
    setIsKicking(true);
    try {
      await kickParticipant(id, participantId, user!.uid);
      // We don't need to manually update state, onSnapshot will remove them
    } catch (err) {
      console.error(err);
      alert('Error al eliminar al jugador.');
    } finally {
      setIsKicking(false);
    }
  };

  const isSurvival = challenge?.mode === 'SURVIVAL';
  const isChallengeEnded = isFinished || challenge.status === 'COMPLETED';

  // A SURVIVAL player is eliminated if:
  // 1. The cron already set isEliminated=true in Firestore, OR
  // 2. Their streak is behind calendar days (missed a past day) — detected client-side
  const effectivelyEliminated =
    myParticipant?.isEliminated ||
    (isSurvival && myParticipant ? isSurvivalEliminated(challenge, myParticipant.currentStreak) : false);

  // Not enough players warning for SURVIVAL (needs at least 2 to be meaningful)
  const survivalNeedsMorePlayers = isSurvival && participants.length < 2;
  
  return (
    <div className="app-container" style={isSurvival ? { background: 'radial-gradient(circle at top, rgba(90,0,0,0.4) 0%, var(--color-background) 70%)' } : {}}>
      {/* Header */}
      <header className="page-header">
        <div style={{ flex: 1 }}>
          <Link href="/" className="text-muted text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            ← Mis desafíos
          </Link>
          <h1 className="page-title" style={{ fontSize: '1.5rem', color: isSurvival ? '#ffb3b0' : undefined }}>
            {challenge.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-muted text-sm" style={{ color: isSurvival ? '#ff3b30' : undefined, fontWeight: isSurvival ? 'bold' : 'normal' }}>
              {challenge.mode === 'TEAM' ? '👥 Equipo' : isSurvival ? '☠️ Supervivencia' : '🧑 Individual'}
            </span>
            <span className="text-muted text-sm">·</span>
            <span className="text-muted text-sm">
              Día {currentDay} de {challenge.totalDays}
            </span>
            {isSurvival && (
              <>
                <span className="text-muted text-sm">·</span>
                <span className="text-sm font-bold" style={{ color: '#ff3b30' }}>
                  💰 Premio Especial ☠️
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="mb-6">
        <div className="progress-bar-track" style={isSurvival ? { background: 'rgba(255,0,0,0.1)' } : {}}>
          <div className="progress-bar-fill" style={{ width: `${Math.round(progress * 100)}%`, background: isSurvival ? 'linear-gradient(90deg, #8b0000, #ff3b30)' : undefined }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-muted text-xs">{Math.round(progress * 100)}% completado</span>
          <span className="text-muted text-xs">
            {daysLeft > 0 ? `${daysLeft} días restantes` : '¡Terminado!'}
          </span>
        </div>
      </div>

      {/* Live streak card */}
      <div className="card mb-6" style={isSurvival ? { textAlign: 'center', padding: '24px 0', border: '1px solid rgba(255, 59, 48, 0.4)', background: 'rgba(40,0,0,0.5)' } : { textAlign: 'center', padding: '24px 0' }}>
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
      ) : effectivelyEliminated ? (
        <div className="mb-6 card text-center" style={{ padding: '24px', borderColor: 'var(--color-danger)', background: 'rgba(255, 59, 48, 0.05)' }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>💀</p>
          <p className="font-bold" style={{ color: 'var(--color-danger)' }}>Fuiste eliminado</p>
          <p className="text-muted text-sm mt-2">Perdiste la racha y quedaste fuera de la carrera.</p>
        </div>
      ) : survivalNeedsMorePlayers && !isChallengeEnded ? (
        <div className="mb-6 card text-center" style={{ padding: '24px', borderColor: '#f0c040', background: 'rgba(240, 192, 64, 0.05)' }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</p>
          <p className="font-bold" style={{ color: '#f0c040' }}>Esperando más jugadores</p>
          <p className="text-muted text-sm mt-2">El desafío de Supervivencia necesita al menos 2 participantes para comenzar.</p>
        </div>
      ) : isChallengeEnded ? (
        <>
          {result === 'WON' && (
            <div className="mb-6 card text-center" style={{ padding: '24px', borderColor: 'var(--color-primary)', background: 'rgba(0, 230, 118, 0.05)' }}>
              <p style={{ fontSize: '2rem', marginBottom: 8 }}>🏆</p>
              <p className="font-bold text-accent">¡Desafío superado!</p>
              <p className="text-muted text-sm mt-2">Completaste los {challenge.totalDays} días. ¡Increíble racha!</p>
            </div>
          )}
          {result === 'ALMOST' && (
            <div className="mb-6 card text-center" style={{ padding: '24px', borderColor: '#f0c040', background: 'rgba(240, 192, 64, 0.05)' }}>
              <p style={{ fontSize: '2rem', marginBottom: 8 }}>😅</p>
              <p className="font-bold" style={{ color: '#f0c040' }}>¡Casi lo lograste!</p>
              <p className="text-muted text-sm mt-2">Te faltó un día para terminar. ¡Suerte en el próximo desafío!</p>
            </div>
          )}
          {result === 'LOST' && (
            <div className="mb-6 card text-center" style={{ padding: '24px', borderColor: 'var(--color-danger)', background: 'rgba(255, 59, 48, 0.05)' }}>
              <p style={{ fontSize: '2rem', marginBottom: 8 }}>💪</p>
              <p className="font-bold" style={{ color: 'var(--color-danger)' }}>El desafío terminó</p>
              <p className="text-muted text-sm mt-2">Esta vez no se dio, pero cada racha es una oportunidad más. ¡Dale de nuevo!</p>
            </div>
          )}
        </>
      ) : (
        <div className="mb-6">
          <CompleteButton
            challengeId={id}
            participantId={myParticipant.id}
            timezone={challenge?.timezone}
            alreadyDone={completedToday}
            playerName={user.displayName ?? undefined}
            challengeName={challenge.name}
            onComplete={() => {/* onSnapshot handles the update automatically */}}
          />
        </div>
      )}

      {/* Share streak card */}
      {myParticipant && (myParticipant.currentStreak > 0) && (
        <div className="mb-6">
          <ShareButton
            challengeName={challenge.name}
            streak={challenge.mode === 'TEAM' ? teamStreak : (myParticipant.currentStreak ?? 0)}
            totalDays={challenge.totalDays}
            currentDay={currentDay}
            playerName={user.displayName ?? 'Yo'}
            mode={challenge.mode}
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
        <ParticipantList 
          participants={participants} 
          currentUserId={user.uid} 
          completedIds={completedIds} 
          allLogs={allLogs}
          dates={challenge ? getChallengeDates(challenge.createdAt, challenge.totalDays, challenge.timezone) : []}
          isAdmin={challenge?.creatorId === user.uid}
          creatorId={challenge?.creatorId}
          onKickParticipant={handleKickParticipant}
        />
      </div>

      {/* Archive / Abandon */}
      {myParticipant && (
        <div className="mb-10" style={{ textAlign: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}
            disabled={isArchiving}
            onClick={async () => {
              if (confirm('¿Estás seguro que querés abandonar este desafío? Desaparecerá de tu lista.')) {
                setIsArchiving(true);
                try {
                  await archiveParticipant(myParticipant.id);
                  router.replace('/');
                } catch (e) {
                  console.error(e);
                  setIsArchiving(false);
                }
              }
            }}
          >
            {isArchiving ? 'Archivando...' : 'Abandonar desafío'}
          </button>
        </div>
      )}

      <ChallengeCompletedModal
        show={showEndModal}
        onClose={handleCloseEndModal}
        challengeName={challenge.name}
      />
    </div>
  );
}
