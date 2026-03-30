'use client';

import { Participant } from '@/lib/challenges';
import StreakBadge from './StreakBadge';

interface ParticipantListProps {
    participants: Participant[];
    currentUserId?: string;
}

export default function ParticipantList({
    participants,
    currentUserId,
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
            {sorted.map((p, i) => (
                <div className="participant-row" key={p.id}>
                    <div className="participant-avatar" style={{ color: '#888' }}>
                        {i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : i + 1 === 3 ? '🥉' : `${i + 1}`}
                    </div>
                    <div className="participant-avatar" style={{ background: avatarColor(p.userId) }}>
                        {p.playerName.charAt(0).toUpperCase()}
                    </div>
                    <span className="participant-name">
                        {p.playerName}
                        {p.userId === currentUserId && (
                            <span className="text-muted text-xs" style={{ marginLeft: 6 }}>
                                (tú)
                            </span>
                        )}
                    </span>
                    <StreakBadge streak={p.currentStreak} size="sm" />
                </div>
            ))}
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
