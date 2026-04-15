'use client';

import { Participant, DailyLog, Challenge } from '@/lib/challenges';
import StreakBadge from './StreakBadge';

interface ParticipantListProps {
  participants: Participant[];
  currentUserId?: string;
  completedIds?: Set<string>; // real-time set of participantIds who completed today
  allLogs?: DailyLog[];
  dates?: string[]; // array of YYYY-MM-DD
  isAdmin?: boolean;
  creatorId?: string;
  onKickParticipant?: (participantId: string, playerName: string) => void;
  challenge?: Challenge; // needed for survival elimination detection
}

export default function ParticipantList({
  participants,
  currentUserId,
  completedIds = new Set(),
  allLogs = [],
  dates = [],
  isAdmin = false,
  creatorId,
  onKickParticipant,
  challenge,
}: ParticipantListProps) {
  if (participants.length === 0) {
    return (
      <p className="text-muted text-sm text-center" style={{ padding: '24px 0' }}>
        Aún no hay participantes
      </p>
    );
  }

  const sorted = [...participants].sort((a, b) => b.currentStreak - a.currentStreak);

  return (
    <div className="participants-list">
      {sorted.map((p, i) => {
        const doneToday = completedIds.has(p.id);
        // Elimination is set by the midnight cron — use Firestore flag only
        const effectivelyEliminated = p.isEliminated;
        return (
          <div className="participant-row" key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {/* Rank medal */}
              <div className="participant-avatar" style={{ color: '#888', background: 'transparent', fontSize: '1rem' }}>
                {effectivelyEliminated ? '💀' : i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </div>
              {/* Initial avatar */}
              <div className="participant-avatar" style={{ background: avatarColor(p.userId), opacity: effectivelyEliminated ? 0.5 : 1 }}>
                {p.playerName.charAt(0).toUpperCase()}
              </div>
              {/* Name */}
              <span className="participant-name" style={{ textDecoration: effectivelyEliminated ? 'line-through' : 'none', opacity: effectivelyEliminated ? 0.5 : 1 }}>
                {p.playerName}
                {effectivelyEliminated && <span title="Eliminado" style={{ marginLeft: 6, fontSize: '0.9rem' }}>💀</span>}
                {p.userId === currentUserId && (
                  <span className="text-muted text-xs" style={{ marginLeft: 4 }}>(tú)</span>
                )}
                {p.userId === creatorId && (
                  <span title="Creador del Desafío" style={{ marginLeft: 6, fontSize: '0.8rem' }}>👑</span>
                )}
              </span>

              {/* Admin Kick Button */}
              {isAdmin && p.userId !== currentUserId && onKickParticipant && (
                <button
                  type="button"
                  onClick={() => onKickParticipant(p.id, p.playerName)}
                  title="Eliminar jugador"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    marginRight: 8,
                    fontSize: '1.2rem',
                    opacity: 0.6,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = '0.6')}
                >
                  ✕
                </button>
              )}
              {/* Today status — live */}
              {!effectivelyEliminated && (
                <span
                  style={{
                    fontSize: '1rem',
                    marginRight: 4,
                    opacity: doneToday ? 1 : 0.2,
                    transition: 'opacity 400ms ease',
                  }}
                  title={doneToday ? 'Completó hoy' : 'Pendiente'}
                >
                  ✅
                </span>
              )}
              {/* Streak */}
              {!effectivelyEliminated && <StreakBadge streak={p.currentStreak} size="sm" />}
            </div>

            {/* History Grid */}
            {dates.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 46 }}>
                {dates.map((date, idx) => {
                  const log = allLogs.find((l) => l.participantId === p.id && l.date === date);
                  const isDone = log?.isCompleted;
                  // If date is today, and they haven't done it, it's neutral. If past, it's missed.
                  const isPast = date < new Date().toLocaleDateString('en-CA');
                  const isFuture = date > new Date().toLocaleDateString('en-CA');
                  
                  let bg = 'var(--color-surface-2)'; // neutral (today pending or future)
                  let border = '1px solid transparent';
                  if (isDone) {
                    bg = 'var(--color-accent)';
                  } else if (isPast) {
                    bg = 'rgba(255, 68, 68, 0.1)';
                    border = '1px solid rgba(255, 68, 68, 0.2)';
                  }
                  
                  return (
                    <div
                      key={date}
                      title={`Día ${idx + 1}: ${date}${isDone ? ' (Completado)' : isPast ? ' (Fallado)' : ''}`}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: bg,
                        border,
                        transition: 'background 0.3s ease',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function avatarColor(userId: string): string {
  const colors = [
    '#1e3a5f', '#2d4a3e', '#4a2d3e', '#3e2d4a', '#3a3a1e',
    '#1e4a3a', '#4a3a1e', '#1e1e4a',
  ];
  let hash = 0;
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}
