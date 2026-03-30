'use client';

import Link from 'next/link';
import { Challenge } from '@/lib/challenges';
import StreakBadge from './StreakBadge';

interface ChallengeCardProps {
    challenge: Challenge;
    streak: number;
    completedToday: boolean;
}

export default function ChallengeCard({
    challenge,
    streak,
    completedToday,
}: ChallengeCardProps) {
    const daysSince = Math.floor(
        (Date.now() - (challenge.createdAt?.toMillis?.() ?? Date.now())) /
        (1000 * 60 * 60 * 24)
    );
    const progress = Math.min(daysSince / challenge.totalDays, 1);

    return (
        <Link href={`/challenge/${challenge.id}`} className="card card-link">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="font-bold" style={{ fontSize: '1rem' }}>
                        {challenge.name}
                    </div>
                    <div className="text-muted text-sm mt-2">
                        {challenge.mode === 'TEAM' ? '👥 Equipo' : '🧑 Individual'} ·{' '}
                        {challenge.totalDays} días
                    </div>
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
                    style={{ width: `${Math.round(progress * 100)}%` }}
                />
            </div>
            <div className="text-muted text-xs mt-2">
                Día {Math.min(daysSince + 1, challenge.totalDays)} de {challenge.totalDays}
            </div>
        </Link>
    );
}
