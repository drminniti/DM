'use client';

import Link from 'next/link';
import { Challenge, getChallengeProgress } from '@/lib/challenges';
import StreakBadge from './StreakBadge';

interface ChallengeCardProps {
    challenge: Challenge;
    streak: number;
    completedToday: boolean;
    isEliminated?: boolean;
    isFinished?: boolean;
}

export default function ChallengeCard({
    challenge,
    streak,
    completedToday,
    isEliminated = false,
    isFinished = false,
}: ChallengeCardProps) {
    const { currentDay, progress, result } = getChallengeProgress(challenge, streak, completedToday);

    const isSurvival = challenge.mode === 'SURVIVAL';

    let cardStyle: React.CSSProperties = {};
    if (isEliminated) {
        cardStyle = { opacity: 0.5, filter: 'grayscale(100%)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' };
    } else if (isFinished) {
        cardStyle = { opacity: 0.65, filter: 'grayscale(60%)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' };
    } else if (isSurvival) {
        cardStyle = {
            background: 'linear-gradient(135deg, rgba(40, 0, 0, 0.8) 0%, rgba(10, 0, 0, 0.9) 100%)',
            border: '1px solid rgba(255, 59, 48, 0.3)',
            boxShadow: 'inset 0 0 20px rgba(255, 0, 0, 0.05)',
        };
    }

    const resultIcon = result === 'WON' ? '🏆' : result === 'ALMOST' ? '😅' : result === 'LOST' ? '💪' : null;
    const resultLabel = result === 'WON' ? 'Superado' : result === 'ALMOST' ? 'Casi lo lograste' : result === 'LOST' ? 'No llegaste' : null;

    return (
        <Link href={`/challenge/${challenge.id}`} className="card card-link" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="font-bold" style={{ fontSize: '1rem', textDecoration: isEliminated ? 'line-through' : 'none', color: isSurvival && !isEliminated ? '#ffb3b0' : undefined }}>
                        {challenge.name}
                    </div>
                    <div className="text-muted text-sm mt-2">
                        {challenge.mode === 'TEAM' ? '👥 Equipo' : isSurvival ? '☠️ Supervivencia' : '🧑 Individual'} ·{' '}
                        {challenge.totalDays} días
                    </div>
                    {isSurvival && (
                        <div className="text-xs mt-1 font-bold" style={{ color: '#ff3b30' }}>
                            💰 Premio: 50 PTS x Jugador
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center" style={{ gap: 4 }}>
                    {completedToday && !isEliminated && (
                        <span style={{ fontSize: '1.25rem' }} title="Completado hoy">
                            {isSurvival ? '🩸' : '✅'}
                        </span>
                    )}
                    <StreakBadge streak={streak} size="sm" />
                </div>
            </div>

            <div className="progress-bar-track" style={isSurvival ? { background: 'rgba(255,255,255,0.05)' } : {}}>
                <div
                    className="progress-bar-fill"
                    style={{ 
                        width: `${Math.round(progress * 100)}%`, 
                        background: isEliminated ? 'var(--color-danger)' : isFinished ? 'var(--color-text-muted)' : isSurvival ? 'linear-gradient(90deg, #8b0000, #ff3b30)' : undefined 
                    }}
                />
            </div>
            <div className="text-muted text-xs mt-2" style={{ color: isEliminated ? 'var(--color-danger)' : isSurvival ? 'rgba(255,59,48,0.8)' : undefined, fontWeight: isEliminated ? 'bold' : 'normal' }}>
                {isEliminated
                    ? '💀 ELIMINADO'
                    : isFinished && resultLabel
                    ? `${resultIcon} ${resultLabel}`
                    : `Día ${currentDay} de ${challenge.totalDays}`
                }
            </div>
        </Link>
    );
}
