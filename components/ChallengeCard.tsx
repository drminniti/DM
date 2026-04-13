'use client';

import Link from 'next/link';
import { Challenge, getChallengeProgress } from '@/lib/challenges';
import StreakBadge from './StreakBadge';

interface ChallengeCardProps {
    challenge: Challenge;
    streak: number;
    completedToday: boolean;
    isEliminated?: boolean;
}

export default function ChallengeCard({
    challenge,
    streak,
    completedToday,
    isEliminated = false,
}: ChallengeCardProps) {
    const { currentDay, progress } = getChallengeProgress(challenge, streak, completedToday);

    return (
        <Link href={`/challenge/${challenge.id}`} className="card card-link" style={isEliminated ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="font-bold" style={{ fontSize: '1rem', textDecoration: isEliminated ? 'line-through' : 'none' }}>
                        {challenge.name}
                    </div>
                    <div className="text-muted text-sm mt-2">
                        {challenge.mode === 'TEAM' ? '👥 Equipo' : challenge.mode === 'SURVIVAL' ? '☠️ Supervivencia' : '🧑 Individual'} ·{' '}
                        {challenge.totalDays} días
                    </div>
                    {challenge.mode === 'SURVIVAL' && (
                        <div className="text-xs text-accent mt-1 font-bold">
                            💰 Pozo: {challenge.pot || 0} pts
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center" style={{ gap: 4 }}>
                    {completedToday && (
                        <span style={{ fontSize: '1.25rem' }} title="Completado hoy">
                            ✅
                        </span>
                    )}
                    <StreakBadge streak={streak} size="sm" />
                </div>
            </div>

            <div className="progress-bar-track">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.round(progress * 100)}%`, background: isEliminated ? 'var(--color-danger)' : undefined }}
                />
            </div>
            <div className="text-muted text-xs mt-2" style={{ color: isEliminated ? 'var(--color-danger)' : undefined, fontWeight: isEliminated ? 'bold' : 'normal' }}>
                {isEliminated ? '💀 ELIMINADO' : `Día ${currentDay} de ${challenge.totalDays}`}
            </div>
        </Link>
    );
}
