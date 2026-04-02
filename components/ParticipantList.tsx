'use client';

import { Participant } from '@/lib/challenges';
import StreakBadge from './StreakBadge';

interface ParticipantListProps {
  participants: Participant[];
  currentUserId?: string;
  completedIds?: Set<string>; // real-time set of participantIds who completed today
}

export default function ParticipantList({
  participants,
  currentUserId,
  completedIds = new Set(),
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
        return (
          <div className="participant-row" key={p.id}>
            {/* Rank medal */}
            <div className="participant-avatar" style={{ color: '#888', background: 'transparent', fontSize: '1rem' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </div>
            {/* Initial avatar */}
            <div className="participant-avatar" style={{ background: avatarColor(p.userId) }}>
              {p.playerName.charAt(0).toUpperCase()}
            </div>
            {/* Name */}
            <span className="participant-name">
              {p.playerName}
              {p.userId === currentUserId && (
                <span className="text-muted text-xs" style={{ marginLeft: 6 }}>(tú)</span>
              )}
            </span>
            {/* Today status — live */}
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
            {/* Streak */}
            <StreakBadge streak={p.currentStreak} size="sm" />
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
